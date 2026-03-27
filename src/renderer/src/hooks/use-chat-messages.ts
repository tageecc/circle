import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import type { Session, Message, StreamChunk, ContentPart, ToolCallPart } from '@/types/chat'
import type { PastedImage, Attachment } from '@/components/features/chat/chat-input'
import {
  getContentParts,
  setContentParts,
  setToolUIState,
  getToolUIState
} from '@/utils/message-adapter'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useChatStore } from '@/stores/chat.store'
import { usePendingEditsStore } from '@/stores/pending-edits.store'

/**
 * ✅ 最佳实践实现 - 彻底重构版本
 *
 * - content 是唯一数据源（AI SDK 标准）
 * - metadata 存储纯 UI 状态
 * - 无兼容逻辑，无混合类型
 * - 关注点完全分离
 */

// ============================================================================
// 工具函数（纯函数，可单独测试）
// ============================================================================

// ============================================================================
// Hook
// ============================================================================

export function useChatMessages(
  currentSessionId: string | null,
  onMarkSessionAsLoaded: (sessionId: string) => void
) {
  const { t } = useTranslation()
  const workspaceRoot = useWorkspaceStore((state) => state.workspaceRoot)

  // ✅ 使用 Zustand store 中的 sessions 和操作
  const sessions = useChatStore((state) => state.sessions)
  const setSessions = useChatStore((state) => state.setSessions)
  const addSession = useChatStore((state) => state.addSession)

  const [isStreaming, setIsStreaming] = useState(false)

  // 追踪当前活跃的会话ID（用于流式响应）
  const [activeSessionId, setCurrentSessionId] = useState<string | null>(currentSessionId)

  // ✅ 流式控制器（用于停止）
  const streamStopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setCurrentSessionId(currentSessionId)
  }, [currentSessionId])

  // ============================================================================
  // IPC 事件订阅（工具执行、Terminal 等）
  // ============================================================================

  useEffect(() => {
    // 工具审批请求
    const unsubscribeApproval =
      window.api.terminal.onApprovalRequired?.((data) => {
        setSessions((prevSessions) =>
          prevSessions.map((s) => {
            // ✅ 不过滤 session，让所有 session 都处理（通过 toolCallId 匹配）
            const updated = {
              ...s,
              messages: s.messages.map((m) => {
                if (m.role !== 'assistant') return m

                // ✅ 检查 content 中是否有对应的 tool-call
                const parts = getContentParts(m)
                const hasTool = parts.some(
                  (p) => p.type === 'tool-call' && p.toolCallId === data.toolCallId
                )

                if (!hasTool) return m

                // ✅ 更新运行时状态（needsApproval, approvalStatus）
                return setToolUIState(m, data.toolCallId, {
                  needsApproval: true,
                  approvalStatus: 'pending'
                })
              })
            }
            
            // 只返回有更新的 session
            return updated.messages !== s.messages ? updated : s
          })
        )
      }) || (() => {})

    // Terminal 创建事件（后台任务）
    const unsubscribeCreated = window.api.terminal.onTerminalCreated((event) => {
      const { toolCallId, terminalId } = event

      // ✅ 更新 metadata 中的 terminalId
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            setToolUIState(m, toolCallId, {
              terminalId,
              streamOutput: '' // ✅ 只存储运行时状态
            })
          )
        }))
      )
    })

    // 流式输出开始事件（同步任务，不创建 terminal tab）
    const unsubscribeStreamingStarted = window.api.terminal.onStreamingStarted?.(() => {
      // ✅ 移除state更新：不需要处理
    })

    // 流式输出事件（不过滤 session）
    const unsubscribeOutputStream = window.api.terminal.onOutputStream((event) => {
      const { toolCallId, output } = event

      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          messages: s.messages.map((m) => {
            const currentState = getToolUIState(m, toolCallId)
            if (!currentState) return m

            return setToolUIState(m, toolCallId, {
              streamOutput: (currentState.streamOutput || '') + output
            })
          })
        }))
      )
    })

    // 输出完成事件
    const unsubscribeOutputComplete = window.api.terminal.onOutputComplete(() => {
      // ✅ 移除state更新：从tool-result推导，不需要处理
    })

    return () => {
      unsubscribeApproval()
      unsubscribeCreated()
      unsubscribeStreamingStarted?.()
      unsubscribeOutputStream()
      unsubscribeOutputComplete()
    }
  }, [setSessions]) // ✅ 只依赖 setSessions（Zustand store 方法稳定）

  // ============================================================================
  // 流式处理核心逻辑（纯 content + metadata）
  // ============================================================================

  // ✅ 处理流式响应块
  const processChunk = (message: Message, chunk: StreamChunk): Message => {
    switch (chunk.type) {
      case 'text':
        return chunk.content ? handleTextChunk(message, chunk) : message
      case 'reasoning':
        return chunk.content ? handleReasoningChunk(message, chunk) : message
      case 'tool-call':
        return chunk.toolCall ? handleToolCallChunk(message, chunk) : message
      case 'tool-result':
        // ✅ 不再处理 tool-result chunk（已在 message-start 中处理）
        return message
      case 'error':
        return chunk.error ? handleErrorChunk(message, chunk) : message
      default:
        return message
    }
  }

  // ✅ 处理文本块
  const handleTextChunk = (message: Message, chunk: StreamChunk): Message => {
    const parts = getContentParts(message)
    const lastPart = parts[parts.length - 1]

    let newParts: ContentPart[]
    if (lastPart?.type === 'text') {
      newParts = [...parts.slice(0, -1), { ...lastPart, text: lastPart.text + chunk.content! }]
    } else {
      newParts = [...parts, { type: 'text', text: chunk.content! }]
    }

    return setContentParts(message, newParts)
  }

  // ✅ 处理推理块
  const handleReasoningChunk = (message: Message, chunk: StreamChunk): Message => {
    const parts = getContentParts(message)
    const lastPart = parts[parts.length - 1]
    const isStreaming = message.metadata?.streamingStates?.reasoning?.isStreaming

    let newParts: ContentPart[]
    if (lastPart?.type === 'reasoning' && isStreaming) {
      newParts = [
        ...parts.slice(0, -1),
        { type: 'reasoning', text: lastPart.text + chunk.content! }
      ]
    } else {
      newParts = [...parts, { type: 'reasoning', text: chunk.content! }]
    }

    return {
      ...setContentParts(message, newParts),
      metadata: {
        ...message.metadata,
        streamingStates: {
          ...(message.metadata?.streamingStates || {}),
          reasoning: { isStreaming: true, type: 'reasoning' }
        }
      }
    }
  }

  // ✅ 处理工具调用块
  const handleToolCallChunk = (message: Message, chunk: StreamChunk): Message => {
    const parts = getContentParts(message)
    const toolCall = chunk.toolCall!

    // 检查是否已存在
    const exists = parts.some((p) => p.type === 'tool-call' && p.toolCallId === toolCall.id)
    if (exists) return message

    // ✅ 添加标准 ToolCallPart 到 content
    const newToolPart: ToolCallPart = {
      type: 'tool-call',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      input: toolCall.args
    }

    const newParts = [...parts, newToolPart]

    // ✅ 移除state初始化：state从tool-result推导
    return setContentParts(message, newParts)
  }

  // ✅ 移除 handleToolResult：已在 message-start 中统一处理，添加到全局 pending edits store

  // ✅ 处理错误块
  const handleErrorChunk = (message: Message, chunk: StreamChunk): Message => {
    const parts = getContentParts(message)
    const newParts: ContentPart[] = [...parts, { type: 'text', text: `Error: ${chunk.error!}` }]
    return setContentParts(message, newParts)
  }

  // ============================================================================
  // 主要 API
  // ============================================================================

  const sendMessage = async (
    message: string,
    modelId: string,
    pastedImages: PastedImage[] = [],
    attachments: Attachment[] = [],
    targetSessionId?: string
  ): Promise<void> => {
    if (!message.trim() && pastedImages.length === 0 && attachments.length === 0) return

    // 创建或获取会话 ID（优先使用目标 sessionId）
    let sessionId = targetSessionId || activeSessionId
    if (!sessionId) {
      try {
        sessionId = await window.api.sessions.create(modelId, workspaceRoot || '')

        const newSession: Session = {
          id: sessionId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          modelId,
          messages: [],
          createdAt: new Date()
        }

        addSession(newSession)
        onMarkSessionAsLoaded(sessionId)
        setCurrentSessionId(sessionId)
      } catch (error) {
        console.error('自动创建会话失败:', error)
        toast.error(t('chat.toast_create_session_failed'))
        return
      }
    }

    // ✅ 更新 activeSessionId，确保后续流式响应更新到正确的 session
    setCurrentSessionId(sessionId)

    // 开始流式响应
    setIsStreaming(true)

    try {
      // TODO: 后端需要支持 attachments 参数
      // 暂时只传递 images，attachments 的非图片文件稍后实现
      const allImages = [
        ...pastedImages,
        ...attachments.filter(att => att.isImage).map(att => ({
          id: att.id,
          dataUrl: att.data,
          name: att.name,
          size: att.size
        }))
      ]

      const { stop } = window.api.chat.stream(
        {
          sessionId,
          message,
          workspaceRoot: workspaceRoot || undefined,
          images: allImages.length > 0 ? allImages : undefined
        },
        (chunk: any) => {
        // 处理 usage chunk
        if (chunk.type === 'usage' && chunk.usage) {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s

              return {
                ...s,
                metadata: {
                  ...s.metadata,
                  lastUsage: chunk.usage
                }
              }
            })
          )
          return
        }

        if (chunk.type === 'session-id') return

        // 处理 message-start：直接使用后端传来的完整消息
        if (chunk.type === 'message-start' && chunk.messages) {
            const newMessages: Message[] = chunk.messages!.map((msg) => ({
              ...msg,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
            }))

            // ✅ 提取 applied-file-edit 信息并添加到全局 pending edits store
            if (workspaceRoot) {
              const pendingEditsStore = usePendingEditsStore.getState()
              
              newMessages.forEach((msg) => {
                if (msg.role === 'tool' && Array.isArray(msg.content)) {
                  msg.content.forEach((part: any) => {
                    if (part.type === 'tool-result' && part.output?.type === 'text') {
                      try {
                        const result = JSON.parse(part.output.value)
                        if (result.type === 'applied-file-edit') {
                          // 添加到全局 pending edits store
                          pendingEditsStore.addEdit(workspaceRoot, {
                            toolCallId: part.toolCallId,
                            sessionId,
                            toolName: result.toolName,
                            filePath: result.filePath,
                            absolutePath: result.absolutePath,
                            oldContent: result.oldContent || '',
                            newContent: result.newContent || '',
                            timestamp: Date.now()
                          })
                        }
                      } catch (error) {
                        // 忽略解析错误
                        console.warn('Failed to parse tool result:', error)
                      }
                    }
                  })
                }
              })
            }

            // ✅ 更新消息
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessionId) return s

                return {
                  ...s,
                  messages: [...s.messages, ...newMessages]
                }
              })
            )

            return
          }

          setSessions((prevSessions) =>
            prevSessions.map((session) => {
              if (session.id !== sessionId) return session

              const lastAssistantIndex = session.messages.findLastIndex(
                (msg) => msg.role === 'assistant'
              )

              return {
                ...session,
                messages: session.messages.map((m, index) =>
                  index === lastAssistantIndex ? processChunk(m, chunk) : m
                )
              }
            })
          )
        },
        (_sessionId) => {
          setIsStreaming(false)
          // 关闭最后一个 assistant 消息的流式状态
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s
              const lastIdx = s.messages.findLastIndex((m) => m.role === 'assistant')
              if (lastIdx === -1) return s

              return {
                ...s,
                messages: s.messages.map((m, idx) => {
                  if (idx !== lastIdx || !m.metadata?.streamingStates) return m

                  const closedStates = Object.fromEntries(
                    Object.entries(m.metadata.streamingStates).map(([key, state]) => [
                      key,
                      { ...state, isStreaming: false }
                    ])
                  )

                  return { ...m, metadata: { ...m.metadata, streamingStates: closedStates } }
                })
              }
            })
          )
        },
        (error) => {
          // 用户主动停止不显示错误提示
          if (error !== 'Chat stopped by user') {
            console.error('Stream error:', error)
            toast.error((typeof error === 'string' && error) || t('chat.toast_send_failed'))
          }
          setIsStreaming(false)
        }
      )

      // 保存 stop 方法到 ref
      streamStopRef.current = stop
    } catch (error: any) {
      console.error('Stream error:', error)
      toast.error(t('chat.toast_send_failed'))
      setIsStreaming(false)
    }
  }

  const stopStreaming = () => {
    if (!streamStopRef.current) return
    
    const stoppedSessionId = activeSessionId
    streamStopRef.current()
    streamStopRef.current = null
    setIsStreaming(false)
    
    // 标记被停止 session 中所有 loading 工具为"已取消"
    if (!stoppedSessionId) return
    
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== stoppedSessionId) return s
        
        return {
          ...s,
          messages: s.messages.map((msg) => {
            if (msg.role !== 'assistant') return msg
            
            let updatedMsg = msg
            const parts = getContentParts(msg)
            
            // 检查每个 tool-call 是否需要标记为已取消
            parts.forEach((p) => {
              if (p.type !== 'tool-call') return
              
              const toolCallId = (p as ToolCallPart).toolCallId
              
              // 跳过已有结果或已取消的工具
              if (getToolUIState(updatedMsg, toolCallId)?.isCancelled) return
              
              const hasResult = s.messages.some((m) =>
                m.role === 'tool' &&
                Array.isArray(m.content) &&
                m.content.some(
                  (resultPart: any) =>
                    resultPart.type === 'tool-result' && resultPart.toolCallId === toolCallId
                )
              )
              
              if (!hasResult) {
                updatedMsg = setToolUIState(updatedMsg, toolCallId, { isCancelled: true })
              }
            })
            
            return updatedMsg
          })
        }
      })
    )
  }

  // ============================================================================
  // 其他API
  // ============================================================================

  const onApprovalDecision = async (
    toolCallId: string,
    decision: 'approve' | 'reject' | 'skip'
  ) => {
    // ✅ 映射到approvalStatus类型
    const approvalStatus =
      decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'skipped'

    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          setToolUIState(m, toolCallId, {
            approvalStatus
          })
        )
      }))
    )

    // ✅ 通知后端继续执行（传递原始decision: 'approve' | 'reject' | 'skip'）
    if (activeSessionId) {
      await window.api.chat.resumeInterrupt(activeSessionId, toolCallId, decision)
    }
  }

  return {
    sessions,
    activeSessionId,
    isStreaming,
    sendMessage,
    stopStreaming,
    setSessions,
    onApprovalDecision
  }
}
