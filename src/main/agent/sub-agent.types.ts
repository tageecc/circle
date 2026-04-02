/**
 * Sub-agent / sidechain task (Claude Code AgentTool / runAgent parity — data model only).
 */

import type { AgentChainId } from './agent-session.types'

export type TaskRunId = string

export type SubAgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

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
}
