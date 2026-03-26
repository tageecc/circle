/**
 * Message helpers for AI SDK-shaped content.
 *
 * - `content` is the single source of truth.
 * - `metadata` holds UI-only state.
 */

import type { Message, ContentPart, ToolCallPart, ToolUIState } from '@/types/chat'

/** Normalize `content` to a `ContentPart[]` (string or array). */
export function getContentParts(message: Message): ContentPart[] {
  if (!message.content) {
    return []
  }
  if (typeof message.content === 'string') {
    return [{ type: 'text', text: message.content }]
  }
  return message.content
}

/** Replace message `content` with the given parts. */
export function setContentParts(message: Message, parts: ContentPart[]): Message {
  return {
    ...message,
    content: parts
  }
}

/** Concatenate all text parts in order. */
export function getMessageText(message: Message): string {
  let out = ''
  let first = true
  for (const part of getContentParts(message)) {
    if (part.type !== 'text') continue
    if (!first) out += '\n'
    out += part.text
    first = false
  }
  return out
}

/** All tool-call parts from `content`. */
export function getToolCalls(message: Message): ToolCallPart[] {
  return getContentParts(message).filter((part): part is ToolCallPart => part.type === 'tool-call')
}

/** Runtime UI state for a tool call, if any. */
export function getToolUIState(message: Message, toolCallId: string): ToolUIState | undefined {
  return message.metadata?.toolStates?.[toolCallId]
}

/** Merge partial UI state for a tool call id. */
export function setToolUIState(
  message: Message,
  toolCallId: string,
  state: Partial<ToolUIState>
): Message {
  const prev = message.metadata?.toolStates
  return {
    ...message,
    metadata: {
      ...message.metadata,
      toolStates: {
        ...prev,
        [toolCallId]: { ...prev?.[toolCallId], ...state }
      }
    }
  }
}
