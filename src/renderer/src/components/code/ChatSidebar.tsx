import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { MessageSquare, Clock, MoreHorizontal, Plus, Bot, Loader2 } from 'lucide-react'
import { ChatInput, type PastedImage } from './ChatInput'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '../ui/reasoning'
import { ChatContainerRoot, ChatContainerContent } from '../ui/chat-container'
import { ToolCallList, type ToolCallData } from '../ui/tool-call'
import { Markdown } from '../ui/markdown'
import { FileChangesReview, FileChangesBar, type FileChange } from '../ui/file-changes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getUndoBaselineFromToolResult, resolvePathInWorkspace } from '@/lib/chat-file-baseline'

/** 默认助手（单模型模式，来自 agents:getDefault） */
interface DefaultAgent {
  id: string
  name: string
  model: string
  provider: string
  instructions: string | null
}

// Content Block Types - 按照 Cursor 的设计
type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'reasoning'; content: string; isStreaming?: boolean }
  | { type: 'tool-calls'; tools: ToolCallData[] }

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string // 用户消息的文本内容
  blocks?: ContentBlock[] // AI 消息的内容块（按顺序）
  timestamp: Date
  images?: PastedImage[]
}

interface Session {
  id: string
  title: string
  agentId: string
  threadId?: string // Mastra Memory 的 thread ID
  messages: Message[]
  fileChanges: FileChange[] // 追踪当前会话中修改的文件
  createdAt: Date
}

interface ChatSidebarProps {
  workspaceRoot: string | null
  onPendingFileEdit?: (pending: {
    toolCallId: string
    filePath: string
    absolutePath: string
    oldContent: string
    newContent: string
  }) => void
  onOpenFile?: (filePath: string) => void
  /** 撤销全部写回磁盘后，通知父组件刷新已打开文件与文件树 */
  onSessionFilesRestored?: (absolutePaths: string[]) => void
}

