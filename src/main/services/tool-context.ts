import type { ToolCallOptions } from '@ai-sdk/provider-utils'

/**
 * 工具执行上下文
 * 通过 AI SDK 的 experimental_context 传递
 */
export interface ToolContext {
  sessionId: string
  workspaceRoot: string
  assistantMessageId: number // 当前助手消息ID（用于流式更新和审批状态持久化）
  abortSignal?: AbortSignal // 用于停止工具执行
  /** Set by ChatService — required for delegate_task / nested runs */
  modelId?: string
  /** 0 = main agent; nested sub-agent runs use 1+ */
  delegateDepth?: number
}

/**
 * 从 AI SDK 的 ToolCallOptions 中提取上下文
 * 这是 AI SDK v6 官方推荐的方式
 * @see https://v6.ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#context-experimental
 */
export function getToolContext(options: ToolCallOptions): ToolContext {
  const ctx = options.experimental_context as ToolContext | undefined
  if (!ctx) {
    throw new Error(
      'Tool context not available. Ensure experimental_context is passed to streamText.'
    )
  }
  return ctx
}
