import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  CheckCheck,
  Trash2,
  Copy,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useNotifications, NotificationType } from '@/contexts/notification-context'
import { toast } from 'sonner'

const typeConfig: Record<
  NotificationType,
  { icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10'
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10'
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  }
}

function formatTime(timestamp: number, t: TFunction, lng: string): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) {
    return t('git.time_just_now')
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('git.time_minutes_ago', { count: minutes })
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('git.time_hours_ago', { count: hours })
  }

  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('git.time_days_ago', { count: days })
  }

  return new Date(timestamp).toLocaleDateString(lng === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric'
  })
}

export function NotificationPanel() {
  const { t, i18n } = useTranslation()
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } =
    useNotifications()

  const [open, setOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
  }

  const handleCopy = async (notification: { title: string; description?: string }, id: string) => {
    const text = notification.description
      ? `${notification.title}\n\n${notification.description}`
      : notification.title

    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error(t('notifications.copy_failed'))
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-5 w-5 p-0 hover:bg-accent relative', open && 'bg-accent')}
          title={t('notifications.panel_title')}
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={8} className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {t('notifications.unread_count', { count: unreadCount })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
                title={t('notifications.mark_all_read_tooltip')}
              >
                <CheckCheck className="size-3.5 mr-1" />
                {t('notifications.all_read_short')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title={t('notifications.clear_all_tooltip')}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="size-10 mb-3 opacity-20" />
              <span className="text-sm">{t('notifications.no_notifications')}</span>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type]
                const Icon = config.icon

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'group relative flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50',
                      !notification.read && 'bg-primary/5'
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {!notification.read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}

                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        config.bgColor
                      )}
                    >
                      <Icon className={cn('size-4', config.color)} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5 pr-14">
                      <div className="flex items-start gap-2">
                        <p
                          className={cn(
                            'text-sm leading-tight flex-1',
                            !notification.read && 'font-medium'
                          )}
                        >
                          {notification.title}
                        </p>
                      </div>
                      {notification.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatTime(notification.timestamp, t, i18n.language)}
                        </span>
                      </div>
                    </div>

                    <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(notification, notification.id)
                        }}
                        title={t('notifications.copy_tooltip')}
                      >
                        {copiedId === notification.id ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeNotification(notification.id)
                        }}
                        title={t('notifications.delete_tooltip')}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t border-border/50 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground/60">
              {t('notifications.showing_recent', { count: notifications.length })}
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
