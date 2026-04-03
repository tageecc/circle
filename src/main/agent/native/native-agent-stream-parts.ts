import type { LanguageModelUsage } from '../../types/stream'

/**
 * Discriminated union for chunks yielded by native agent loops (OpenAI-compatible, Anthropic, Google).
 * Aligns with the subset of AI SDK TextStreamPart shapes consumed by ChatService.
 */
export type NativeAgentStreamPart =
  | { type: 'start-step'; request: Record<string, unknown> }
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-start' }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'reasoning-end' }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      input: unknown
      dynamic?: boolean
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      input: unknown
      output: unknown
      dynamic?: boolean
    }
  | {
      type: 'tool-error'
      toolCallId: string
      toolName: string
      input: unknown
      error: unknown
      dynamic?: boolean
    }
  | {
      type: 'finish'
      finishReason: string
      rawFinishReason?: string
      totalUsage?: LanguageModelUsage
    }
  | { type: 'error'; error: unknown }
