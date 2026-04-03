/**
 * Dispatch native agent loop by provider (OpenAI-compatible, Anthropic, Google).
 */

import type { ModelMessage, Tool } from '@ai-sdk/provider-utils'
import type { NativeAgentStreamPart } from './native-agent-stream-parts'
import type { ConfigService } from '../../services/config.service'
import type { ToolContext } from '../../services/tool-context'
import {
  resolveAnthropicCredentials,
  resolveGoogleCredentials,
  resolveOpenAICompatibleEndpoint
} from './resolve-openai-endpoint'
import { runNativeOpenAIAgentLoop } from './native-openai-agent-loop'
import { runNativeAnthropicAgentLoop } from './native-anthropic-agent-loop'
import { runNativeGoogleAgentLoop } from './native-google-agent-loop'

export type RunNativeAgentLoopParams = {
  modelId: string
  configService: ConfigService
  systemPrompt: string
  initialMessages: ModelMessage[]
  tools: Record<string, Tool>
  toolContext: ToolContext
  temperature: number
  maxSteps: number
  abortSignal?: AbortSignal
  prepareStepMessages?: (messages: ModelMessage[]) => ModelMessage[]
}

export async function* runNativeAgentLoop(
  params: RunNativeAgentLoopParams
): AsyncGenerator<NativeAgentStreamPart, void, undefined> {
  const { modelId, configService } = params

  const openai = resolveOpenAICompatibleEndpoint(modelId, configService)
  if (openai) {
    yield* runNativeOpenAIAgentLoop({
      endpoint: openai,
      systemPrompt: params.systemPrompt,
      initialMessages: params.initialMessages,
      tools: params.tools,
      toolContext: params.toolContext,
      temperature: params.temperature,
      maxSteps: params.maxSteps,
      abortSignal: params.abortSignal,
      prepareStepMessages: params.prepareStepMessages
    })
    return
  }

  const anthropic = resolveAnthropicCredentials(modelId, configService)
  if (anthropic) {
    yield* runNativeAnthropicAgentLoop({
      apiKey: anthropic.apiKey,
      model: anthropic.model,
      systemPrompt: params.systemPrompt,
      initialMessages: params.initialMessages,
      tools: params.tools,
      toolContext: params.toolContext,
      temperature: params.temperature,
      maxSteps: params.maxSteps,
      abortSignal: params.abortSignal,
      prepareStepMessages: params.prepareStepMessages
    })
    return
  }

  const google = resolveGoogleCredentials(modelId, configService)
  if (google) {
    yield* runNativeGoogleAgentLoop({
      apiKey: google.apiKey,
      model: google.model,
      systemPrompt: params.systemPrompt,
      initialMessages: params.initialMessages,
      tools: params.tools,
      toolContext: params.toolContext,
      temperature: params.temperature,
      maxSteps: params.maxSteps,
      abortSignal: params.abortSignal,
      prepareStepMessages: params.prepareStepMessages
    })
    return
  }

  throw new Error(`Native agent: no credentials for model ${modelId}`)
}
