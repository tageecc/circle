/**
 * 智能代码编辑应用工具（工具函数）
 *
 * 这是一个工具函数，不是 tool，用于 edit_file 工具内部调用。
 * 使用 Apply Edit Agent（qwen-turbo）来智能地将 AI 的编辑指令应用到原始文件内容上。
 *
 * 工作流程：
 * 1. AI 调用 edit_file tool
 * 2. edit_file 自动调用此函数 applyEdit()
 * 3. applyEdit() 使用 Apply Edit Agent 理解占位符并生成完整新文件
 * 4. edit_file 生成 diff 并返回给前端等待确认
 *
 * 架构设计：
 * - agents/apply-edit.agent.ts  ← Agent 定义（统一管理）
 * - utils/apply-edit.ts          ← 工具函数（业务逻辑）
 * - tools/edit-file.ts           ← Tool（暴露给 AI）
 */

import { getApplyEditAgent } from '../agents/apply-edit.agent'

interface ApplyEditOptions {
  originalContent: string
  codeEdit: string
  instructions: string
  filePath: string
}

/**
 * 使用 Apply Edit Agent（qwen-turbo）来智能应用编辑指令
 */
export async function applyEdit({
  originalContent,
  codeEdit,
  instructions,
  filePath
}: ApplyEditOptions): Promise<{
  success: boolean
  newContent?: string
  error?: string
}> {
  try {
    console.log(`\n🔧 [Apply Edit Agent] Processing ${filePath}`)
    console.log(`   Instructions: ${instructions}`)
    console.log(`   Original lines: ${originalContent.split('\n').length}`)
    console.log(`   Edit lines: ${codeEdit.split('\n').length}`)

    const agent = getApplyEditAgent()

    const userPrompt = `You are a code editing assistant. Your task is to apply the edit instructions to the original file.

**Original File** (${filePath}):
\`\`\`
${originalContent}
\`\`\`

**Edit Instructions**: ${instructions}

**Edit with Placeholders** (comments like "// ... existing code ..." represent unchanged code):
\`\`\`
${codeEdit}
\`\`\`

**Your Task**:
1. Replace all placeholder comments (e.g., "// ... existing code ...", "# ... existing code ...", "<!-- ... existing code -->") with the actual code from the original file
2. Apply the edits as specified in the "Edit with Placeholders" section
3. Output ONLY the complete new file content, without any explanations or markdown code blocks
4. Preserve all original formatting, indentation, and line breaks

Output the complete new file content:`

    // 使用 Mastra agent 生成
    const { text } = await agent.generate(userPrompt)

    let newContent = text.trim()

    // 去除可能的 markdown 代码块包裹
    const codeBlockRegex = /^```[\w]*\n([\s\S]*?)\n```$/
    const match = newContent.match(codeBlockRegex)
    if (match) {
      console.log('🔧 [Apply Edit Agent] Detected markdown code block, unwrapping...')
      newContent = match[1].trim()
    }

    // 验证输出不是空的
    if (!newContent) {
      console.error('❌ [Apply Edit Agent] Error: Model returned empty content')
      return {
        success: false,
        error: 'Model returned empty content'
      }
    }

    console.log(`✅ [Apply Edit Agent] Successfully applied edit`)
    console.log(`   New content lines: ${newContent.split('\n').length}\n`)

    return {
      success: true,
      newContent
    }
  } catch (error) {
    console.error('\n❌ [Apply Edit Agent] Exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
