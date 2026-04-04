import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { promises as fs } from 'fs'
import { getToolContext } from '../services/tool-context'
import { guardAgainstPlanMode } from './plan-mode-guard'
import * as path from 'path'

const inputSchema = z.object({
  target_file: z.string().describe('The path of the file to delete'),
  explanation: z
    .string()
    .optional()
    .describe('One sentence explanation as to why this tool is being used')
})

/**
 * Delete File Tool
 *
 * Cursor 风格：文件删除也是 pending 操作，用户可以 Accept/Reject
 */
export const deleteFileTool = defineTool({
  description: `Delete a file or directory from the filesystem. Supports undo through pending edits system.

### When to Use This Tool

Use delete_file when you need to:
- Remove obsolete or redundant files
- Clean up after refactoring (old implementations, unused utilities)
- Remove generated files that should be regenerated
- Delete test files or mock data
- Remove entire directories

### When NOT to Use

Avoid delete_file for:
- **Just checking if a file exists** → use \`read_file\` (returns error if missing)
- **Temporary testing** → consider if deletion is really necessary
- **Unclear necessity** → better to ask user first before deleting

### Safety Features

**For Files**:
- Deletion is a **pending edit** - user can Accept/Reject in UI
- Original content is preserved for undo
- Safe to delete and roll back if needed

**For Directories**:
- Immediate deletion (no pending state due to complexity)
- Recursive deletion of all contents
- Use with extra caution - cannot undo

### Decision Guide

<example>
  Scenario: Refactored utils.old.ts → utils.ts
  Action: delete_file("src/utils.old.ts")
  <reasoning>
    Good: Old file is obsolete after refactoring, safe to remove
  </reasoning>
</example>

<example>
  Scenario: User says "clean up the test fixtures"
  Action: delete_file("tests/fixtures")
  <reasoning>
    Good: Clear user intent to remove directory, will delete recursively
  </reasoning>
</example>

<example>
  Scenario: Not sure if config.local.js is needed
  Action: Ask user first (DON'T delete)
  <reasoning>
    Bad: Uncertain necessity, local config might be important
  </reasoning>
</example>

### Important Notes
- File deletions appear in pending edits - user reviews before final commit
- Directory deletions are immediate and recursive
- Non-existent files return clear error message (not a failure)
- Always provide explanation parameter to document why deletion is needed

### Workflow Integration

After deletion:
1. **Files**: Added to pending edits with oldContent/newContent=""
2. **User reviews**: Can Accept (commit) or Reject (restore)
3. **Directories**: Deleted immediately, no pending state`,
  inputSchema,
  execute: async ({ target_file, explanation }, options: ToolCallOptions) => {
    const ctx = getToolContext(options)
    const { workspaceRoot } = ctx

    try {
      // Check if in Plan Mode - file deletion is not allowed
      const guardResult = await guardAgainstPlanMode(options, 'File deletion')
      if (guardResult) return guardResult

      // 解析文件路径为绝对路径
      const absolutePath = path.isAbsolute(target_file)
        ? target_file
        : path.resolve(workspaceRoot, target_file)

      // 检查文件是否存在
      await fs.access(absolutePath)

      // 检查是否为目录
      const stats = await fs.stat(absolutePath)

      if (stats.isDirectory()) {
        // 目录删除：直接删除（不支持 pending，因为目录可能包含大量文件）
        await fs.rm(absolutePath, { recursive: true, force: true })
        return JSON.stringify({
          type: 'directory-deleted',
          success: true,
          message: `Directory deleted: ${target_file}`,
          file: target_file,
          isDirectory: true,
          ...(explanation ? { explanation } : {})
        })
      } else {
        // 文件删除：备份内容，删除文件，添加到 pending edits
        const originalContent = await fs.readFile(absolutePath, 'utf-8')

        // 计算被删除的行数
        const linesRemoved = originalContent.split('\n').length

        // 删除文件
        await fs.unlink(absolutePath)

        // 返回删除信息（前端会添加到 pending edits）
        return JSON.stringify({
          type: 'applied-file-edit',
          toolName: 'delete_file',
          filePath: target_file,
          absolutePath,
          fileExists: true,
          oldContent: originalContent, // 有内容 = 原文件
          newContent: '', // 空字符串 = 删除
          stats: {
            linesAdded: 0,
            linesRemoved: linesRemoved,
            linesTotal: 0
          },
          message: `File deleted: ${target_file} (pending user confirmation)`,
          ...(explanation ? { explanation } : {})
        })
      }
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        throw new Error(`File or directory not found: ${target_file}`)
      }
      throw new Error(`Failed to delete: ${err.message}`)
    }
  }
})
