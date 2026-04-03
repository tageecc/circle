/**
 * Pre-prune conversation compaction (CC-style lightweight compact):
 * replace older turns with a single summary user message, then prune/truncate as usual.
 */

import { generateTextOneShot } from '../agent/llm-one-shot'
import type { CoreLikeMessage } from './context-budget.service'
import { computeMessagesTokenBudget, estimateMessageTokens } from './context-budget.service'
import { AGENT_HARNESS } from '../constants/service.constants'
import { logHarnessEvent } from './agent-harness-telemetry'
import type { ConfigService } from './config.service'

function flattenForSummary(messages: CoreLikeMessage[]): string {
  const lines: string[] = []
  for (const m of messages) {
    const body = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    lines.push(`[${m.role}]: ${body.slice(0, 120_000)}`)
  }
  return lines.join('\n\n')
}

export async function maybeSummarizeOlderMessagesForContext(params: {
  messages: CoreLikeMessage[]
  systemPrompt: string
  maxInputTokens: number
  reserveOutputTokens: number
  modelId: string
  configService: ConfigService
  abortSignal?: AbortSignal
}): Promise<{ messages: CoreLikeMessage[]; summarized: boolean }> {
  const {
    messages,
    systemPrompt,
    maxInputTokens,
    reserveOutputTokens,
    modelId,
    configService,
    abortSignal
  } = params

  const budget = computeMessagesTokenBudget({
    maxInputTokens,
    reserveOutputTokens,
    systemPrompt
  })

  const estimated = messages.reduce((s, m) => s + estimateMessageTokens(m), 0)

  const minTotal = AGENT_HARNESS.SUMMARY_MIN_MESSAGES
  const tailN = AGENT_HARNESS.SUMMARY_TAIL_MESSAGES
  const ratio = AGENT_HARNESS.SUMMARY_TRIGGER_BUDGET_RATIO

  if (messages.length < minTotal || estimated <= budget * ratio) {
    return { messages, summarized: false }
  }

  const head = messages.slice(0, -tailN)
  const plain = flattenForSummary(head)

  try {
    const text = await generateTextOneShot({
      modelId,
      configService,
      system:
        'You compress prior conversation for a coding assistant continuation. Preserve: file paths, shell commands, errors, agreed decisions, TODOs. Be dense; no preamble.',
      prompt: plain.slice(0, 200_000),
      maxOutputTokens: 2500,
      temperature: 0.2,
      abortSignal
    })

    const summaryBlock = text.trim()
    if (!summaryBlock) {
      return { messages, summarized: false }
    }

    const summaryMessage: CoreLikeMessage = {
      role: 'user',
      content: `<conversation_summary>\n${summaryBlock}\n</conversation_summary>`
    }

    const merged = [summaryMessage, ...messages.slice(-tailN)]

    logHarnessEvent('context.conversation_summarized', {
      head_messages: head.length,
      tail_kept: tailN,
      estimated_before: estimated
    })

    return { messages: merged, summarized: true }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { messages, summarized: false }
    }
    console.error('[ConversationCompact] summarize failed:', e)
    logHarnessEvent('context.conversation_summarize_failed', {
      message: e instanceof Error ? e.message : String(e)
    })
    return { messages, summarized: false }
  }
}
