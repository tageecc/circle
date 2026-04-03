import { promises as fs } from 'fs'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import { defineTool } from './define-tool'
import { generateTextOneShot } from '../agent/llm-one-shot'
import { getToolContext } from '../services/tool-context'
import * as path from 'path'

const inputSchema = z.object({
  target_file: z
    .string()
    .describe(
      'The target file to modify. Always specify the target file as the first argument. You can use either a relative path in the workspace or an absolute path. If an absolute path is provided, it will be preserved as is.'
    ),
  instructions: z
    .string()
    .describe(
      'A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Please use the first person to describe what you are going to do. Dont repeat what you have said previously in normal messages. And use it to disambiguate uncertainty in the edit.'
    ),
  code_edit: z
    .string()
    .describe(
      "Specify ONLY the precise lines of code that you wish to edit. **NEVER specify or write out unchanged code**. Instead, represent all unchanged code using the comment of the language you're editing in - example: `// ... existing code ...`"
    )
})

/**
 * 清理 markdown 代码块标记
 * 完全保留 AI 生成的内容格式（包括换行符）
 */
function cleanMarkdown(content: string): string {
  return content
    .replace(/^```[\w]*\n?/, '') // 移除开头 ```lang
    .replace(/\n?```$/, '') // 移除结尾 ```
    .replace(/^\s*\n/, '') // 移除开头空行
}

/** 检查是否有 existing code 标记 */
function hasExistingCodeMarker(content: string): boolean {
  return (
    /\/\/\s*\.\.\.\s*existing\s+code\s*\.\.\./i.test(content) ||
    /#\s*\.\.\.\s*existing\s+code\s*\.\.\./i.test(content)
  )
}

/**
 * Edit File Tool
 * 使用小模型来应用编辑
 */
export const editFileTool = defineTool({
  description: `Propose an edit to an existing file or create a new file. Uses a specialized model to apply changes intelligently.

### When to Use This Tool

Use edit_file when you need to:
- Modify specific parts of an existing file
- Create a new file with complete content
- Make surgical changes without rewriting entire files
- Apply multiple edits in sequence to the same file

### When NOT to Use

Consider alternatives for:
- **Creating entire projects** → better to break into multiple file creations
- **Just reading a file** → use \`read_file\` instead
- **Checking if changes are needed** → explore with \`read_file\` and \`codebase_search\` first

### Edit Syntax Rules

**For Partial Edits** (modifying existing file):
\`\`\`
// ... existing code ...
YOUR_FIRST_EDIT
// ... existing code ...
YOUR_SECOND_EDIT
// ... existing code ...
\`\`\`

**For New Files** (creating from scratch):
Just write the complete file content in \`code_edit\` - no markers needed.

### Critical Guidelines

1. **Use \`// ... existing code ...\` markers** to represent unchanged code between edits
   - ⚠️ If you omit this marker, those lines WILL BE DELETED
   - Choose the right comment syntax for the language: \`#\` for Python, \`//\` for JS/TS, etc.

2. **Provide sufficient context** around each edit
   - Include 2-3 unchanged lines before and after the edit
   - Makes it unambiguous where the change should be applied

3. **Minimize repeated code**
   - Only repeat what's necessary for context
   - Use markers for everything else

4. **Write clear instructions**
   - The \`instructions\` field guides the model
   - Be specific: "Add error handling to the fetch call" not "Update function"

### Examples

<example>
  Scenario: Add a new function to an existing file
  <code_edit>
// ... existing code ...

export function newHelper() {
  return true
}

// ... existing code ...
  </code_edit>
  <reasoning>
    Good: Clear insertion point, minimal repeated code, unambiguous location
  </reasoning>
</example>

<example>
  Scenario: Modify a specific function
  <code_edit>
// ... existing code ...

function calculateTotal(items) {
  if (!items || items.length === 0) {
    return 0  // Added: guard clause
  }
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ... existing code ...
  </code_edit>
  <reasoning>
    Good: Includes function context, shows exactly what changed, clear boundaries
  </reasoning>
</example>

<example>
  Scenario: Creating a new utility file
  <code_edit>
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function parseDate(str: string): Date {
  return new Date(str)
}
  </code_edit>
  <reasoning>
    Good: New file, no markers needed, complete content provided
  </reasoning>
</example>

### How It Works

1. **You provide**: target_file, instructions, code_edit
2. **System reads**: the original file (if it exists)
3. **Smart model applies**: your edit by understanding context
4. **Result**: Complete new file content with your changes applied

### Parameter Order
Specify arguments in this order: [target_file, instructions, code_edit]`,
  inputSchema,
  execute: async ({ target_file, instructions, code_edit }, options: ToolCallOptions) => {
    const { workspaceRoot } = getToolContext(options)

    // 解析文件路径为绝对路径
    const absolutePath = path.isAbsolute(target_file)
      ? target_file
      : path.resolve(workspaceRoot, target_file)

    // 读取原文件
    let originalContent = ''
    let fileExists = false
    try {
      originalContent = await fs.readFile(absolutePath, 'utf-8')
      fileExists = true
    } catch {
      fileExists = false
    }

    // 应用编辑
    const newContent = await applyEdit(originalContent, code_edit, instructions)

    // 写入文件
    const dir = path.dirname(absolutePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(absolutePath, newContent, 'utf-8')

    // 计算统计信息
    const oldLines = originalContent ? originalContent.split('\n').length : 0
    const newLines = newContent.split('\n').length
    const linesAdded = Math.max(0, newLines - oldLines)
    const linesRemoved = Math.max(0, oldLines - newLines)

    // 前端通过 onAddPendingFileEdit 回调处理 pending 状态
    // 注意：新文件时，oldContent 使用空字符串（Monaco Diff 会正确处理为全新增）

    return JSON.stringify({
      type: 'applied-file-edit',
      toolName: 'edit_file',
      filePath: target_file,
      absolutePath,
      fileExists,
      oldContent: fileExists ? originalContent : '', // 空字符串 = 新建
      newContent, // 有内容 = 新建或编辑
      instructions,
      stats: { linesAdded, linesRemoved }
    })
  }
})

/**
 * 应用编辑
 *
 * 策略：
 * 1. 新文件 → 直接使用 code_edit
 * 2. 无 existing code 标记 → 完整文件替换
 * 3. 有 existing code 标记 → 调用小模型应用
 */
async function applyEdit(
  originalContent: string,
  codeEdit: string,
  instructions: string
): Promise<string> {
  const cleanedEdit = cleanMarkdown(codeEdit)

  // 新文件：直接使用 AI 生成的原始内容
  if (!originalContent.trim()) {
    return cleanedEdit
  }

  // 编辑现有文件
  if (!hasExistingCodeMarker(cleanedEdit)) {
    // 无 existing code 标记：完整文件替换，直接使用 AI 输出
    return cleanedEdit
  } else {
    // 有 existing code 标记：调用小模型应用编辑，直接使用模型输出
    return await applyWithModel(originalContent, cleanedEdit, instructions)
  }
}

/** 使用小模型应用编辑 */
async function applyWithModel(
  originalContent: string,
  codeEdit: string,
  instructions: string
): Promise<string> {
  const prompt = `你是一个代码编辑助手。将编辑内容应用到原始文件，输出完整的新文件。

## 原始文件
\`\`\`
${originalContent}
\`\`\`

## 编辑说明
${instructions}

## 编辑内容
\`\`\`
${codeEdit}
\`\`\`

## 规则
1. \`// ... existing code ...\` 表示保留原文件对应位置的代码
2. 其他内容是要插入或替换的新代码
3. 输出完整文件，不要遗漏任何代码
4. 只输出代码，不要解释，不要 markdown 标记

直接输出：`

  try {
    const { getConfigService } = await import('../index.js')
    const config = getConfigService()
    const text = await generateTextOneShot({
      modelId: 'Alibaba (China)/qwen-coder-plus-latest',
      configService: config,
      prompt,
      temperature: 0
    })

    const content = cleanMarkdown(text)

    if (!content) {
      console.warn('[edit_file] 模型返回空内容，保持原文件')
      return originalContent
    }

    return content
  } catch (error) {
    console.error('[edit_file] 模型调用失败:', error)
    return originalContent // 失败时保持原文件不变
  }
}
