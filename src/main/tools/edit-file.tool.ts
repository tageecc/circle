import { promises as fs } from 'fs'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import { defineTool } from './define-tool'
import { generateTextOneShot } from '../agent/llm-one-shot'
import { getToolContext } from '../services/tool-context'
import { checkPlanMode } from './plan-mode-guard'
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
3. **With \`// ... existing code ...\` markers**: the current session model merges the sketch into the full file (up to two attempts). **If merge fails, the tool returns \`edit_file_failed\` JSON and does not write the file** — fix the sketch or use a full-file replace without markers.
4. **Without markers** (or new file): your \`code_edit\` is written as the full new content
5. **Success**: \`applied-file-edit\` payload and file written to disk

### Parameter Order
Specify arguments in this order: [target_file, instructions, code_edit]`,
  inputSchema,
  execute: async ({ target_file, instructions, code_edit }, options: ToolCallOptions) => {
    const ctx = getToolContext(options)
    const { workspaceRoot } = ctx

    // 解析文件路径为绝对路径
    const absolutePath = path.isAbsolute(target_file)
      ? target_file
      : path.resolve(workspaceRoot, target_file)

    // Check if in Plan Mode and restrict edits to plan file only
    const { isInPlanMode, planFilePath } = await checkPlanMode(options)

    if (isInPlanMode) {
      if (!planFilePath) {
        return JSON.stringify({
          success: false,
          error: 'In plan mode but no plan file found. This should not happen.'
        })
      }

      const allowedPath = path.resolve(workspaceRoot, planFilePath)

      if (absolutePath !== allowedPath) {
        return JSON.stringify({
          success: false,
          error: `In plan mode, you can only edit the plan file (${planFilePath}). To edit code files, exit plan mode first by calling exit_plan_mode.`,
          hint: 'Use read-only tools (read_file, grep, codebase_search) to explore. When your plan is ready, call exit_plan_mode to request user approval.'
        })
      }
    }

    // 读取原文件
    let originalContent = ''
    let fileExists = false
    try {
      originalContent = await fs.readFile(absolutePath, 'utf-8')
      fileExists = true
    } catch {
      fileExists = false
    }

    const applied = await applyEdit(originalContent, code_edit, instructions, ctx.modelId)
    if (!applied.ok) {
      return JSON.stringify({
        type: 'edit_file_failed',
        success: false,
        reason: applied.reason,
        message: applied.detail,
        filePath: target_file,
        hint: applied.hint
      })
    }

    const newContent = applied.content

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

type ApplyEditOk = { ok: true; content: string }
type ApplyEditFail = {
  ok: false
  reason: 'model_empty' | 'model_error' | 'merge_unchanged'
  detail: string
  hint: string
}
type ApplyEditResult = ApplyEditOk | ApplyEditFail

const FAIL_HINT =
  'Options: (1) Simplify the sketch or add clearer context around edits; (2) Remove "// ... existing code ..." markers and put the full file body in code_edit; (3) Split into smaller edit_file calls.'

function sketchImpliesChanges(sketch: string): boolean {
  return sketch.split('\n').some((line) => {
    const t = line.trim()
    if (!t) return false
    if (/\/\/\s*\.\.\.\s*existing\s+code\s*\.\.\./i.test(t)) return false
    if (/#\s*\.\.\.\s*existing\s+code\s*\.\.\./i.test(t)) return false
    return true
  })
}

function buildMergePrompt(originalContent: string, codeEdit: string, instructions: string): string {
  return `You are a code merge assistant. Apply the edit sketch to the original file and output exactly one complete new file.

## Original file
\`\`\`
${originalContent}
\`\`\`

## Instruction
${instructions}

## Edit sketch (lines "// ... existing code ..." or "# ... existing code ..." mean keep that region from the original)
\`\`\`
${codeEdit}
\`\`\`

## Rules
1. Preserve original code where the sketch shows an "existing code" marker.
2. Insert or replace other regions as implied by the sketch.
3. Output only the full file source: no markdown fences, no commentary.

Complete file:`
}

/**
 * 1. New file → use code_edit as full content
 * 2. No markers → full file replace from code_edit
 * 3. Markers → merge via the current session model (with explicit failure if merge cannot be applied)
 */
async function applyEdit(
  originalContent: string,
  codeEdit: string,
  instructions: string,
  modelId?: string
): Promise<ApplyEditResult> {
  const cleanedEdit = cleanMarkdown(codeEdit)

  if (!originalContent.trim()) {
    return { ok: true, content: cleanedEdit }
  }

  if (!hasExistingCodeMarker(cleanedEdit)) {
    return { ok: true, content: cleanedEdit }
  }

  if (!modelId?.trim()) {
    return {
      ok: false,
      reason: 'model_error',
      detail:
        'The current session has no selected model. Select a model in chat before using sketch-based edit_file merges.',
      hint: FAIL_HINT
    }
  }

  return applyWithModel(originalContent, cleanedEdit, instructions, modelId)
}

async function applyWithModel(
  originalContent: string,
  codeEdit: string,
  instructions: string,
  modelId: string
): Promise<ApplyEditResult> {
  const { getConfigService } = await import('../index.js')
  const config = getConfigService()
  const prompt = buildMergePrompt(originalContent, codeEdit, instructions)

  let lastFailure: 'empty' | 'unchanged' | 'error' = 'empty'
  let lastErrorDetail = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await generateTextOneShot({
        modelId,
        configService: config,
        prompt,
        temperature: attempt === 0 ? 0 : 0.15
      })
      const content = cleanMarkdown(text)

      if (!content.trim()) {
        lastFailure = 'empty'
        continue
      }

      if (sketchImpliesChanges(codeEdit) && content.trim() === originalContent.trim()) {
        lastFailure = 'unchanged'
        continue
      }

      return { ok: true, content }
    } catch (error) {
      lastFailure = 'error'
      lastErrorDetail = error instanceof Error ? error.message : String(error)
      console.error('[edit_file] merge model attempt failed:', error)
    }
  }

  if (lastFailure === 'unchanged') {
    return {
      ok: false,
      reason: 'merge_unchanged',
      detail:
        'Merge model returned text identical to the original while the sketch contained new code. Use a full-file code_edit without markers, or simplify the sketch.',
      hint: FAIL_HINT
    }
  }

  return {
    ok: false,
    reason: lastFailure === 'error' ? 'model_error' : 'model_empty',
    detail:
      lastFailure === 'error'
        ? lastErrorDetail
        : 'The merge model returned empty output after two attempts.',
    hint: FAIL_HINT
  }
}
