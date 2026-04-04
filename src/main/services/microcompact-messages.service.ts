/**
 * Micro-compact old tool results to preserve more conversation history.
 * Replaces bulky tool-result text in messages *older than the tail window* so prune drops less history.
 */

import type { CoreLikeMessage } from './context-budget.service'
import { AGENT_HARNESS } from '../constants/service.constants'
import { logHarnessEvent } from './agent-harness-telemetry'

/** Tools whose outputs are safe to collapse to a placeholder when far from the tail */
const MICROCOMPACT_TOOL_NAMES = new Set([
  'read_file',
  'grep',
  'glob_file_search',
  'list_dir',
  'codebase_search',
  'read_lints',
  'run_terminal_cmd',
  'get_skill_details'
])

const PLACEHOLDER =
  '[Earlier tool output omitted for context — call the tool again if you need it.]'

function compactToolMessageContent(content: unknown): { content: unknown; changed: boolean } {
  if (!Array.isArray(content)) return { content, changed: false }
  let changed = false
  const next = content.map((part: Record<string, unknown>) => {
    if (part.type !== 'tool-result') return part
    const name = part.toolName as string | undefined
    if (!name || !MICROCOMPACT_TOOL_NAMES.has(name)) return part
    const out = part.output as { type?: string; value?: unknown } | undefined
    if (!out) return part
    const val = out.value
    const str = typeof val === 'string' ? val : val !== undefined ? JSON.stringify(val) : ''
    if (str.length < 2_000) return part
    changed = true
    return {
      ...part,
      output: {
        type: 'text' as const,
        value: PLACEHOLDER
      }
    }
  })
  return { content: next, changed }
}

/**
 * Apply micro-compact to all but the last `preserveLast` messages.
 */
export function microcompactOldToolResults(
  messages: CoreLikeMessage[],
  preserveLast: number = AGENT_HARNESS.MICROCOMPACT_PRESERVE_LAST
): CoreLikeMessage[] {
  if (messages.length <= preserveLast) return messages

  let replacements = 0
  const head = messages.slice(0, -preserveLast).map((m) => {
    if (m.role !== 'tool') return m
    const { content, changed } = compactToolMessageContent(m.content)
    if (changed) replacements++
    return { ...m, content }
  })
  const tail = messages.slice(-preserveLast)

  if (replacements > 0) {
    logHarnessEvent('context.microcompact_tool_results', {
      replacements,
      preserve_last: preserveLast
    })
  }

  return [...head, ...tail]
}
