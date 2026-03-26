import { Bot, MessageSquare, Clock } from 'lucide-react'
import { ChatContainerRoot, ChatContainerContent } from '@/components/ui/chat-container'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { ToolCall } from './tool-call'
import { PlanningIndicator } from './planning-indicator'
import { PendingEditsCard } from './pending-edits-card'
import { TodoQueue } from './todo-queue'
import { UserMessage } from './user-message'
import type { Session, Message as MessageType, ToolCallPart } from '@/types/chat'
import type { PendingFileEdit } from '@/types/ide'
import type { ToolCallData } from './tool-call'
import { getContentParts, getToolUIState } from '@/utils/message-adapter'

function convertToolCallToData(
  toolCall: ToolCallPart,
  message: MessageType,
  allMessages: MessageType[]
): ToolCallData {
  const uiState = getToolUIState(message, toolCall.toolCallId)

  let toolResult: any = undefined
  let isError = false

  const toolMessages = allMessages.filter((msg) => msg.role === 'tool')
  for (const toolMsg of toolMessages) {
    const parts = getContentParts(toolMsg)

    // 查找 tool-result
    const resultPart = parts.find(
      (p: any) => p.type === 'tool-result' && p.toolCallId === toolCall.toolCallId
    ) as any
    
    if (resultPart) {
      toolResult = resultPart.output?.value
      
      // 推导 isError：检查 value 中的 isError 标记
      if (typeof toolResult === 'string') {
        try {
          const parsed = JSON.parse(toolResult)
          isError = parsed.isError === true || parsed.success === false
        } catch {
          // 忽略解析错误
        }
      }
      
      break
    }
  }

  return {
    id: toolCall.toolCallId,
    name: toolCall.toolName,
    args: toolCall.input as Record<string, unknown>,
    result: toolResult,
    isError,
    isLoading: toolResult === undefined && !uiState?.isCancelled,
    isCancelled: uiState?.isCancelled,
    needsApproval: uiState?.needsApproval,
    approvalStatus: uiState?.approvalStatus,
    streamOutput: uiState?.streamOutput,
    terminalId: uiState?.terminalId
  }
}

interface ChatMessagesProps {
  currentSession: Session | undefined
  isSending: boolean
  pendingFileEdits?: PendingFileEdit[]
  onOpenFile?: (filePath: string) => void
  onAcceptFileEdit?: (absolutePath: string) => void
  onRejectFileEdit?: (absolutePath: string) => void
  onAcceptAllFileEdits?: () => void
  onRejectAllFileEdits?: () => void
  onApprovalDecision?: (toolCallId: string, decision: 'approve' | 'reject' | 'skip') => void
  onResubmitMessage?: (content: string) => void
}

/**
 * 聊天消息列表组件
 * 使用 AI Elements 组件渲染消息
 */
