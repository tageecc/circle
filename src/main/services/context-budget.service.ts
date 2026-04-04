/**
 * Context window budgeting with smart compaction strategy:
 * keep the latest user turn reliable, drop oldest history first, soften huge tool payloads.
 */

import { AGENT_HARNESS } from '../constants/service.constants'
import { logHarnessEvent } from './agent-harness-telemetry'

export type CoreLikeMessage = {
  role: string
  content: unknown
}

/** Heuristic tokenizer using AGENT_HARNESS.CHARS_PER_TOKEN (mixed EN/CN) */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / AGENT_HARNESS.CHARS_PER_TOKEN)
}

function contentToString(content: unknown): string {
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}

export function estimateMessageTokens(msg: CoreLikeMessage): number {
  return estimateTokens(contentToString(msg.content))
}

/** Token ceiling for the message list (system prompt counted separately). */
export function computeMessagesTokenBudget(params: {
  maxInputTokens: number
  reserveOutputTokens: number
  systemPrompt: string
}): number {
  const { maxInputTokens, reserveOutputTokens, systemPrompt } = params
  return Math.max(8_000, maxInputTokens - reserveOutputTokens - estimateTokens(systemPrompt))
}

function truncationSuffix(removedChars: number): string {
  return `\n\n[… truncated ${removedChars} chars for context budget]`
}

/** Heuristic input limits by provider (conservative). */
export function getDefaultMaxInputTokensForModel(modelId: string): number {
  const lower = modelId.toLowerCase()
  if (lower.includes('anthropic') || lower.includes('claude')) return 190_000
  if (lower.includes('gemini') || lower.includes('google')) return 900_000
  if (lower.includes('gpt-5')) return 900_000
  if (lower.includes('gpt-4') || lower.includes('openai')) return 120_000
  if (lower.includes('qwen') || lower.includes('deepseek')) return 120_000
  return AGENT_HARNESS.DEFAULT_MAX_INPUT_TOKENS
}

export type PruneResult = {
  messages: CoreLikeMessage[]
  prunedCount: number
  toolResultsTruncated: boolean
  aggressiveToolTruncation: boolean
  longTextTruncated: boolean
  estimatedInputTokensAfter: number
}

function cloneMessages(messages: CoreLikeMessage[]): CoreLikeMessage[] {
  return JSON.parse(JSON.stringify(messages)) as CoreLikeMessage[]
}

/**
 * Shorten oversized tool result strings inside message content (role tool / assistant parts).
 */
export function softTruncateToolResultsInMessages(
  messages: CoreLikeMessage[],
  maxChars: number
): { messages: CoreLikeMessage[]; truncated: boolean } {
  let truncated = false
  const out = messages.map((m) => {
    if (!Array.isArray(m.content)) return m
    const newParts = (m.content as Array<Record<string, unknown>>).map((part) => {
      if (part.type === 'tool-result' && part.output && typeof part.output === 'object') {
        const o = part.output as { type?: string; value?: unknown }
        const val = o.value
        const str = typeof val === 'string' ? val : val !== undefined ? JSON.stringify(val) : ''
        if (str.length > maxChars) {
          truncated = true
          const cut = str.slice(0, maxChars)
          return {
            ...part,
            output: {
              ...o,
              type: 'text' as const,
              value: `${cut}${truncationSuffix(str.length - maxChars)}`
            }
          }
        }
      }
      return part
    })
    return { ...m, content: newParts }
  })
  return { messages: out, truncated }
}

const TEXT_LIKE_PART_TYPES = new Set(['text', 'reasoning'])

/**
 * Cap huge pasted code or assistant text blobs (tool results are not the only risk).
 */
