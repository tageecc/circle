import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { ChatInput, type PastedImage, type Attachment } from './chat-input'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { MessageQueue } from './message-queue'
import { UserQuestionDialog } from './user-question-dialog'
import { PlanModeIndicator } from './plan-mode-indicator'
import { ExitPlanApprovalDialog } from './exit-plan-approval-dialog'
import { DelegateTaskCard } from './delegate-task-card'
import { useChatMessages } from '@/hooks/use-chat-messages'
import type { PendingFileEdit } from '@/types/ide'
import { useChatSession } from '@/hooks/use-chat-session'
import { useMessageQueueStore, type QueuedMessage } from '@/stores/message-queue.store'
import { getModelInfo } from '@/constants/models'

interface ChatSidebarProps {
  workspaceRoot: string | null
  pendingFileEdits?: PendingFileEdit[]
  onOpenFile?: (filePath: string) => void
  onAddPendingFileEdit?: (edit: {
    toolCallId: string
    sessionId: string
    toolName: string
    filePath: string
    absolutePath: string
    oldContent: string
    newContent: string
    language?: string
    timestamp: number
  }) => void
  onAcceptFileEdit?: (absolutePath: string) => void
  onRejectFileEdit?: (absolutePath: string) => void
  onAcceptAllFileEdits?: (sessionId?: string) => void
  onRejectAllFileEdits?: (sessionId?: string) => void
  onClearSessionPendingEdits?: (sessionId: string) => void // 会话删除时清理
  onInitialized?: () => void // Chat 初始化完成回调（用于保持组件实例存活）
}

