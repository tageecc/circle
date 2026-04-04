/**
 * Extension points for pre/post/stop hooks in agent sessions.
 */

import type { AgentSessionContext } from './agent-session.types'

export type BeforeModelCallPayload = AgentSessionContext & {
  estimatedInputTokens?: number
  messageCount: number
}

export type AfterToolResultPayload = AgentSessionContext & {
  toolName: string
  toolCallId: string
  /** Raw tool output (may be large — hooks should not stringify blindly) */
  output: unknown
}

export type OnSessionIdlePayload = AgentSessionContext & {
  finishReason?: string
}

export type SessionHooks = {
  beforeModelCall?: (p: BeforeModelCallPayload) => void | Promise<void>
  afterToolResult?: (p: AfterToolResultPayload) => void | Promise<void>
  onSessionIdle?: (p: OnSessionIdlePayload) => void | Promise<void>
}

let globalHooks: SessionHooks = {}

export function setSessionHooks(hooks: SessionHooks): void {
  globalHooks = hooks
}

export function getSessionHooks(): SessionHooks {
  return globalHooks
}
