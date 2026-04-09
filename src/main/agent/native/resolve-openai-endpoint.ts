/**
 * Resolve OpenAI-compatible chat/completions endpoint from Circle modelId (provider/model).
 */

import type { ConfigService } from '../../services/config.service'
import {
  getProviderRuntimeConfig,
  normalizeModelId,
  normalizeProviderId
} from '../../../shared/provider-config'

export type OpenAICompatibleEndpoint = {
  baseURL: string
  apiKey?: string
  model: string
}

export type AnthropicCredentials = { apiKey: string; model: string }

export function resolveAnthropicCredentials(
  modelId: string,
  configService: ConfigService
): AnthropicCredentials | null {
  const normalizedModelId = normalizeModelId(modelId)
  const [provider, model] = normalizedModelId.split('/')
  if (normalizeProviderId(provider) !== 'anthropic' || !model) return null
  const apiKey = configService.getProviderApiKey('anthropic')
  if (!apiKey) return null
  return { apiKey, model }
}

export type GoogleCredentials = { apiKey: string; model: string }

export function resolveGoogleCredentials(
  modelId: string,
  configService: ConfigService
): GoogleCredentials | null {
  const normalizedModelId = normalizeModelId(modelId)
  const [provider, model] = normalizedModelId.split('/')
  if (normalizeProviderId(provider) !== 'google' || !model) return null
  const apiKey = configService.getProviderApiKey('google')
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
  const normalizedModelId = normalizeModelId(modelId)
  const [provider, model] = normalizedModelId.split('/')
  if (!provider || !model) return null

  const runtimeConfig = getProviderRuntimeConfig(provider)
  if (!runtimeConfig || runtimeConfig.kind !== 'openai-compatible') {
    return null
  }

  const baseURL = configService.getProviderBaseURL(provider)
  if (!baseURL) {
    return null
  }

  if (!runtimeConfig.requiresApiKey) {
    return {
      baseURL,
      apiKey: configService.getProviderApiKey(provider),
      model
    }
  }

  const apiKey = configService.getProviderApiKey(provider)
  if (!apiKey) {
    return null
  }

  return {
    baseURL,
    apiKey,
    model
  }
}
