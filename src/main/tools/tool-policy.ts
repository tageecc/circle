/**
 * Tool concurrency policy for determining which tools can run in parallel.
 * AI SDK executes tools per provider rules; we document + telemetry conflicting patterns.
 */

import { logHarnessEvent } from '../services/agent-harness-telemetry'

/** Read-heavy tools: safe to parallelize when the model emits multiple in one round */
const PARALLEL_SAFE = new Set<string>([
  'read_file',
  'list_dir',
  'glob_file_search',
  'grep',
  'codebase_search',
  'read_lints',
  'get_skill_details',
  'task_list',
  'task_get',
  'task_stop'
])

/** Mutating / side-effect tools: should not race with each other */
const EXCLUSIVE = new Set<string>([
  'edit_file',
  'delete_file',
  'run_terminal_cmd',
  'update_memory',
  'todo_write',
  'ask_user',
  'delegate_task'
])

export type ToolConcurrencyGroup = 'parallel_safe' | 'exclusive'

export function getToolConcurrencyGroup(toolName: string): ToolConcurrencyGroup {
  if (EXCLUSIVE.has(toolName)) return 'exclusive'
  if (PARALLEL_SAFE.has(toolName)) return 'parallel_safe'
  return 'exclusive'
}

/**
 * If multiple exclusive tools appear in the same assistant message, log (future: serialize execution via custom middleware).
 */
export function reportExclusiveToolBatchIfRisky(toolNames: string[]): void {
  const exclusive = toolNames.filter((n) => getToolConcurrencyGroup(n) === 'exclusive')
  if (exclusive.length <= 1) return
  logHarnessEvent('tools.exclusive_batch_detected', {
    tools: exclusive.slice(0, 12).join(','),
    count: exclusive.length
  })
}