export function ChatSidebar({
  workspaceRoot,
  pendingFileEdits = [],
  onOpenFile,
  onAcceptFileEdit,
  onRejectFileEdit,
  onAcceptAllFileEdits,
  onRejectAllFileEdits,
  onClearSessionPendingEdits,
  onInitialized
}: ChatSidebarProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')

  // Plan Mode state
  const [planModeState, setPlanModeState] = useState<
    Record<string, { mode: 'default' | 'plan'; planFilePath?: string }>
  >({})
  const [pendingPlanApproval, setPendingPlanApproval] = useState<{
    approvalId: string
    planContent: string
    planFilePath: string
  } | null>(null)

  // Delegate Task state - using SubAgentTask type from backend
  type DelegateTaskState = Omit<
    {
      id: string
      description: string
      subagentType?: string
      subagentName?: string
      icon?: string
      color?: string
      status: 'pending' | 'running' | 'completed' | 'failed'
      createdAt: number
      startedAt?: number
      completedAt?: number
      progress: {
        filesExplored: number
        searches: number
        edits: number
        toolCalls: number
      }
      currentOperation?: string
      result?: string
      error?: string
      durationMs?: number
    },
    never
  >

  const [delegateTasks, setDelegateTasks] = useState<Record<string, DelegateTaskState>>({})

  // 会话管理
  const {
    sessions,
    currentSession,
    currentSessionId,
    deleteSession,
    markSessionAsLoaded,
    openSession,
    closeSessionTab,
    openSessionIds,
    createNewSession
  } = useChatSession(workspaceRoot)

  const maxTokens = useMemo(() => {
    if (!selectedModel) return undefined
    const modelInfo = getModelInfo(selectedModel, selectedProvider)
    return modelInfo?.contextWindow
  }, [selectedModel, selectedProvider])

  const usageData = useMemo(() => {
    const { lastUsage, totalUsage } = currentSession?.metadata || {}
    return {
      usedTokens: lastUsage?.totalTokens || 0,
      usage: (totalUsage || lastUsage) as any
    }
  }, [currentSession])

  // 消息处理
  const {
    isStreaming,
    sendMessage,
    stopStreaming,
    onApprovalDecision,
    userQuestion,
    submitUserQuestionAnswer
  } = useChatMessages(currentSessionId, markSessionAsLoaded)

  // 消息队列处理标志
  const isProcessingQueue = useRef(false)

  // 标记 Chat 已初始化
  useEffect(() => {
    onInitialized?.()
  }, [onInitialized])

  // 自动处理队列：当 isStreaming 变为 false 时，检查队列
  useEffect(() => {
    // 如果正在流式响应或正在处理队列，跳过
    if (isStreaming || isProcessingQueue.current) return

    const currentQueue = useMessageQueueStore.getState().getSessionQueue(currentSessionId)
    if (currentQueue.length === 0) return

    // 标记正在处理
    isProcessingQueue.current = true

    // 延迟发送，确保 React 批量更新完成
    const timer = setTimeout(async () => {
      const nextMessage = useMessageQueueStore.getState().dequeue(currentSessionId)

      if (nextMessage) {
        try {
          await sendMessage(
            nextMessage.content,
            `${nextMessage.provider}/${nextMessage.model}`,
            nextMessage.images,
            nextMessage.attachments || []
          )
        } catch (error) {
          console.error('队列消息发送失败:', error)
        }
      }

      isProcessingQueue.current = false
    }, 200)

    return () => {
      clearTimeout(timer)
      // ✅ cleanup 时重置标志，避免状态不一致
      isProcessingQueue.current = false
    }
  }, [isStreaming, currentSessionId, sendMessage])

  // 创建新会话
  const handleNewSession = async () => {
    await createNewSession()
    setInputValue('')
    setPastedImages([])
    setAttachments([])
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      onClearSessionPendingEdits?.(sessionId)
      await deleteSession(sessionId)

      toast.success(t('chat.delete_chat_success'))
    } catch (error) {
      console.error('删除会话失败:', error)
      toast.error(t('chat.delete_chat_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() && pastedImages.length === 0 && attachments.length === 0) {
      return
    }

    const message = inputValue.trim()
    const images = [...pastedImages]
    const files = [...attachments]

    setInputValue('')
    setPastedImages([])
    setAttachments([])

    // 如果正在发送，加入队列
    if (isStreaming) {
      useMessageQueueStore.getState().enqueue({
        content: message,
        images,
        attachments: files,
        provider: selectedProvider,
        model: selectedModel,
        sessionId: currentSessionId
      })
      return
    }

    // 否则直接发送
    const modelId = `${selectedProvider}/${selectedModel}`
    await sendMessage(message, modelId, images, files)
  }

  // 强制发送队列消息（打断当前对话）
  const handleSendNow = async (queuedMessage: QueuedMessage) => {
    // 从队列中移除
    useMessageQueueStore.getState().removeFromQueue(queuedMessage.id)

    // 停止当前流式响应
    if (isStreaming) {
      stopStreaming()
      // ✅ 等待足够时间让旧流完全停止，避免状态冲突
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // 立即发送到队列消息的目标 session
    const modelId = `${queuedMessage.provider}/${queuedMessage.model}`
    await sendMessage(
      queuedMessage.content,
      modelId,
      queuedMessage.images,
      queuedMessage.attachments || [],
      queuedMessage.sessionId || undefined
    )
  }

  // Listen for Plan Mode and Delegate Task events
  useEffect(() => {
    const handleModeChanged = (data: {
      sessionId: string
      mode: 'default' | 'plan'
      planFilePath: string | null
    }) => {
      setPlanModeState((prev) => ({
        ...prev,
        [data.sessionId]: {
          mode: data.mode,
          planFilePath: data.planFilePath || undefined
        }
      }))
    }

    const handlePlanApprovalRequired = (data: {
      approvalId: string
      sessionId: string
      assistantMessageId: number
      planContent: string
      planFilePath: string
    }) => {
      setPendingPlanApproval({
        approvalId: data.approvalId,
        planContent: data.planContent,
        planFilePath: data.planFilePath
      })
    }

    window.api.on('session:mode-changed', handleModeChanged)
    window.api.on('plan:approval-required', handlePlanApprovalRequired)

    // Delegate task event handlers
    const handleDelegateStart = (data: {
      taskId: string
      sessionId: string
      description: string
      subagentType: string
      subagentName: string
      icon: string
      color: string
    }) => {
      setDelegateTasks((prev) => ({
        ...prev,
        [data.taskId]: {
          id: data.taskId,
          description: data.description,
          subagentType: data.subagentType,
          subagentName: data.subagentName,
          icon: data.icon,
          color: data.color,
          status: 'running',
          createdAt: Date.now(),
          startedAt: Date.now(),
          progress: {
            filesExplored: 0,
            searches: 0,
            edits: 0,
            toolCalls: 0
          }
        }
      }))
    }

    const handleDelegateProgress = (data: {
      taskId: string
      sessionId: string
      filesExplored: number
      searches: number
      edits: number
      toolCalls: number
      currentOperation?: string
    }) => {
      setDelegateTasks((prev) => {
        const task = prev[data.taskId]
        if (!task) return prev
        return {
          ...prev,
          [data.taskId]: {
            ...task,
            progress: {
              filesExplored: data.filesExplored,
              searches: data.searches,
              edits: data.edits,
              toolCalls: data.toolCalls
            },
            currentOperation: data.currentOperation
          }
        }
      })
    }

    const handleDelegateComplete = (data: {
      taskId: string
      sessionId: string
      result?: string
      error?: string
      durationMs: number
      progress?: {
        filesExplored: number
        searches: number
        edits: number
        toolCalls: number
      }
    }) => {
      setDelegateTasks((prev) => {
        const task = prev[data.taskId]
        if (!task) return prev
        return {
          ...prev,
          [data.taskId]: {
            ...task,
            status: data.error ? 'failed' : 'completed',
            completedAt: Date.now(),
            durationMs: data.durationMs,
            result: data.result,
            error: data.error,
            progress: data.progress || task.progress
          }
        }
      })
    }

    const cleanupDelegateStart = window.api.onDelegateStart(handleDelegateStart)
    const cleanupDelegateProgress = window.api.onDelegateProgress(handleDelegateProgress)
    const cleanupDelegateComplete = window.api.onDelegateComplete(handleDelegateComplete)

    return () => {
      window.api.off('session:mode-changed', handleModeChanged)
      window.api.off('plan:approval-required', handlePlanApprovalRequired)
      cleanupDelegateStart()
      cleanupDelegateProgress()
      cleanupDelegateComplete()
    }
  }, [])

  // Get current session Plan Mode state
  const currentPlanMode = currentSessionId ? planModeState[currentSessionId] : undefined
  const isInPlanMode = currentPlanMode?.mode === 'plan'
  const currentPlanFilePath = currentPlanMode?.planFilePath

  // Get delegate tasks for current session
  const currentSessionDelegateTasks = Object.values(delegateTasks).filter(
    (task) => currentSessionId && task.id.startsWith(currentSessionId.slice(0, 8))
  )

  return (
    <div className="flex h-full w-full flex-col border-l border-sidebar-border/50 bg-sidebar">
      {/* Plan Mode Indicator */}
      {isInPlanMode && currentPlanFilePath && (
        <PlanModeIndicator planFilePath={currentPlanFilePath} />
      )}

      {/* Delegate Task Progress Cards */}
      {currentSessionDelegateTasks.length > 0 && (
        <div className="px-4 py-2 space-y-2 border-b border-border/50 bg-muted/30">
          {currentSessionDelegateTasks.map((task) => (
            <DelegateTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* User Question Dialog */}
      {userQuestion && (
        <UserQuestionDialog
          questionId={userQuestion.questionId}
          sessionId={userQuestion.sessionId}
          questions={userQuestion.questions}
          metadata={userQuestion.metadata}
          isInPlanMode={userQuestion.isInPlanMode}
          onSubmit={submitUserQuestionAnswer}
          onClose={() => {
            submitUserQuestionAnswer({ type: 'skipped' })
          }}
        />
      )}

      {/* Plan Approval Dialog */}
      {pendingPlanApproval && (
        <ExitPlanApprovalDialog
          approvalId={pendingPlanApproval.approvalId}
          planContent={pendingPlanApproval.planContent}
          planFilePath={pendingPlanApproval.planFilePath}
          onClose={() => setPendingPlanApproval(null)}
        />
      )}

      {/* Header with Session Tabs */}
      <ChatHeader
        currentSession={currentSession || undefined}
        sessions={sessions}
        openSessionIds={openSessionIds}
        onNewSession={handleNewSession}
        onSelectSession={openSession}
        onCloseSessionTab={closeSessionTab}
        onDeleteSession={handleDeleteSession}
      />

      {/* Messages */}
      <ChatMessages
        currentSession={currentSession || undefined}
        isSending={isStreaming}
        pendingFileEdits={pendingFileEdits}
        onOpenFile={onOpenFile}
        onAcceptFileEdit={onAcceptFileEdit}
        onRejectFileEdit={onRejectFileEdit}
        onAcceptAllFileEdits={() => onAcceptAllFileEdits?.(currentSessionId || undefined)}
        onRejectAllFileEdits={() => onRejectAllFileEdits?.(currentSessionId || undefined)}
        onApprovalDecision={(toolCallId, decision) => {
          // ✅ 直接传递，不需要映射（后端期望 'approve' | 'reject' | 'skip'）
          onApprovalDecision(toolCallId, decision)
        }}
        onResubmitMessage={async (content) => {
          const modelId = `${selectedProvider}/${selectedModel}`
          await sendMessage(content, modelId, [])
        }}
      />

      {/* Message Queue - 显示在输入框上方 */}
      <div className="border-t border-sidebar-border/50 px-3 pt-3">
        <MessageQueue sessionId={currentSessionId} onSendNow={handleSendNow} />
      </div>

      {/* Input Area */}
      <div className="px-3 pb-3 pt-0">
        <ChatInput
          placeholder={workspaceRoot ? t('chat.type_message') : t('chat.open_project_first')}
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          onStop={stopStreaming}
          disabled={!workspaceRoot}
          isSending={isStreaming}
          pastedImages={pastedImages}
          onPastedImagesChange={setPastedImages}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          maxTokens={maxTokens}
          usedTokens={usageData.usedTokens}
          usage={usageData.usage}
          onModelChange={(provider, model) => {
            setSelectedProvider(provider)
            setSelectedModel(model)
          }}
        />
      </div>
    </div>
  )
}
