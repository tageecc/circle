/**
 * Apply Edit Agent - 专门用于应用代码编辑的小模型 agent
 * 配置来自应用设置（设置 → 模型 或 Apply Edit 配置），不使用 process.env。
 */

import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { getMastra } from '../mastra.config'
import { getConfigService } from '../index'

let applyEditAgent: Agent | null = null

const APPLY_EDIT_INSTRUCTIONS = `You are a precise code editing assistant. Your job is to apply edits to files by replacing placeholder comments with actual code.

PLACEHOLDER PATTERNS (represent unchanged code):
- JavaScript/TypeScript: "// ... existing code ..."
- Python: "# ... existing code ..."
- HTML/XML: "<!-- ... existing code -->"
- CSS: "/* ... existing code ... */"
- Shell: "# ... existing code ..."

YOUR TASK:
1. Identify all placeholder comments in the edit instructions
2. Replace each placeholder with the corresponding code from the original file
3. Apply the new edits as specified
4. Output the complete new file content

CRITICAL RULES:
✅ Output ONLY the file content (no explanations, no markdown blocks)
✅ Replace ALL placeholders with actual code from the original file
✅ Preserve exact indentation, spacing, and line breaks
✅ Apply new edits exactly as specified in the edit instructions
✅ Keep all code that should remain unchanged

❌ DO NOT wrap output in \`\`\` code blocks
❌ DO NOT add explanations or comments
❌ DO NOT modify code that should remain unchanged
❌ DO NOT skip any placeholders

EXAMPLE:
Original: "function a() {}\nfunction b() {}"
Edit: "// ... existing code ...\nfunction c() {}"
Output: "function a() {}\nfunction b() {}\nfunction c() {}"`

/**
 * 获取 Apply Edit Agent 实例（单例，从应用配置读取 provider/model/apiKey）
 */
export function getApplyEditAgent(): Agent {
  if (!applyEditAgent) {
    const config = getConfigService()
    const settings =
      config.getApplyEditSettings() ??
      (() => {
        const e = config.getEmbeddingSettings()
        if (e?.provider === 'dashscope' && e?.apiKey) {
          return { provider: 'dashscope', model: e.model || 'qwen-turbo-latest', apiKey: e.apiKey }
        }
        return undefined
      })()

    if (!settings?.apiKey) {
      throw new Error('请在设置中配置 Apply Edit 或代码库索引 Embedding (DashScope) 的 API Key')
    }

    const modelId = settings.model.includes('/')
      ? settings.model
      : `${settings.provider}/${settings.model}`
    const model =
      settings.provider === 'dashscope'
        ? createOpenAI({
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKey: settings.apiKey
          })(settings.model)
        : createOpenAI({ apiKey: settings.apiKey })(modelId)

    applyEditAgent = new Agent({
      name: 'apply_edit_agent',
      model,
      mastra: getMastra(),
      instructions: APPLY_EDIT_INSTRUCTIONS
    })
  }
  return applyEditAgent
}
