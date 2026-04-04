/**
 * Context preparation + reactive recovery with automatic compaction and retry logic (AI-SDK adapted).
 */

import type { CoreLikeMessage } from './context-budget.service'
import { maybeSummarizeOlderMessagesForContext } from './conversation-compact.service'
import { pruneMessagesForBudget } from './context-budget.service'
import type { ConfigService } from './config.service'
import { logHarnessEvent } from './agent-harness-telemetry'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { microcompactOldToolResults } from './microcompact-messages.service'
import { AGENT_HARNESS } from '../constants/service.constants'

export type PrepareContextParams = {
  messages: CoreLikeMessage[]
  systemPrompt: string
  modelId: string
  configService: ConfigService
  maxInputTokens: number
  reserveOutputTokens: number
  summarizationEnabled: boolean
  abortSignal?: AbortSignal
}

export type PrepareContextResult = {
  messagesForModel: ModelMessage[]
  conversationSummarized: boolean
  pruned: ReturnType<typeof pruneMessagesForBudget>
}

/**
 * Single entry: summarize (optional) + prune — used before each model call attempt.
 */
export async function prepareMessagesForAgenticTurn(
  params: PrepareContextParams
): Promise<PrepareContextResult> {
  const {
    messages,
    systemPrompt,
    modelId,
    configService,
    maxInputTokens,
    reserveOutputTokens,
    summarizationEnabled,
    abortSignal
  } = params

  let budgetMessages = messages
  let conversationSummarized = false

  if (summarizationEnabled) {
    const compacted = await maybeSummarizeOlderMessagesForContext({
      messages: budgetMessages,
      systemPrompt,
      maxInputTokens,
      reserveOutputTokens,
      modelId,
      configService,
      abortSignal
    })
    budgetMessages = compacted.messages
    conversationSummarized = compacted.summarized
  }

  budgetMessages = microcompactOldToolResults(
    budgetMessages,
    AGENT_HARNESS.MICROCOMPACT_PRESERVE_LAST
  )

  const pruned = pruneMessagesForBudget({
    messages: budgetMessages,
    systemPrompt,
    maxInputTokens,
    reserveOutputTokens
  })

  return {
    messagesForModel: pruned.messages as ModelMessage[],
    conversationSummarized,
    pruned
  }
}

const OVERFLOW_HINTS = [
  'context length',
  'maximum context',
  'token limit',
  'too many tokens',
  'prompt is too long',
  '413',
  'context_length_exceeded',
  'invalid_request_error',
  'reduce the length'
]

export function isLikelyContextOverflowError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()
  return OVERFLOW_HINTS.some((h) => lower.includes(h))
}

/**
 * Reactive recovery: drop oldest half of messages (keep last N) + force summarize path on retry.
 * Apply deterministic context shrinking for one retry when context limit is exceeded.
 */
export function shrinkMessagesForReactiveRetry(
  messages: CoreLikeMessage[],
  tailKeep: number
): CoreLikeMessage[] {
  if (messages.length <= tailKeep) return messages
  const tail = messages.slice(-tailKeep)
  const dropped = messages.length - tailKeep
  logHarnessEvent('context.reactive_shrink', {
    dropped_messages: dropped,
    tail_kept: tailKeep
  })
  const summaryStub: CoreLikeMessage = {
    role: 'user',
    content:
      '<conversation_summary>[Earlier messages omitted due to context limit — continue from the following turns only.]</conversation_summary>'
  }
  return [summaryStub, ...tail]
}
