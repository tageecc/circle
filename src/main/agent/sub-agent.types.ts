/**
 * Sub-agent / sidechain task data model for tracking delegated agent runs.
 */

import type { AgentChainId } from './agent-session.types'

export type TaskRunId = string

export type SubAgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped'

export type SubAgentTask = {
  id: TaskRunId
  parentSessionId: string
  /** Optional parent chain that spawned this task */
  parentChainId?: AgentChainId
  description: string
  createdAt: number
  status: SubAgentTaskStatus
  /** Future: forked message list path or blob ref */
  resultSummary?: string
  /** Whether the task was launched in detached/background mode */
  background?: boolean
  /** Subagent type (general, review, security, etc.) */
  subagentType?: string
  subagentName?: string
  /** Progress tracking */
  startedAt?: number
  completedAt?: number
  durationMs?: number
  progress?: {
    filesExplored: number
    searches: number
    edits: number
    toolCalls: number
  }
  currentOperation?: string
}