export function ChatMessages({
  currentSession,
  isSending,
  pendingFileEdits = [],
  onOpenFile,
  onAcceptFileEdit,
  onRejectFileEdit,
  onAcceptAllFileEdits,
  onRejectAllFileEdits,
  onApprovalDecision,
  onResubmitMessage
}: ChatMessagesProps) {
  // 只显示当前会话的 pending edits，避免跨会话串数据
  const sessionPendingEdits = currentSession
    ? pendingFileEdits.filter((edit) => edit.sessionId === currentSession.id)
    : []

  return (
    <ChatContainerRoot className="flex-1 overflow-x-hidden">
      {currentSession ? (
        <ChatContainerContent className="p-4">
          {/* Todo Queue */}
          <TodoQueue sessionId={currentSession.id} />

          {currentSession.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {(() => {
                const visibleMessages = currentSession.messages.filter((msg) => msg.role !== 'tool')
                return visibleMessages.map((message, messageIndex) => {
                const isLastMessage = messageIndex === visibleMessages.length - 1

                // 用户消息使用特殊组件处理（可编辑、可回退）
                if (message.role === 'user') {
                  return (
                    <UserMessage
                      key={message.id}
                      message={message}
                      sessionId={currentSession.id}
                      onResubmit={onResubmitMessage}
                    />
                  )
                }

                // 助手消息
                return (
                  <Message key={message.id} from={message.role as 'user' | 'assistant' | 'system'}>
                    <MessageContent>
                      {getContentParts(message).map((part, partIndex) => {
                        const isLatestPart =
                          isLastMessage && partIndex === getContentParts(message).length - 1
                        const isStreamingReasoning =
                          message.metadata?.streamingStates?.reasoning?.isStreaming

                        return (
                          <div key={partIndex}>
                            {part.type === 'reasoning' && (
                              <Reasoning isStreaming={isStreamingReasoning}>
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            )}

                            {part.type === 'tool-call' && (
                              <ToolCall
                                tool={convertToolCallToData(part, message, currentSession.messages)}
                                onOpenFile={onOpenFile}
                                onApprovalDecision={onApprovalDecision}
                                isLatest={isLatestPart}
                              />
                            )}

                            {part.type === 'text' && part.text && (
                              <MessageResponse className="prose prose-sm dark:prose-invert max-w-none">
                                {part.text}
                              </MessageResponse>
                            )}
                          </div>
                        )
                      })}

                      {/* Planning Indicator */}
                      {message.role === 'assistant' && isLastMessage && (
                        <PlanningIndicator message={message} isSending={isSending} />
                      )}

                      {/* Pending File Edits Card - 只显示当前会话的修改 */}
                      {message.role === 'assistant' &&
                        isLastMessage &&
                        !isSending &&
                        sessionPendingEdits.length > 0 && (
                          <PendingEditsCard
                            pendingEdits={sessionPendingEdits}
                            onAcceptAll={() => onAcceptAllFileEdits?.()}
                            onRejectAll={() => onRejectAllFileEdits?.()}
                            onAcceptFile={(absolutePath) => onAcceptFileEdit?.(absolutePath)}
                            onRejectFile={(absolutePath) => onRejectFileEdit?.(absolutePath)}
                            onOpenFile={(absolutePath) => onOpenFile?.(absolutePath)}
                          />
                        )}
                    </MessageContent>
                  </Message>
                )
              })
              })()}
            </div>
          )}
        </ChatContainerContent>
      ) : (
        <ChatContainerContent>
          <NoSessionState />
        </ChatContainerContent>
      )}
    </ChatContainerRoot>
  )
}

/**
 * 空状态 - 当前会话无消息时显示
 */
function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12">
      <div className="text-center space-y-6 max-w-xs">
        <div className="relative mx-auto w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary/20 via-primary/10 to-transparent blur-xl animate-pulse-soft" />
          <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-lg shadow-primary/10">
            <Bot className="size-9 text-primary" strokeWidth={1.5} />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">开始与 AI 对话</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            输入你的问题或想法，AI 助手将为你提供帮助
          </p>
        </div>
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <div className="size-1.5 rounded-full bg-primary/60" />
            <span>智能代码分析</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <div className="size-1.5 rounded-full bg-primary/60" />
            <span>问题解答</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <div className="size-1.5 rounded-full bg-primary/60" />
            <span>代码生成</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 无会话状态 - 没有当前会话时显示
 */
function NoSessionState() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12">
      <div className="text-center space-y-6 max-w-xs">
        <div className="relative mx-auto w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-full bg-linear-to-br from-muted-foreground/10 via-muted-foreground/5 to-transparent blur-xl" />
          <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-linear-to-br from-muted/30 to-muted/10 border border-border/30">
            <MessageSquare className="size-9 text-muted-foreground" strokeWidth={1.5} />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">创建新对话</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            点击右上角的 <span className="font-medium text-foreground">+</span> 按钮开始一个新的对话
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <Clock className="size-3.5" />
          <span>或从历史记录中选择</span>
        </div>
      </div>
    </div>
  )
}
