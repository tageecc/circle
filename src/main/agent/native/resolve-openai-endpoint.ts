/**
 * Resolve OpenAI-compatible chat/completions endpoint from Circle modelId (provider/model).
 */

import type { ConfigService } from '../../services/config.service'

export type OpenAICompatibleEndpoint = {
  baseURL: string
  apiKey: string
  model: string
}

export type AnthropicCredentials = { apiKey: string; model: string }

export function resolveAnthropicCredentials(
  modelId: string,
  configService: ConfigService
): AnthropicCredentials | null {
  const [provider, model] = modelId.split('/')
  if (provider !== 'Anthropic' || !model) return null
  const apiKey = configService.getApiKey('anthropic') || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return { apiKey, model }
}

export type GoogleCredentials = { apiKey: string; model: string }

export function resolveGoogleCredentials(
  modelId: string,
  configService: ConfigService
): GoogleCredentials | null {
  const [provider, model] = modelId.split('/')
  if (provider !== 'Google' || !model) return null
  const apiKey = configService.getApiKey('google') || process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  return { apiKey, model }
}

/** True when API keys exist so the native agent can run for this model. */
export function canUseNativeAgentLoop(modelId: string, configService: ConfigService): boolean {
  return (
    resolveOpenAICompatibleEndpoint(modelId, configService) !== null ||
    resolveAnthropicCredentials(modelId, configService) !== null ||
    resolveGoogleCredentials(modelId, configService) !== null
  )
}

export function resolveOpenAICompatibleEndpoint(
  modelId: string,
  configService: ConfigService
): OpenAICompatibleEndpoint | null {
  const [provider, model] = modelId.split('/')
  if (!provider || !model) return null

  switch (provider) {
    case 'Alibaba (China)': {
      const apiKey = configService.getApiKey('dashscope') || process.env.DASHSCOPE_API_KEY
      if (!apiKey) return null
      return {
        baseURL:
          process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey,
        model
      }
    }
    case 'OpenAI': {
      const apiKey = configService.getApiKey('openai') || process.env.OPENAI_API_KEY
      if (!apiKey) return null
      return {
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey,
        model
      }
    }
    case 'DeepSeek': {
      const apiKey = configService.getApiKey('deepseek') || process.env.DEEPSEEK_API_KEY
      if (!apiKey) return null
      return {
        baseURL: 'https://api.deepseek.com/v1',
        apiKey,
        model
      }
    }
    default:
      return null
  }
}