export function softTruncateLongTextInMessages(
  messages: CoreLikeMessage[],
  maxChars: number
): { messages: CoreLikeMessage[]; truncated: boolean } {
  let truncated = false
  const out = messages.map((m) => {
    if (typeof m.content === 'string') {
      if (m.content.length <= maxChars) return m
      truncated = true
      const cut = m.content.slice(0, maxChars)
      return {
        ...m,
        content: `${cut}${truncationSuffix(m.content.length - maxChars)}`
      }
    }
    if (!Array.isArray(m.content)) return m
    const newParts = (m.content as Array<Record<string, unknown>>).map((part) => {
      const t = part.type
      if (typeof t === 'string' && TEXT_LIKE_PART_TYPES.has(t)) {
        const text = typeof part.text === 'string' ? part.text : ''
        if (text.length > maxChars) {
          truncated = true
          const cut = text.slice(0, maxChars)
          return {
            ...part,
            text: `${cut}${truncationSuffix(text.length - maxChars)}`
          }
        }
      }
      return part
    })
    return { ...m, content: newParts }
  })
  return { messages: out, truncated }
}

export function pruneMessagesForBudget(params: {
  messages: CoreLikeMessage[]
  systemPrompt: string
  maxInputTokens: number
  reserveOutputTokens: number
}): PruneResult {
  const { systemPrompt, maxInputTokens, reserveOutputTokens } = params
  let messages = cloneMessages(params.messages)
  const budget = computeMessagesTokenBudget({
    maxInputTokens,
    reserveOutputTokens,
    systemPrompt
  })

  const minPreserve = AGENT_HARNESS.MIN_MESSAGES_TO_PRESERVE
  let prunedCount = 0
  let toolResultsTruncated = false
  let aggressiveToolTruncation = false
  let longTextTruncated = false

  const sumEstimate = (ms: CoreLikeMessage[]) =>
    ms.reduce((s, m) => s + estimateMessageTokens(m), 0)

  const textPass = softTruncateLongTextInMessages(
    messages,
    AGENT_HARNESS.MAX_MESSAGE_TEXT_CHARS_IN_CONTEXT
  )
  messages = textPass.messages
  if (textPass.truncated) {
    longTextTruncated = true
    logHarnessEvent('context.long_text_truncated', {
      max_chars: AGENT_HARNESS.MAX_MESSAGE_TEXT_CHARS_IN_CONTEXT
    })
  }

  // 1) Soften huge tool payloads first (tool budget before dropping turns)
  const firstPass = softTruncateToolResultsInMessages(
    messages,
    AGENT_HARNESS.MAX_TOOL_RESULT_CHARS_IN_CONTEXT
  )
  messages = firstPass.messages
  if (firstPass.truncated) {
    toolResultsTruncated = true
    logHarnessEvent('context.tool_results_truncated', {
      max_chars: AGENT_HARNESS.MAX_TOOL_RESULT_CHARS_IN_CONTEXT,
      phase: 'initial'
    })
  }

  let estimated = sumEstimate(messages)

  logHarnessEvent('context.budget_estimate', {
    estimated_messages: estimated,
    budget,
    message_count: messages.length
  })

  // 2) Drop oldest turns while above budget, keeping at least minPreserve messages
  while (estimated > budget && messages.length > minPreserve) {
    const removed = messages.shift()!
    prunedCount++
    estimated -= estimateMessageTokens(removed)
  }

  // 3) Aggressive tool shrink before discarding below minPreserve
  if (estimated > budget && messages.length <= minPreserve) {
    const aggressive = softTruncateToolResultsInMessages(
      messages,
      AGENT_HARNESS.MAX_TOOL_RESULT_CHARS_AGGRESSIVE
    )
    messages = aggressive.messages
    if (aggressive.truncated) {
      toolResultsTruncated = true
      aggressiveToolTruncation = true
      logHarnessEvent('context.tool_results_truncated', {
        max_chars: AGENT_HARNESS.MAX_TOOL_RESULT_CHARS_AGGRESSIVE,
        phase: 'aggressive'
      })
    }
    estimated = sumEstimate(messages)
  }

  // 4) Last resort: prune down to a single message (current user turn only if structure allows)
  while (estimated > budget && messages.length > 1) {
    const removed = messages.shift()!
    prunedCount++
    estimated -= estimateMessageTokens(removed)
  }

  if (prunedCount > 0) {
    logHarnessEvent('context.messages_pruned', {
      pruned_count: prunedCount,
      estimated_after: estimated
    })
  }

  return {
    messages,
    prunedCount,
    toolResultsTruncated,
    aggressiveToolTruncation,
    longTextTruncated,
    estimatedInputTokensAfter: estimateTokens(systemPrompt) + estimated
  }
}
