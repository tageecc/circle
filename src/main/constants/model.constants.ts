/**
 * AI 模型配置常量
 * 
 * 主进程专用，包含模型列表和默认值
 */

import type { ModelConfig } from '../types/model'

/**
 * DashScope 模型列表
 */
export const DASHSCOPE_MODELS: ModelConfig[] = [
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    description: '通义千问 Plus - 平衡性能与成本，适合日常开发',
    provider: 'dashscope',
    contextWindow: 128000,
    maxTokens: 8000
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    description: '通义千问 Max - 最强性能，适合复杂任务',
    provider: 'dashscope',
    contextWindow: 128000,
    maxTokens: 8000
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    description: '通义千问 Turbo - 快速响应，适合简单查询',
    provider: 'dashscope',
    contextWindow: 128000,
    maxTokens: 8000
  },
  {
    id: 'qwen3-max-preview',
    name: 'Qwen3 Max Preview',
    description: '通义千问 3 Max 预览版 - 最新模型',
    provider: 'dashscope',
    contextWindow: 128000,
    maxTokens: 8000
  }
]

/**
 * 所有可用模型（可扩展支持其他 provider）
 */
export const AVAILABLE_MODELS: ModelConfig[] = [...DASHSCOPE_MODELS]

/**
 * 默认模型 ID
 */
export const DEFAULT_MODEL_ID = 'qwen-plus'

/**
 * 获取模型配置
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)
}
