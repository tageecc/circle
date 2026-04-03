/**
 * Frontend chat types — content parts from @ai-sdk/provider-utils (same wire as main process).
 */

import type { PastedImage } from '@/components/features/chat/chat-input'
import type {
  TextPart,
  ImagePart,
  FilePart,
  ToolCallPart,
  ToolResultPart
} from '@ai-sdk/provider-utils'

export type { TextPart, ImagePart, FilePart, ToolCallPart, ToolResultPart }

/**
 * ============================================
 * AI SDK 标准 ContentPart（纯业务数据）
 * ============================================
 */

// ✅ 使用 AI SDK 标准类型 + ReasoningPart
import type { ReasoningPart } from '@ai-sdk/provider-utils'

export type { ReasoningPart }

// ✅ 标准 content part 类型（不包含 UI 状态）
export type ContentPart =
  | TextPart
  | ImagePart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart

/**
 * ============================================
 * Message Metadata - UI 状态
 * ============================================
 */

export interface MessageMetadata {
  // 工具调用的运行时状态（按 toolCallId 索引）
  // ✅ 简化：只存储无法从消息推导的运行时状态
  toolStates?: Record<string, ToolUIState>

  // 流式状态
  streamingStates?: Record<string, StreamingState>
}

// 工具运行时状态
// ✅ 简化：移除state字段，从tool-result消息推导
export interface ToolUIState {
  terminalId?: string
  needsApproval?: boolean
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'skipped'
  streamOutput?: string
  isCancelled?: boolean
}

export interface StreamingState {
  isStreaming: boolean
  type: 'reasoning' | 'text'
}

/**
 * ============================================
 * 前端消息接口
 * ============================================
 */

export interface Message {
  id: number
  role: 'user' | 'assistant' | 'system' | 'tool'

  // ✅ AI SDK 标准 content（唯一数据源）
  content: string | ContentPart[]

  // ✅ UI 状态在 metadata 中
  metadata?: MessageMetadata

  timestamp: Date
  images?: PastedImage[]
}

/**
 * ============================================
 * Session 接口
 * ============================================
 */

/** Token usage (main process mirrors this shape; avoid coupling renderer to `ai` for this). */
export type LanguageModelUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
}

export interface SessionMetadata {
  lastUsage?: LanguageModelUsage
  totalUsage?: LanguageModelUsage
  [key: string]: unknown
}

export interface Session {
  id: string
  title: string
  modelId: string
  messages: Message[]
  createdAt: Date
  metadata?: SessionMetadata
}

/**
 * ============================================
 * 流式响应 Chunk
 * ============================================
 */

export interface StreamChunk {
  type:
    | 'text'
    | 'reasoning'
    | 'tool-call'
    | 'tool-result'
    | 'tool-output-stream'
    | 'error'
    | 'session-id'
    | 'message-start'
    | 'interrupt'
    | 'finish'
    | 'usage'
    | 'context-notice'
    | 'orchestration'
    | 'agent-step'
  v?: 1
  chainId?: string
  payloadRef?: string
  content?: string
  sessionId?: string
  messages?: Array<{
    id: number
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: any[]
    timestamp?: number
    images?: Array<{ id: string; dataUrl: string; name: string; size: number }>
  }>
  toolCall?: { id: string; name: string; args: any }
  toolResult?: {
    tool_call_id: string
    content: any
    isError?: boolean
    isApplied?: boolean
    appliedAction?: {
      type: 'file-edit'
      data: {
        toolName?: string
        filePath: string
        absolutePath: string
        oldContent: string
        newContent: string
        fileExists: boolean
        stats?: { linesAdded?: number; linesRemoved?: number; linesTotal?: number }
      }
    }
  }
  toolOutputStream?: {
    toolCallId: string
    terminalId: string
    output: string
    isError?: boolean
  }
  interrupt?: any
  error?: string
  finishReason?: string
  usage?: LanguageModelUsage

  contextNotice?: {
    prunedMessageCount: number
    toolResultsTruncated: boolean
    estimatedInputTokensAfter?: number
    conversationSummarized?: boolean
    aggressiveToolTruncation?: boolean
    longTextTruncated?: boolean
    reactiveRetry?: boolean
  }
  orchestration?: {
    protocolVersion: 1
    chainId: string
    maxSteps: number
    modelId: string
  }
  agentStep?: {
    chainId: string
    index: number
    phase: string
    toolName?: string
    toolCallId?: string
  }
}

/**
 * ============================================
 * 流控制器
 * ============================================
 */

export interface StreamControls {
  cleanup: () => void
  stop: () => void
}
