import type { LanguageModelUsage } from 'ai'

/**
 * HITL 中断数据
 */
export interface InterruptData {
  toolCallId: string
  toolName: string
  args: any
  sessionId: string
  messageId: number
}

export interface StreamChunk {
  type:
    | 'text'
    | 'reasoning'
    | 'tool-call'
    | 'tool-result'
    | 'interrupt'
    | 'tool-executing'
    | 'tool-executed'
    | 'custom'
    | 'completed'
    | 'session-id'
    | 'message-start'
    | 'error'
    | 'usage'
    | 'context-notice'

  // 文本内容
  content?: string

  // 会话ID
  sessionId?: string

  // 创建的消息列表（用于 message-start）
  messages?: Array<{
    id: number
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: any[]
    timestamp?: number
    images?: Array<{ id: string; dataUrl: string; name: string; size: number }>
  }>

  // 工具调用信息
  toolCall?: {
    id: string
    name: string
    args: any
  }

  // 工具执行结果
  toolResult?: {
    tool_call_id: string
    content: any
    isError?: boolean
    // Cursor 风格：已应用（直接写入磁盘），保存原始内容用于 undo
    isApplied?: boolean
    appliedAction?: {
      type: 'file-edit'
      data: {
        filePath: string
        absolutePath: string
        oldContent: string
        newContent: string
        fileExists: boolean
        stats?: { linesAdded?: number; linesRemoved?: number; linesTotal?: number }
      }
    }
  }

  // HITL中断信息（统一格式）
  interrupt?: InterruptData

  // 错误信息
  error?: string

  // Token usage
  usage?: LanguageModelUsage

  /** When older turns were dropped or tool payloads truncated for context budget */
  contextNotice?: {
    prunedMessageCount: number
    toolResultsTruncated: boolean
    estimatedInputTokensAfter?: number
    /** Older turns were replaced by an LLM summary block */
    conversationSummarized?: boolean
    aggressiveToolTruncation?: boolean
    longTextTruncated?: boolean
  }
}
