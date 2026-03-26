/**
 * 主进程 AI 模型类型定义
 */

export type ModelProvider =
  | 'dashscope'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'xai'

export interface ModelConfig {
  id: string
  name: string
  description: string
  provider: ModelProvider
  contextWindow: number
  maxTokens: number
}
