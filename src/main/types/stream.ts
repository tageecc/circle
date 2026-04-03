/**
 * Token usage on finish/usage chunks (matches AI SDK usage fields used by ChatService).
 * Defined locally so main process types do not depend on the `ai` package.
 */
export type LanguageModelUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
}

/** IPC / stream chunk schema version (Phase F). Bump when breaking shape changes. */
export const STREAM_CHUNK_PROTOCOL_VERSION = 1 as const

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
    /** Phase A: chain metadata + protocol version (Claude Code queryTracking-style) */
    | 'orchestration'
    /** Phase A: explicit agentic step boundary for UI/telemetry */
    | 'agent-step'

  /** Phase F: optional protocol version on every chunk */
  v?: typeof STREAM_CHUNK_PROTOCOL_VERSION

  // 文本内容
  content?: string

  /** Phase A: session chain id (correlates logs across one user turn's model↔tool loop) */
  chainId?: string

  /** Phase A: model round / tool invocation index within this chain */
  orchestration?: {
    protocolVersion: typeof STREAM_CHUNK_PROTOCOL_VERSION
    chainId: string
    maxSteps: number
    modelId: string
  }

  /** Phase A: step telemetry (CC-style explicit transitions) */
  agentStep?: {
    chainId: string
    /** Monotonic within this stream */
    index: number
    phase: 'tool_call' | 'tool_result' | 'model_finish' | 'stream_error'
    toolName?: string
    toolCallId?: string
  }

  /**
   * Phase F: huge payloads replaced by ref; use IPC `chat:get-stream-payload` to resolve.
   */
  payloadRef?: string

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
    /** Phase B: second attempt after deterministic shrink (reactive-style recovery) */
    reactiveRetry?: boolean
  }
}
