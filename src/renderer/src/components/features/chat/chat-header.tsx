import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { MessageSquare, Clock, MoreHorizontal, Plus, Trash2, Search, X } from 'lucide-react'
import type { Session } from '@/types/chat'
import { cn } from '@/lib/utils'
import { useState, useMemo, useRef, useEffect } from 'react'

interface ChatHeaderProps {
  currentSession: Session | undefined
  sessions: Session[]
  openSessionIds: string[]
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onCloseSessionTab: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) {
    return 'now'
  } else if (diffMins < 60) {
    return `${diffMins}m`
  } else if (diffHours < 24) {
    return `${diffHours}h`
  } else {
    return `${diffDays}d`
  }
}

function groupSessionsByDate(sessions: Session[]): {
  today: Session[]
  yesterday: Session[]
  older: Session[]
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const grouped = {
    today: [] as Session[],
    yesterday: [] as Session[],
    older: [] as Session[]
  }

  sessions.forEach((session) => {
    const sessionDate = new Date(session.createdAt)
    const sessionDay = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate()
    )

    if (sessionDay.getTime() === today.getTime()) {
      grouped.today.push(session)
    } else if (sessionDay.getTime() === yesterday.getTime()) {
      grouped.yesterday.push(session)
    } else {
      grouped.older.push(session)
    }
  })

  return grouped
}

export function ChatHeader({
  currentSession,
  sessions,
  openSessionIds,
  onNewSession,
  onSelectSession,
  onCloseSessionTab,
  onDeleteSession
}: ChatHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLDivElement>(null)

  const openSessions = useMemo(
    () => sessions.filter((s) => openSessionIds.includes(s.id)),
    [sessions, openSessionIds]
  )

  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const activeTab = activeTabRef.current
      const containerRect = container.getBoundingClientRect()
      const tabRect = activeTab.getBoundingClientRect()

      if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [currentSession?.id])

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    onDeleteSession(sessionId)
  }

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = query
      ? sessions.filter((session) => session.title.toLowerCase().includes(query))
      : sessions
    return groupSessionsByDate(filtered)
  }, [sessions, searchQuery])

  const hasSessions =
    filteredSessions.today.length > 0 ||
    filteredSessions.yesterday.length > 0 ||
    filteredSessions.older.length > 0

  const renderSessionItem = (session: Session) => {
    const requestCount = session.messages.filter((msg) => msg.role === 'user').length
    const isCurrent = currentSession?.id === session.id

    return (
      <DropdownMenuItem
        key={session.id}
        onClick={() => onSelectSession(session.id)}
        className="group relative flex cursor-pointer items-center gap-2.5 px-4 py-2.5 bg-muted/20 hover:bg-muted/30 focus:bg-muted/30 data-highlighted:bg-muted/30"
      >
        <MessageSquare className="size-4 shrink-0 text-muted-foreground/70" />
        <span className="flex-1 truncate text-sm">{session.title}</span>

        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
          {isCurrent ? (
            <span className="text-primary font-medium">Current</span>
          ) : (
            <span className="text-muted-foreground/70">
              {formatRelativeTime(session.createdAt)}
            </span>
          )}
          <span className="text-muted-foreground/50">{requestCount} Reqs</span>
        </div>

        <div
          className={cn(
            'absolute right-3 flex items-center gap-0.5 rounded bg-background/95 backdrop-blur-sm px-0.5 py-0.5',
            'opacity-0 transition-opacity pointer-events-none',
            'group-hover:opacity-100 group-hover:pointer-events-auto'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => handleDeleteClick(e, session.id)}
            title="删除会话"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </DropdownMenuItem>
    )
  }

  return (
    <div className="flex items-center border-b border-sidebar-border/50 h-[38px] window-drag-region">
      {/* Left: Session Tabs (scrollable) */}
      <div className="flex-1 overflow-hidden window-no-drag">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-x-auto overflow-y-hidden scrollbar-hide"
        >
          <div className="flex items-center gap-0.5 px-2 h-full min-w-min">
            {openSessions.map((session) => {
              const isActive = session.id === currentSession?.id
              return (
                <div
                  key={session.id}
                  ref={isActive ? activeTabRef : null}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    'group relative flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
                    'hover:bg-accent/50',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="max-w-[120px] truncate">{session.title || '新对话'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCloseSessionTab(session.id)
                    }}
                    className={cn(
                      'flex items-center justify-center size-4 rounded-sm transition-opacity',
                      'hover:bg-destructive/10 hover:text-destructive',
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                    title="关闭标签页"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: Action Buttons (fixed) */}
      <div className="flex items-center gap-0.5 px-2 window-no-drag">
        {/* New Chat Button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:bg-sidebar-accent"
          onClick={onNewSession}
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
          <DropdownMenuContent
            align="end"
            className="w-[420px] p-0 shadow-lg border-muted bg-popover/95 backdrop-blur-xl"
          >
            {/* Search Box */}
            <div className="sticky top-0 border-b border-border/50 bg-popover/95 backdrop-blur-sm p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm bg-muted/40 border-muted/50 focus-visible:bg-muted/50"
                />
              </div>
            </div>

            {/* Session List */}
            <div className="max-h-[500px] overflow-y-auto">
              {!hasSessions ? (
                <div className="p-8 text-center text-sm text-muted-foreground/60">
                  {searchQuery ? '未找到匹配的会话' : '暂无历史会话'}
                </div>
              ) : (
                <>
                  {/* Today */}
                  {filteredSessions.today.length > 0 && (
                    <>
                      <DropdownMenuLabel className="px-4 py-2 text-xs font-medium text-muted-foreground/70">
                        Today
                      </DropdownMenuLabel>
                      {filteredSessions.today.map(renderSessionItem)}
                    </>
                  )}

                  {/* Yesterday */}
                  {filteredSessions.yesterday.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="px-4 py-2 text-xs font-medium text-muted-foreground/70">
                        Yesterday
                      </DropdownMenuLabel>
                      {filteredSessions.yesterday.map(renderSessionItem)}
                    </>
                  )}

                  {/* Older */}
                  {filteredSessions.older.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="px-4 py-2 text-xs font-medium text-muted-foreground/70">
                        Older
                      </DropdownMenuLabel>
                      {filteredSessions.older.map(renderSessionItem)}
                    </>
                  )}
                </>
              )}
            </div>
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
  )
}
