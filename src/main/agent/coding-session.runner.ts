/**
 * Coding session stream helpers with explicit chain and step event tracking.
 */

import { randomUUID } from 'crypto'
import { STREAM_CHUNK_PROTOCOL_VERSION } from '../types/stream'
import type { StreamChunk } from '../types/stream'
import type { OrchestrationPayload } from './agent-session.types'
import type { AgentStepPayload } from './agent-session.types'

export function createChainId(): string {
  return randomUUID()
}

export function withProtocolChunk(chunk: StreamChunk, chainId: string): StreamChunk {
  return { ...chunk, v: STREAM_CHUNK_PROTOCOL_VERSION, chainId }
}

export function buildOrchestrationChunk(
  payload: OrchestrationPayload,
  chainId: string
): StreamChunk {
  return {
    type: 'orchestration',
    v: STREAM_CHUNK_PROTOCOL_VERSION,
    chainId,
    orchestration: payload
  }
}

export function buildAgentStepChunk(payload: AgentStepPayload, chainId: string): StreamChunk {
  return {
    type: 'agent-step',
    v: STREAM_CHUNK_PROTOCOL_VERSION,
    chainId,
    agentStep: {
      chainId: payload.chainId,
      index: payload.index,
      phase: payload.phase,
      toolName: payload.toolName,
      toolCallId: payload.toolCallId
    }
  }
}
