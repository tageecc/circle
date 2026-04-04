/**
 * Agent session orchestration types for query loop and tracking.
 */

import { STREAM_CHUNK_PROTOCOL_VERSION } from '../types/stream'

export type AgentChainId = string

export type AgentStepPhase = 'tool_call' | 'tool_result' | 'model_finish' | 'stream_error'

export type AgentStepPayload = {
  chainId: AgentChainId
  index: number
  phase: AgentStepPhase
  toolName?: string
  toolCallId?: string
}

export type OrchestrationPayload = {
  protocolVersion: typeof STREAM_CHUNK_PROTOCOL_VERSION
  chainId: AgentChainId
  maxSteps: number
  modelId: string
}

/** Passed through the coding session for hooks + telemetry */
export type AgentSessionContext = {
  chainId: AgentChainId
  sessionId: string
  workspaceRoot: string
  modelId: string
}
