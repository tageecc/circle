import { defineTool } from './define-tool'
import { z } from 'zod'
import { promises as fs } from 'fs'
import { resolveFilePath } from './utils'

const inputSchema = z.object({
  target_file: z.string().describe('The path of the file to read'),
  offset: z
    .number()
    .optional()
    .describe(
      '0-based line index to start from (first line is 0). Displayed line numbers in output are still 1-based.'
    ),
  limit: z.number().optional().describe('Maximum number of lines to return after the offset')
})

/**
 * Read File Tool
 * 读取文件内容，支持行号显示和分页
 */
export const readFileTool = defineTool({
  description: `Read file contents from the local filesystem. Returns content with line numbers for easy reference.

### When to Use This Tool

Use read_file when you need to:
- Examine the contents of a specific file
- Understand code structure before making edits
- Review configuration files or documentation
- Check what exists in a file before modifying it
- Read partial content from very large files (using offset/limit)

### When NOT to Use

Skip read_file for:
- **Searching for text across files** → use \`grep\` or \`codebase_search\`
- **Listing directory contents** → use \`list_dir\`
- **Finding files by name** → use \`glob_file_search\`

### Output Format

Lines are numbered starting at 1, using this format:
\`\`\`
     1|import React from 'react'
     2|import { useState } from 'react'
     3|
     4|export default function App() {
     5|  return <div>Hello</div>
     6|}
\`\`\`

This makes it easy to reference specific lines when discussing or editing code.

### Reading Strategy

**Small files (<500 lines)**: Read the entire file
- Don't specify offset/limit
- Get complete context in one read

**Large files (500-2000 lines)**: Read strategically
- Read the top (imports, exports) first
- Then read specific sections you need
- Use offset/limit to paginate

**Very large files (>2000 lines)**: Consider alternatives
- Use \`grep\` to find specific sections
- Use \`codebase_search\` to find relevant parts
- Only read_file the specific line ranges you need

### Parameters

- **target_file** (required): Absolute or relative path to the file
- **offset** (optional): 0-based line index (first line = 0). Output line labels remain 1-based.
- **limit** (optional): Max lines to return after that offset

### Examples

<example>
  Scenario: Read a complete component file
  Usage: read_file(target_file="src/components/Button.tsx")
  <reasoning>
    Good: Small file, need full context
  </reasoning>
</example>

<example>
  Scenario: Read top of a large utility file
  Usage: read_file(target_file="src/utils/helpers.ts", offset=0, limit=100)
  <reasoning>
    Good: Check imports and exports first, then read specific functions if needed
  </reasoning>
</example>

<example>
  Scenario: Read middle section after seeing line numbers elsewhere
  Usage: read_file(target_file="src/api/client.ts", offset=250, limit=50)
  <reasoning>
    Good: Found relevant section via grep, now reading context around it
  </reasoning>
</example>

### Important Notes
- If user provides a file path, assume it's valid and try to read it
- Non-existent files return an error (not a failure - this is useful info)
- Empty files return "File is empty."
- Binary files may return unreadable content
- Prefer reading full files unless they're genuinely large (>500 lines)`,
  inputSchema,
  execute: async ({ target_file, offset, limit }) => {
    try {
      const absolutePath = resolveFilePath(target_file)

      // 读取文件内容
      const content = await fs.readFile(absolutePath, 'utf-8')
      const lines = content.split('\n')

      // 处理分页
      const startLine = offset ?? 0
      const endLine = limit ? startLine + limit : lines.length
      const selectedLines = lines.slice(startLine, endLine)

      // 格式化输出（带行号）
      const formattedLines = selectedLines
        .map((line, index) => {
          const lineNumber = (startLine + index + 1).toString().padStart(6, ' ')
          return `${lineNumber}\t${line}`
        })
        .join('\n')

      return formattedLines
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        throw new Error(`File not found: ${target_file}`)
      }
      throw new Error(`Failed to read file: ${err.message}`)
    }
  }
})
