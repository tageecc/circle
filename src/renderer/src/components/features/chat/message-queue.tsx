import { ChevronDown, ChevronRight, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMessageQueueStore, type QueuedMessage } from '@/stores/message-queue.store'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface MessageQueueProps {
  sessionId: string | null
  onSendNow?: (message: QueuedMessage) => void
  className?: string
}

/**
 * 消息队列组件
 *
 * 显示待发送的消息队列，类似 Cursor 的设计
 */
export function MessageQueue({ sessionId, onSendNow, className }: MessageQueueProps) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  // 订阅整个队列
  const allQueue = useMessageQueueStore((state) => state.queue)
  const removeFromQueue = useMessageQueueStore((state) => state.removeFromQueue)

  // 使用 useMemo 过滤当前会话的队列
  const queue = useMemo(
    () => allQueue.filter((msg) => msg.sessionId === sessionId),
    [allQueue, sessionId]
  )

  // 如果没有队列，不显示
  if (queue.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2.5 mb-3', className)}>
      <div
        className="flex items-center gap-1.5 px-0.5 cursor-pointer group"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        ) : (
          <ChevronDown className="size-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        )}
        <span className="text-[11px] font-medium text-muted-foreground/70 group-hover:text-muted-foreground/90 transition-colors">
          {t('message_queue.queued_count', { count: queue.length })}
        </span>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {queue.map((message) => (
            <QueuedMessageItem
              key={message.id}
              message={message}
              isExpanded={expandedId === message.id}
              onToggleExpand={() => setExpandedId(expandedId === message.id ? null : message.id)}
              onSendNow={() => onSendNow?.(message)}
              onRemove={() => removeFromQueue(message.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface QueuedMessageItemProps {
  message: QueuedMessage
  isExpanded: boolean
  onToggleExpand: () => void
  onSendNow: () => void
  onRemove: () => void
}

/**
 * 单个队列消息项
 */
function QueuedMessageItem({
  message,
  isExpanded,
  onToggleExpand,
  onSendNow,
  onRemove
}: QueuedMessageItemProps) {
  const { t } = useTranslation()
  // 消息预览（最多显示一行）
  const preview = message.content.split('\n')[0]
  const isTruncated = message.content.length > preview.length || preview.length > 60
  const displayText = isTruncated && !isExpanded ? `${preview.slice(0, 60)}...` : message.content

  return (
    <div className="group relative rounded-xl border border-border/50 bg-secondary/30 hover:border-border/70 transition-all duration-200">
      <div className="flex items-start gap-3 px-3.5 py-3">
        {/* 图片预览 */}
        {message.images.length > 0 && (
          <div className="flex gap-1.5 shrink-0">
            {message.images.slice(0, 2).map((img) => (
              <div
                key={img.id}
                className="size-12 rounded-lg overflow-hidden border border-border/40"
              >
                <img src={img.dataUrl} alt={img.name} className="size-full object-cover" />
              </div>
            ))}
            {message.images.length > 2 && (
              <div className="size-12 rounded-lg border border-border/40 bg-muted/50 flex items-center justify-center text-xs text-muted-foreground font-medium">
                +{message.images.length - 2}
              </div>
            )}
          </div>
        )}

        {/* 消息内容 */}
        <div className="flex-1 min-w-0 flex items-center">
          <div
            className={cn(
              'text-[13px] leading-relaxed text-foreground/90',
              isExpanded ? 'whitespace-pre-wrap' : 'truncate',
              isTruncated && 'cursor-pointer hover:text-foreground'
            )}
            onClick={isTruncated ? onToggleExpand : undefined}
          >
            {displayText}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Send Now 按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5 hover:bg-accent rounded-lg font-normal text-muted-foreground hover:text-foreground"
            onClick={onSendNow}
            title={t('message_queue.send_now_title')}
          >
            <Send className="size-3" />
            <span>{t('message_queue.send_now_label')}</span>
          </Button>

          {/* 删除按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-lg"
            onClick={onRemove}
            title={t('common.delete')}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
