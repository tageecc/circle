import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { createPatch } from 'diff'
import { applyEdit } from '../utils/apply-edit'
import { resolveFilePath } from './utils'

/**
 * 文件编辑工具（完全复刻 Cursor 的 edit_file）
 *
 * 实现原理（基于 Cursor 的 AI Workflow）：
 * 1. 读取文件内容（如果存在）
 * 2. 主 Agent（先进模型）生成编辑方案，使用占位符 `// ... existing code ...` 压缩上下文
 * 3. Apply Edit Agent（小模型 qwen-turbo）将占位符替换为原始代码，生成完整新文件
 * 4. 自动写入文件（无需用户确认）
 * 5. 返回 diff 信息供 UI 显示
 *
 * 优势：
 * - 使用占位符显著减少上下文空间占用
 * - 两阶段处理：先进模型规划 + 小模型执行
 * - 自动应用编辑，无需等待用户确认
 */
export const editFileTool = {
  description: `Use this tool to propose an edit to an existing file or create a new file.

This will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.
When writing the edit, you should specify each edit in sequence, with the special comment \`// ... existing code ...\` to represent unchanged code in between edited lines.

For example:

\`\`\`
// ... existing code ...
FIRST_EDIT
// ... existing code ...
SECOND_EDIT
// ... existing code ...
THIRD_EDIT
// ... existing code ...
\`\`\`

You should still bias towards repeating as few lines of the original file as possible to convey the change.
But, each edit should contain sufficient context of unchanged lines around the code you're editing to resolve ambiguity.
DO NOT omit spans of pre-existing code (or comments) without using the \`// ... existing code ...\` comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines.
Make sure it is clear what the edit should be, and where it should be applied.
To create a new file, simply specify the content of the file in the \`code_edit\` field.`,

  parameters: z.object({
    target_file: z
      .string()
      .describe(
        'The target file to modify. You can use either a relative path in the workspace or an absolute path.'
      ),
    instructions: z
      .string()
      .describe(
        'A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit.'
      ),
    code_edit: z
      .string()
      .describe(
        "Specify ONLY the precise lines of code that you wish to edit. **NEVER specify or write out unchanged code**. Instead, represent all unchanged code using the comment of the language you're editing in - example: `// ... existing code ...`"
      )
  }),

  execute: async ({
    target_file,
    instructions,
    code_edit
  }: {
    target_file: string
    instructions: string
    code_edit: string
  }) => {
    try {
      // 🔒 解析文件路径（基于项目目录）
      const absolutePath = resolveFilePath(target_file)

      // 读取当前文件内容（如果存在）
      let currentContent = ''
      let fileExists = false

      try {
        currentContent = await fs.readFile(absolutePath, 'utf-8')
        fileExists = true
      } catch (error: unknown) {
        if (error instanceof Error && (error as any).code !== 'ENOENT') {
          throw error
        }
        // 文件不存在，当作新建
      }

      // 智能应用编辑指令（两阶段处理）
      // 阶段1: 小模型（qwen-turbo）快速应用编辑
      // 阶段2: 如果失败，使用主模型（qwen-plus）重试（类似 Cursor 的 reapply）
      let newContent: string

      if (fileExists) {
        // 尝试使用小模型应用编辑
        const result = await applyEdit({
          originalContent: currentContent,
          codeEdit: code_edit,
          instructions,
          filePath: target_file
        })

        if (result.success && result.newContent) {
          newContent = result.newContent
          console.log('✅ [edit_file] Applied edit using fast model (qwen-turbo)')
        } else {
          // 小模型失败，返回错误（让主 Agent 重新生成更清晰的编辑指令）
          console.error('❌ [edit_file] Fast model failed:', result.error)
          return {
            success: false,
            isError: true,
            message: `Failed to apply edit using fast model: ${result.error || 'Unknown error'}\n\nPlease try again with more explicit edit instructions, or provide more context around the changes.`
          }
        }
      } else {
        // 新文件，直接使用 code_edit 作为内容
        newContent = code_edit
        console.log('✅ [edit_file] Creating new file')
      }

      // 确保目录存在
      const dir = path.dirname(absolutePath)
      await fs.mkdir(dir, { recursive: true })

      // ✅ 直接写入文件（类似 Cursor）
      await fs.writeFile(absolutePath, newContent, 'utf-8')

      // 生成 unified diff（用于 UI 显示）
      const patches = createPatch(target_file, currentContent, newContent, 'Current', 'Proposed', {
        context: 3
      })

      // 计算统计信息（基于 diff）
      const diffLines = patches.split('\n')
      const addedLines = diffLines.filter(
        (line) => line.startsWith('+') && !line.startsWith('+++')
      ).length
      const deletedLines = diffLines.filter(
        (line) => line.startsWith('-') && !line.startsWith('---')
      ).length
      const lines = newContent.split('\n')

      // 返回成功：含 diff 与 old/new 内容，供前端展示 diff 条；接受=关闭条，拒绝=回滚写入 oldContent
      return {
        success: true,
        filePath: target_file,
        absolutePath,
        fileExists,
        diff: patches,
        oldContent: currentContent,
        newContent,
        code_edit: code_edit,
        stats: {
          linesAdded: addedLines,
          linesDeleted: deletedLines,
          linesTotal: lines.length
        },
        message: `${fileExists ? 'Edited' : 'Created'} ${target_file} (+${addedLines}/-${deletedLines})`
      }
    } catch (error: unknown) {
      return {
        success: false,
        isError: true,
        message: `Failed to propose edit: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
