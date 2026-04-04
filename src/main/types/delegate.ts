/**
 * Delegate task progress event type (for IPC)
 */

export interface DelegateProgress {
  taskId: string
  sessionId: string
  filesExplored: number
  searches: number
  edits: number
  toolCalls: number
  currentOperation?: string
}