export function ChatSidebar({
  workspaceRoot,
  onPendingFileEdit,
  onOpenFile,
  onSessionFilesRestored
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [defaultAgent, setDefaultAgent] = useState<DefaultAgent | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([])
  const [streamControls, setStreamControls] = useState<{
    cleanup: () => void
    stop: () => void
  } | null>(null)

  // 加载默认助手（单模型模式）
  useEffect(() => {
    loadDefaultAgent()
  }, [])

  // 组件卸载时清理正在进行的流
  useEffect(() => {
    return () => {
      if (streamControls) {
        streamControls.cleanup()
      }
    }
  }, [streamControls])

  const loadDefaultAgent = async () => {
    try {
      const agent = await window.api.agents.getDefault()
      setDefaultAgent(agent as DefaultAgent)
      if (agent?.id) {
        createDefaultSession(agent.id)
      }
    } catch (error) {
      console.error('Failed to load default agent:', error)
    }
  }

  // 创建默认会话
  const createDefaultSession = (agentId: string) => {
    const defaultSession: Session = {
      id: `session-${Date.now()}`,
      title: '新对话',
      agentId,
      messages: [],
      fileChanges: [],
      createdAt: new Date()
    }
    setSessions([defaultSession])
    setCurrentSessionId(defaultSession.id)
  }

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  const handleNewSession = () => {
    if (!defaultAgent) {
      toast.error('请稍候，正在加载默认模型…')
      return
    }
    const newSession: Session = {
      id: `session-${Date.now()}`,
      title: '新对话',
      agentId: defaultAgent.id,
      messages: [],
      fileChanges: [],
      createdAt: new Date()
    }
    setSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
  }

  // 停止流式响应
  const handleStopStreaming = () => {
    if (streamControls) {
      streamControls.stop()
      setStreamControls(null)
      setIsSending(false)

      // 停止时也需要将最后一条助手消息中的 reasoning blocks 的 isStreaming 设置为 false
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSessionId) return s
          const messages = [...s.messages]
          // 找到最后一条助手消息
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant' && messages[i].blocks) {
              messages[i] = {
                ...messages[i],
                blocks: messages[i].blocks!.map((block) =>
                  block.type === 'reasoning' ? { ...block, isStreaming: false } : block
                )
              }
              break
            }
          }
          return { ...s, messages }
        })
      )
    }
  }

  // Keep All - 接受所有文件修改
  const handleKeepAll = async () => {
    if (!currentSession || currentSession.fileChanges.length === 0) return

    toast.success('所有文件修改已应用', {
      description: `已修改 ${currentSession.fileChanges.length} 个文件`
    })

    // 清空文件修改列表
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, fileChanges: [] } : s))
    )
  }

  // Undo All - 撤销所有文件修改（恢复到原始内容）
  const handleUndoAll = async () => {
    if (!currentSession || currentSession.fileChanges.length === 0) return
    if (!workspaceRoot) {
      toast.error('未打开工作区', { description: '无法定位要恢复的文件路径' })
      return
    }

    const restoredPaths: string[] = []
    try {
      for (const fc of currentSession.fileChanges) {
        const abs = resolvePathInWorkspace(fc.absolutePath, workspaceRoot)
        if (fc.fileCreatedBySession) {
          await window.api.files.delete(abs)
          restoredPaths.push(abs)
        } else if (fc.baselineSnapshot !== undefined && fc.baselineSnapshot !== null) {
          await window.api.files.write(abs, fc.baselineSnapshot)
          restoredPaths.push(abs)
        }
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, fileChanges: [] } : s))
      )
      toast.success('已撤销本会话中的文件修改', {
        description: `已处理 ${restoredPaths.length} 个文件`
      })
      onSessionFilesRestored?.(restoredPaths)
    } catch (error) {
      toast.error('撤销失败', {
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Dismiss - 关闭文件修改提示（不执行任何操作，只是隐藏）
  const handleDismissChanges = () => {
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, fileChanges: [] } : s))
    )
  }

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && pastedImages.length === 0) || !currentSessionId || isSending) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      images: pastedImages.length > 0 ? [...pastedImages] : undefined
    }

    // 添加用户消息
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: [...session.messages, userMessage],
              title: session.messages.length === 0 ? inputValue.slice(0, 30) : session.title
            }
          : session
      )
    )

    setInputValue('')
    setPastedImages([])
    setIsSending(true)

    try {
      // 创建临时的助手消息
      const assistantMessageId = `msg-${Date.now()}-assistant`
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        blocks: [], // 初始化为空数组
        timestamp: new Date()
      }

      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? { ...session, messages: [...session.messages, assistantMessage] }
            : session
        )
      )

      // 获取当前会话的 agent
      const session = sessions.find((s) => s.id === currentSessionId)
      if (!session) return

      // 调用流式聊天 API，保存控制器
      const controls = window.api.chat.stream(
        {
          agentId: session.agentId,
          threadId: session.threadId, // 传递 threadId（首次为 undefined）
          resourceId: session.agentId, // resourceId 使用 agentId
          message: userMessage.content,
          workspaceRoot: workspaceRoot // 传递 workspaceRoot 以便收集上下文信息
        },
        // onChunk
        (chunk) => {
          console.log('chunk', chunk)
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) => {
                      if (m.id === assistantMessageId) {
                        const blocks = m.blocks || []

                        if (chunk.type === 'text' && chunk.content) {
                          // 文本 chunk：关闭所有 reasoning blocks，然后追加到最后一个 text block 或创建新的
                          const closedBlocks = blocks.map((b) =>
                            b.type === 'reasoning' && b.isStreaming
                              ? { ...b, isStreaming: false }
                              : b
                          )
                          const lastBlock = closedBlocks[closedBlocks.length - 1]
                          if (lastBlock && lastBlock.type === 'text') {
                            return {
                              ...m,
                              blocks: [
                                ...closedBlocks.slice(0, -1),
                                { ...lastBlock, content: lastBlock.content + chunk.content }
                              ]
                            }
                          } else {
                            return {
                              ...m,
                              blocks: [...closedBlocks, { type: 'text', content: chunk.content }]
                            }
                          }
                        } else if (chunk.type === 'reasoning' && chunk.content) {
                          // Reasoning chunk：追加到最后一个 reasoning block 或创建新的
                          const lastBlock = blocks[blocks.length - 1]
                          if (
                            lastBlock &&
                            lastBlock.type === 'reasoning' &&
                            lastBlock.isStreaming
                          ) {
                            return {
                              ...m,
                              blocks: [
                                ...blocks.slice(0, -1),
                                {
                                  ...lastBlock,
                                  content: lastBlock.content + chunk.content,
                                  isStreaming: true
                                }
                              ]
                            }
                          } else {
                            // 新的 reasoning block
                            return {
                              ...m,
                              blocks: [
                                ...blocks,
                                { type: 'reasoning', content: chunk.content, isStreaming: true }
                              ]
                            }
                          }
                        } else if (chunk.type === 'tool-call' && chunk.toolCall) {
                          // Tool call：关闭所有 reasoning blocks，然后添加到最后一个 tool-calls block 或创建新的
                          const closedBlocks = blocks.map((b) =>
                            b.type === 'reasoning' && b.isStreaming
                              ? { ...b, isStreaming: false }
                              : b
                          )
                          const lastBlock = closedBlocks[closedBlocks.length - 1]
                          if (lastBlock && lastBlock.type === 'tool-calls') {
                            return {
                              ...m,
                              blocks: [
                                ...closedBlocks.slice(0, -1),
                                {
                                  ...lastBlock,
                                  tools: [
                                    ...lastBlock.tools,
                                    { ...chunk.toolCall, isLoading: true }
                                  ]
                                }
                              ]
                            }
                          } else {
                            return {
                              ...m,
                              blocks: [
                                ...closedBlocks,
                                {
                                  type: 'tool-calls',
                                  tools: [{ ...chunk.toolCall, isLoading: true }]
                                }
                              ]
                            }
                          }
                        } else if (chunk.type === 'tool-result' && chunk.toolResult) {
                          // Tool result：关闭所有 reasoning blocks
                          const closedBlocks = blocks.map((b) =>
                            b.type === 'reasoning' && b.isStreaming
                              ? { ...b, isStreaming: false }
                              : b
                          )

                          // edit_file：已直接写入文件，返回 oldContent/newContent 用于展示 diff 条；接受=关闭条，拒绝=回滚
                          const toolCall = m.blocks
                            ?.find((b) => b.type === 'tool-calls')
                            ?.tools?.find((t) => t.id === chunk.toolResult!.id)
                          const toolName = toolCall?.name
                          const toolResult = chunk.toolResult.result as
                            | Record<string, unknown>
                            | undefined

                          if (
                            toolName === 'edit_file' &&
                            !chunk.toolResult.isError &&
                            toolResult?.oldContent != null &&
                            toolResult?.newContent != null
                          ) {
                            onPendingFileEdit?.({
                              toolCallId: chunk.toolResult.id,
                              filePath: String(toolResult.filePath ?? ''),
                              absolutePath: String(toolResult.absolutePath ?? ''),
                              oldContent: String(toolResult.oldContent),
                              newContent: String(toolResult.newContent)
                            })
                          }

                          // 记录文件修改（支持所有文件编辑工具：edit_file, write, search_replace）
                          if (toolCall) {
                            const toolResultForChanges = chunk.toolResult.result as
                              | Record<string, unknown>
                              | undefined

                            // 检测文件修改工具
                            const isFileEditTool = [
                              'edit_file',
                              'write',
                              'search_replace'
                            ].includes(toolName!)

                            if (isFileEditTool && !chunk.toolResult.isError) {
                              let filePath: string | undefined
                              let absolutePath: string | undefined
                              let linesAdded = 0
                              let linesRemoved = 0

                              if (
                                toolName === 'edit_file' &&
                                toolResultForChanges?.oldContent != null &&
                                toolResultForChanges?.newContent != null
                              ) {
                                filePath = String(toolResultForChanges.filePath ?? '')
                                absolutePath = String(toolResultForChanges.absolutePath ?? '')
                                const oldLines = String(toolResultForChanges.oldContent).split(
                                  '\n'
                                ).length
                                const newLines = String(toolResultForChanges.newContent).split(
                                  '\n'
                                ).length
                                linesAdded = Math.max(0, newLines - oldLines)
                                linesRemoved = Math.max(0, oldLines - newLines)
                              } else if (toolName === 'write' && toolResultForChanges?.file) {
                                // write 工具
                                filePath = String(toolResultForChanges.file)
                                absolutePath = String(toolResultForChanges.file)
                                linesAdded = Number(toolResultForChanges.lines) || 0
                                linesRemoved = 0 // write 是完全覆盖，无法计算删除行数
                              } else if (toolName === 'search_replace') {
                                const fp =
                                  toolResultForChanges?.filePath ?? toolResultForChanges?.file
                                if (fp) {
                                  filePath = String(fp)
                                  absolutePath = String(fp)
                                  linesAdded = 1
                                  linesRemoved = 1
                                }
                              }

                              const { baselineSnapshot, fileCreatedBySession } =
                                getUndoBaselineFromToolResult(toolName || '', toolResultForChanges)

                              // 添加到 fileChanges（避免重复；基线仅首次写入）
                              if (filePath && absolutePath && workspaceRoot) {
                                const resolvedAbs = resolvePathInWorkspace(
                                  absolutePath,
                                  workspaceRoot
                                )
                                setSessions((prevSessions) =>
                                  prevSessions.map((session) => {
                                    if (session.id !== currentSessionId) return session
                                    const existingFileIndex = session.fileChanges.findIndex(
                                      (f) =>
                                        resolvePathInWorkspace(f.absolutePath, workspaceRoot) ===
                                        resolvedAbs
                                    )
                                    if (existingFileIndex >= 0) {
                                      const updatedChanges = [...session.fileChanges]
                                      updatedChanges[existingFileIndex] = {
                                        ...updatedChanges[existingFileIndex],
                                        linesAdded:
                                          updatedChanges[existingFileIndex].linesAdded + linesAdded,
                                        linesRemoved:
                                          updatedChanges[existingFileIndex].linesRemoved +
                                          linesRemoved
                                      }
                                      return { ...session, fileChanges: updatedChanges }
                                    }
                                    return {
                                      ...session,
                                      fileChanges: [
                                        ...session.fileChanges,
                                        {
                                          path: filePath,
                                          absolutePath: resolvedAbs,
                                          linesAdded,
                                          linesRemoved,
                                          toolCallId: chunk.toolResult!.id,
                                          baselineSnapshot,
                                          fileCreatedBySession
                                        }
                                      ]
                                    }
                                  })
                                )
                              }
                            }
                          }

                          const r = chunk.toolResult!.result as Record<string, unknown> | undefined
                          const pendingData =
                            r?.oldContent != null && r?.newContent != null
                              ? {
                                  filePath: String(r.filePath ?? ''),
                                  absolutePath: String(r.absolutePath ?? ''),
                                  oldContent: String(r.oldContent),
                                  newContent: String(r.newContent)
                                }
                              : undefined

                          // 更新对应的 tool（统一处理，pending 和非 pending）
                          return {
                            ...m,
                            blocks: closedBlocks.map((block) => {
                              if (block.type === 'tool-calls') {
                                return {
                                  ...block,
                                  tools: block.tools.map((t) =>
                                    t.id === chunk.toolResult!.id
                                      ? {
                                          ...t,
                                          result: chunk.toolResult!.result,
                                          isError: chunk.toolResult!.isError,
                                          isLoading: false,
                                          isPending: chunk.toolResult!.isPending,
                                          pendingData
                                        }
                                      : t
                                  )
                                }
                              }
                              return block
                            })
                          }
                        }
                      }
                      return m
                    })
                  }
                : s
            )
          )
        },
        // onEnd
        (threadId: string) => {
          // 保存 Mastra 返回的 threadId，并将所有 reasoning blocks 的 isStreaming 设置为 false
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== currentSessionId) return s
              return {
                ...s,
                threadId,
                messages: s.messages.map((m) => {
                  if (m.id === assistantMessageId && m.blocks) {
                    return {
                      ...m,
                      blocks: m.blocks.map((block) =>
                        block.type === 'reasoning' ? { ...block, isStreaming: false } : block
                      )
                    }
                  }
                  return m
                })
              }
            })
          )
          setStreamControls(null)
          setIsSending(false)
        },
        // onError
        (error) => {
          console.error('Stream error:', error)
          toast.error('消息发送失败', {
            description: error
          })
          // 出错时也需要将 reasoning blocks 的 isStreaming 设置为 false
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== currentSessionId) return s
              return {
                ...s,
                messages: s.messages.map((m) => {
                  if (m.id === assistantMessageId && m.blocks) {
                    return {
                      ...m,
                      blocks: m.blocks.map((block) =>
                        block.type === 'reasoning' ? { ...block, isStreaming: false } : block
                      )
                    }
                  }
                  return m
                })
              }
            })
          )
          setStreamControls(null)
          setIsSending(false)
        }
      )

      // 保存流控制器
      setStreamControls(controls)
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('发送消息失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
      setIsSending(false)
      setStreamControls(null)
    }
  }

  return (
    <div className="flex h-full w-full flex-col border-l border-sidebar-border/50 bg-sidebar">
      {/* Compact Header - Cursor Style */}
      <div className="flex items-center justify-between border-b border-sidebar-border/50 px-3 py-2">
        {/* Session Title + Model */}
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {currentSession && (
            <div className="flex flex-1 min-w-0 items-center gap-2">
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{currentSession.title}</span>
              {defaultAgent && (
                <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                  {defaultAgent.model}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-0.5">
          {/* New Chat Button */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:bg-sidebar-accent"
            onClick={handleNewSession}
            title="新建对话"
          >
            <Plus className="size-4" />
          </Button>

          {/* History Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-sidebar-accent"
                title="历史会话"
              >
                <Clock className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[280px]">
              {sessions.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">暂无历史会话</div>
              ) : (
                sessions.map((session) => (
                  <DropdownMenuItem
                    key={session.id}
                    onClick={() => setCurrentSessionId(session.id)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <MessageSquare className="size-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{session.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {session.messages.length}
                    </Badge>
                    {currentSessionId === session.id && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Button */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:bg-sidebar-accent"
            title="更多"
            disabled
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ChatContainerRoot className="flex-1 overflow-x-hidden">
        {currentSession ? (
          <ChatContainerContent className="p-4">
            {currentSession.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 py-12">
                <div className="text-center space-y-6 max-w-xs">
                  {/* 图标容器 - 带渐变背景和动画 */}
                  <div className="relative mx-auto w-20 h-20 mb-4">
                    {/* 背景光晕 */}
                    <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary/20 via-primary/10 to-transparent blur-xl animate-pulse-soft" />
                    {/* 图标背景 */}
                    <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-lg shadow-primary/10">
                      <Bot className="size-9 text-primary" strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* 主标题 */}
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-foreground">开始与 AI 对话</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      输入你的问题或想法，AI 助手将为你提供帮助
                    </p>
                  </div>

                  {/* 功能提示 */}
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
            ) : (
              <div className="space-y-1">
                {currentSession.messages.map((message, messageIndex) => (
                  <div
                    key={message.id}
                    className={cn('group relative w-full py-2', messageIndex > 0 && 'mt-0.5')}
                  >
                    {/* 用户消息 */}
                    {message.role === 'user' && (
                      <>
                        {message.images && message.images.length > 0 && (
                          <div className="mb-2.5 flex flex-wrap gap-2">
                            {message.images.map((img) => (
                              <div
                                key={img.id}
                                className="relative overflow-hidden rounded-lg border border-border/60 hover:border-border transition-colors"
                              >
                                <img
                                  src={img.dataUrl}
                                  alt={img.name}
                                  className="max-h-40 object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {message.content && (
                          <div className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap wrap-break-word">
                            {message.content}
                          </div>
                        )}
                      </>
                    )}

                    {/* AI 消息 */}
                    {message.role === 'assistant' && (
                      <>
                        {message.blocks?.map((block, blockIndex) => (
                          <div key={blockIndex} className="animate-in fade-in duration-200">
                            {block.type === 'reasoning' && (
                              <Reasoning isStreaming={block.isStreaming}>
                                <ReasoningTrigger className="text-xs">思考过程</ReasoningTrigger>
                                <ReasoningContent
                                  markdown
                                  contentClassName="my-1 text-xs text-muted-foreground/80 prose-p:text-muted-foreground/80 prose-li:text-muted-foreground/80 prose-p:text-xs prose-pre:text-xs prose-code:text-xs leading-relaxed"
                                >
                                  {block.content}
                                </ReasoningContent>
                              </Reasoning>
                            )}
                            {block.type === 'tool-calls' && (
                              <ToolCallList tools={block.tools} onOpenFile={onOpenFile} />
                            )}
                            {block.type === 'text' && (
                              <div className="mt-2 prose prose-sm dark:prose-invert max-w-none prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-foreground/90 prose-code:text-[12px] prose-pre:text-[12px]">
                                <Markdown>{block.content}</Markdown>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 在最后一条助手消息后显示 Planning next moves 状态 */}
                        {messageIndex === currentSession.messages.length - 1 && isSending && (
                          <PlanningIndicator message={message} />
                        )}

                        {/* 在最后一条助手消息后显示文件修改清单 */}
                        {messageIndex === currentSession.messages.length - 1 &&
                          !isSending &&
                          currentSession.fileChanges.length > 0 && (
                            <FileChangesReview
                              files={currentSession.fileChanges}
                              onOpenFile={onOpenFile}
                            />
                          )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ChatContainerContent>
        ) : (
          <ChatContainerContent>
            <div className="flex h-full items-center justify-center px-6 py-12">
              <div className="text-center space-y-6 max-w-xs">
                {/* 图标容器 */}
                <div className="relative mx-auto w-20 h-20 mb-4">
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-muted-foreground/10 via-muted-foreground/5 to-transparent blur-xl" />
                  <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-linear-to-br from-muted/30 to-muted/10 border border-border/30">
                    <MessageSquare className="size-9 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                </div>

                {/* 主标题 */}
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">创建新对话</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    点击右上角的 <span className="font-medium text-foreground">+</span>{' '}
                    按钮开始一个新的对话
                  </p>
                </div>

                {/* 提示 */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
                  <Clock className="size-3.5" />
                  <span>或从历史记录中选择</span>
                </div>
              </div>
            </div>
          </ChatContainerContent>
        )}
      </ChatContainerRoot>

      {/* Input Area */}
      <div className="border-t border-sidebar-border/50 px-3 pb-3 pt-3">
        {/* 文件修改批量操作栏 */}
        {currentSession && currentSession.fileChanges.length > 0 && !isSending && (
          <FileChangesBar
            fileCount={currentSession.fileChanges.length}
            onKeepAll={handleKeepAll}
            onUndoAll={handleUndoAll}
            onDismiss={handleDismissChanges}
          />
        )}

        <ChatInput
          placeholder={currentSession ? 'Ask, Search or Chat...' : '请先创建对话'}
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          onStop={handleStopStreaming}
          disabled={!currentSession}
          isSending={isSending}
          pastedImages={pastedImages}
          onPastedImagesChange={setPastedImages}
          minHeight="80px"
          defaultAgentId={currentSession?.agentId}
        />
      </div>
    </div>
  )
}

function PlanningIndicator({ message }: { message: Message }) {
  const blocks = message.blocks || []
  const lastBlock = blocks[blocks.length - 1]

  // 1. 如果没有内容块（刚开始），显示
  if (!lastBlock) return <PlanningIndicatorView />

  // 2. 如果是文本块，不显示（认为是正在输出，避免打字时一直显示）
  if (lastBlock.type === 'text') return null

  // 3. 如果是 reasoning 块
  if (lastBlock.type === 'reasoning') {
    // 正在思考(streaming) -> 不显示(有打字机)
    // 思考完(非streaming) -> 显示(等待下一步)
    return lastBlock.isStreaming ? null : <PlanningIndicatorView />
  }

  // 4. 如果是 tool-calls 块
  if (lastBlock.type === 'tool-calls') {
    // 有工具正在运行 -> 不显示(ToolList有loading)
    // 所有工具运行完 -> 显示(等待模型根据结果响应)
    const hasActiveTool = lastBlock.tools.some((t) => t.isLoading)
    return hasActiveTool ? null : <PlanningIndicatorView />
  }

  return null
}

function PlanningIndicatorView() {
  return (
    <div className="flex items-center gap-2 px-1 py-2 animate-in fade-in duration-300">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin opacity-60" />
        <span className="animate-shimmer font-medium">Planning next moves...</span>
      </div>
    </div>
  )
}
