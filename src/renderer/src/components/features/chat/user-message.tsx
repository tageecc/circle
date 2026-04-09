import { useState, useEffect, useRef } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatInput } from './chat-input'
import { cn } from '@/lib/utils'
import { useMessageRevert } from '@/hooks/use-message-revert'
import { useChatStore } from '@/stores/chat.store'
import type { Message } from '@/types/chat'

interface UserMessageProps {
  message: Message
  sessionId: string
  className?: string
  onResubmit?: (newContent: string) => void
}

/**
 * 用户消息组件
 * 功能：
 * 1. 点击消息进入编辑态
 * 2. 右下角 Revert 按钮（回退文件）
 * 3. 编辑后提交触发确认对话框
 */
export function UserMessage({ message, sessionId, className, onResubmit }: UserMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(getMessageText(message))
  const [affectedFilesCount, setAffectedFilesCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { handleRevert, handleEditAndResubmit, isReverting, RevertDialog, SubmitDialog } =
    useMessageRevert()

  const batchUpdateSession = useChatStore((state) => state.batchUpdateSession)

  // 获取受影响的文件数量
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const files = await window.api.message.getAffectedFiles(message.id)
        setAffectedFilesCount(files.length)
      } catch (error) {
        console.error('Failed to get affected files count:', error)
        setAffectedFilesCount(0)
      }
    }
    fetchCount()
  }, [message.id])

  // 点击外部区域取消编辑
  useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false)
        setEditContent(getMessageText(message))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing, message])

  // 获取消息文本内容
  function getMessageText(msg: Message): string {
    if (!msg.content) {
      return ''
    }
    if (typeof msg.content === 'string') {
      return msg.content
    }
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
    }
    return ''
  }

  // 处理消息点击（进入编辑态）
  const handleMessageClick = () => {
    if (!isEditing) {
      setIsEditing(true)
    }
  }

  // 处理编辑取消
  const handleCancel = () => {
    setIsEditing(false)
    setEditContent(getMessageText(message))
  }

  // 处理编辑提交
  const handleSubmit = async () => {
    if (!editContent.trim() || editContent === getMessageText(message)) {
      setIsEditing(false)
      return
    }

    const result = await handleEditAndResubmit(message.id)

    if (result === 'cancelled') {
      // 用户取消，保持编辑态
      return
    }

    // 关闭编辑态
    setIsEditing(false)

    // 如果用户选择了 overwrite 或 continue，触发重新发送
    if (result === 'overwrite' || result === 'continue') {
      try {
        // 1. 删除该消息及之后的所有消息（包括该消息本身）
        const previousMessageId = message.id - 1
        if (previousMessageId >= 0) {
          await window.api.sessions.deleteMessagesAfter(sessionId, previousMessageId)
        }

        // 2. 更新本地 UI：只保留 id < message.id 的消息
        const currentSession = useChatStore.getState().sessions.find((s) => s.id === sessionId)
        if (currentSession) {
          batchUpdateSession(sessionId, {
            messages: currentSession.messages.filter((msg) => msg.id < message.id)
          })
        }

        // 3. 重新发送消息（会创建新的用户消息和 assistant 消息）
        onResubmit?.(editContent)
      } catch (error) {
        console.error('Failed to resubmit:', error)
      }
    }
  }

  // 处理 Esc 键取消编辑
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <>
      <div ref={containerRef} className={cn('group relative w-full', className)}>
        {isEditing ? (
          // 编辑态 - 完全复用 ChatInput 组件
          <div className="w-full" onKeyDown={handleKeyDown}>
            <ChatInput
              placeholder="输入消息..."
              value={editContent}
              onChange={setEditContent}
              onSend={handleSubmit}
              disabled={false}
              isSending={false}
              pastedImages={[]}
              onPastedImagesChange={() => {}}
              availableModels={[]}
              isLoadingModels={false}
              selectedModelId={null}
              showModelSelector={false}
              autoFocus
            />
          </div>
        ) : (
          // 查看态
          <div className="group/message w-full cursor-text" onClick={handleMessageClick}>
            <div className="relative w-full rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground hover:bg-secondary/50 transition-colors">
              {/* 图片 */}
              {message.images && message.images.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {message.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative overflow-hidden rounded-lg border border-border/60"
                    >
                      <img src={img.dataUrl} alt={img.name} className="max-h-40 object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {/* 文本 + 回退按钮 */}
              <div className="flex items-start gap-2">
                <div className="flex-1 whitespace-pre-wrap wrap-break-word">
                  {getMessageText(message)}
                </div>
                {/* 回退按钮 - 在文本末尾，只在有文件变更时显示 */}
                {affectedFilesCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 shrink-0 cursor-pointer opacity-0 group-hover/message:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRevert(message.id)
                    }}
                    disabled={isReverting}
                    title={`回退 (${affectedFilesCount}个文件)`}
                  >
                    <Undo2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 对话框 */}
      {RevertDialog}
      {SubmitDialog}
    </>
  )
}
