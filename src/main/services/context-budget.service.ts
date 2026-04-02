/**
 * Context window budgeting — inspired by Claude Code's compaction mindset:
 * keep the latest user turn reliable, drop oldest history first, soften huge tool payloads.
 */

import { AGENT_HARNESS } from '../constants/service.constants'
import { logHarnessEvent } from './agent-harness-telemetry'

export type CoreLikeMessage = {
  role: string
  content: unknown
}

/** ~4 chars per token for mixed EN/CN; conservative for cost control */
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

/** Heuristic input limits by provider (conservative). */
export function getDefaultMaxInputTokensForModel(modelId: string): number {
  const lower = modelId.toLowerCase()
  if (lower.includes('anthropic') || lower.includes('claude')) return 190_000
  if (lower.includes('gemini') || lower.includes('google')) return 900_000
  if (lower.includes('gpt-4') || lower.includes('openai')) return 120_000
  if (lower.includes('qwen') || lower.includes('deepseek')) return 120_000
  return AGENT_HARNESS.DEFAULT_MAX_INPUT_TOKENS
}

export type PruneResult = {
  messages: CoreLikeMessage[]
  prunedCount: number
  toolResultsTruncated: boolean
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
              value: `${cut}\n\n[… truncated ${str.length - maxChars} chars for context budget]`
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

export function pruneMessagesForBudget(params: {
  messages: CoreLikeMessage[]
  systemPrompt: string
  maxInputTokens: number
  reserveOutputTokens: number
}): PruneResult {
  const { systemPrompt, maxInputTokens, reserveOutputTokens } = params
  let messages = cloneMessages(params.messages)
  const budget = Math.max(
    8_000,
    maxInputTokens - reserveOutputTokens - estimateTokens(systemPrompt)
  )

  let estimated = messages.reduce((s, m) => s + estimateMessageTokens(m), 0)
  let prunedCount = 0

  logHarnessEvent('context.budget_estimate', {
    estimated_messages: estimated,
    budget,
    message_count: messages.length
  })

  while (estimated > budget && messages.length > 1) {
    const removed = messages.shift()!
    prunedCount++
    estimated -= estimateMessageTokens(removed)
  }

  let toolResultsTruncated = false
  if (estimated > budget) {
    const soft = softTruncateToolResultsInMessages(
      messages,
      AGENT_HARNESS.MAX_TOOL_RESULT_CHARS_IN_CONTEXT
    )
    messages = soft.messages
    toolResultsTruncated = soft.truncated
    estimated = messages.reduce((s, m) => s + estimateMessageTokens(m), 0)
    if (toolResultsTruncated) {
      logHarnessEvent('context.tool_results_truncated', {
        max_chars: AGENT_HARNESS.MAX_TOOL_RESULT_CHARS_IN_CONTEXT
      })
    }
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
    estimatedInputTokensAfter: estimateTokens(systemPrompt) + estimated
  }
}
