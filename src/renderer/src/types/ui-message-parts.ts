/**
 * UI message part types for ai-elements (previously imported from `ai`).
 * Local definitions so the renderer does not depend on the `ai` npm package.
 */

/** Matches AI SDK UIMessage.role for components that only style by role. */
export type UIMessageRole = 'system' | 'user' | 'assistant'

/** File attachment part in a UI message. */
export type FileUIPart = {
  type: 'file'
  mediaType: string
  filename?: string
  url: string
  providerMetadata?: unknown
}

/** Document source part in a UI message. */
export type SourceDocumentUIPart = {
  type: 'source-document'
  sourceId: string
  mediaType: string
  title: string
  filename?: string
  providerMetadata?: unknown
}

/** Tool invocation lifecycle in tool UI components. */
export type ToolUIPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied'

/**
 * Tool UI part for ai-elements (headers, input/output panels). Matches AI SDK tool invocation fields loosely.
 */
export type ToolUIPart = {
  type: string
  state: ToolUIPartState
  input?: unknown
  output?: unknown
  errorText?: string
}
