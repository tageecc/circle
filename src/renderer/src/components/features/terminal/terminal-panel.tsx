import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal } from './terminal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Terminal as TerminalIcon, Pencil } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { eventBus } from '@/lib/event-bus'

interface TerminalTab {
  id: string
  terminalId: string
  title: string
}

interface TerminalPanelProps {
  workspaceRoot: string | null
  className?: string
  onClose?: () => void
  pendingCommand?: string | null
  onCommandHandled?: () => void
  onInitialized?: () => void
}

export function TerminalPanel({
  workspaceRoot,
  className,
  onClose,
  pendingCommand,
  onCommandHandled,
  onInitialized
}: TerminalPanelProps) {
  const { t } = useTranslation()
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [nextTabNumber, setNextTabNumber] = useState(1)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  const setTerminalTabCount = useWorkspaceUIStore((state) => state.setTerminalTabCount)

  // 同步 tab 数量到全局状态
  useEffect(() => {
    setTerminalTabCount(tabs.length)
  }, [tabs.length, setTerminalTabCount])

  const createNewTerminal = useCallback(async () => {
    try {
      const cwd = workspaceRoot || '~'
      const terminalId = await window.api.terminal.create(cwd)

      const newTab: TerminalTab = {
        id: `tab-${Date.now()}`,
        terminalId,
        title: t('terminal.tab_title', { n: nextTabNumber })
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
      setNextTabNumber((prev) => prev + 1)

      // 标记已初始化
      if (!initializedRef.current) {
        initializedRef.current = true
        onInitialized?.()
      }

      return { terminalId, id: newTab.id }
    } catch (error) {
      console.error('Failed to create terminal:', error)
      return null
    }
  }, [workspaceRoot, nextTabNumber, t, onInitialized])

  const closeTab = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    try {
      await window.api.terminal.kill(tab.terminalId)
    } catch (error) {
      console.error('Failed to kill terminal:', error)
    }

    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId)

      // 关闭最后一个 tab 时只隐藏面板，不销毁
      if (newTabs.length === 0) {
        onClose?.()
        return newTabs
      }

      if (activeTabId === tabId) {
        const tabIndex = prev.findIndex((t) => t.id === tabId)
        const nextTab = newTabs[tabIndex] || newTabs[tabIndex - 1]
        setActiveTabId(nextTab.id)
      }

      return newTabs
    })
  }

  // 关闭其他 tabs
  const closeOtherTabs = async (keepTabId: string) => {
    const tabsToClose = tabs.filter((t) => t.id !== keepTabId)
    for (const tab of tabsToClose) {
      try {
        await window.api.terminal.kill(tab.terminalId)
      } catch (error) {
        console.error('Failed to kill terminal:', error)
      }
    }
    setTabs(tabs.filter((t) => t.id === keepTabId))
    setActiveTabId(keepTabId)
  }

  // 关闭右侧 tabs
  const closeTabsToRight = async (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.id === tabId)
    const tabsToClose = tabs.slice(tabIndex + 1)
    for (const tab of tabsToClose) {
      try {
        await window.api.terminal.kill(tab.terminalId)
      } catch (error) {
        console.error('Failed to kill terminal:', error)
      }
    }
    setTabs(tabs.slice(0, tabIndex + 1))
    if (!tabs.slice(0, tabIndex + 1).find((t) => t.id === activeTabId)) {
      setActiveTabId(tabId)
    }
  }

  // 关闭所有 tabs
  const closeAllTabs = async () => {
    for (const tab of tabs) {
      try {
        await window.api.terminal.kill(tab.terminalId)
      } catch (error) {
        console.error('Failed to kill terminal:', error)
      }
    }
    setTabs([])
    onClose?.()
  }

  // 开始重命名
  const startRename = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) {
      setEditingTabId(tabId)
      setEditingTitle(tab.title)
      setTimeout(() => editInputRef.current?.focus(), 0)
    }
  }

  // 完成重命名
  const finishRename = () => {
    if (editingTabId && editingTitle.trim()) {
      setTabs((prev) =>
        prev.map((t) => (t.id === editingTabId ? { ...t, title: editingTitle.trim() } : t))
      )
    }
    setEditingTabId(null)
    setEditingTitle('')
  }

  // 取消重命名
  const cancelRename = () => {
    setEditingTabId(null)
    setEditingTitle('')
  }

  useEffect(() => {
    if (tabs.length === 0 && workspaceRoot && !pendingCommand) {
      createNewTerminal()
    }
  }, [workspaceRoot, tabs.length, pendingCommand, createNewTerminal])

  // 处理待执行命令
  useEffect(() => {
    if (!pendingCommand) return

    const handleCommand = async () => {
      try {
        // 创建新终端
        const result = await createNewTerminal()
        if (result) {
          // 等待终端初始化后执行命令
          setTimeout(() => {
            window.api.terminal.write(result.terminalId, pendingCommand + '\r')
            onCommandHandled?.()
          }, 100)
        }
      } catch (error) {
        console.error('Failed to run pending command:', error)
      }
    }

    handleCommand()
  }, [pendingCommand, createNewTerminal, onCommandHandled])

  // 监听工具创建的 terminal（自动创建 tab）
  useEffect(() => {
    const unsubscribe = window.api.terminal.onTerminalCreated((event) => {
      const { terminalId, command } = event

      // 提取命令名称（取第一个单词）
      const commandName = command.split(/\s+/)[0] || 'command'

      // 创建新 tab（Cursor 风格：添加 "Auto:" 前缀标识 AI 自动创建）
      const newTab: TerminalTab = {
        id: `tab-${Date.now()}`,
        terminalId,
        title: t('terminal.auto_tab_title', { name: commandName })
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
      setNextTabNumber((prev) => prev + 1)

      console.log(`📺 Terminal tab created for command: ${command}`)
    })

    return unsubscribe
  }, [t])

  // 监听 terminal focus 事件（从聊天界面跳转）
  useEffect(() => {
    const handleFocus = ({ terminalId }: { terminalId: string }) => {
      // 找到对应的 tab
      const targetTab = tabs.find((t) => t.terminalId === terminalId)
      if (targetTab) {
        setActiveTabId(targetTab.id)
        console.log(`🎯 Focused terminal: ${terminalId}`)
      }
    }

    eventBus.on('terminal:focus', handleFocus)
    return () => eventBus.off('terminal:focus', handleFocus)
  }, [tabs])

  return (
    <div className={cn('flex flex-col h-full w-full', className)}>
      <div className="flex items-center h-10 bg-background">
        <div className="flex flex-1 items-center gap-1 px-2 overflow-x-auto scrollbar-thin-x">
          {tabs.map((tab) => (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    'group relative flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all min-w-[100px] max-w-[200px] cursor-pointer',
                    activeTabId === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <TerminalIcon className="size-3.5 shrink-0" />
                  {editingTabId === tab.id ? (
                    <Input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={finishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') finishRename()
                        if (e.key === 'Escape') cancelRename()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 px-1 py-0 text-sm flex-1 min-w-0"
                    />
                  ) : (
                    <span className="flex-1 truncate font-medium">{tab.title}</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className={cn(
                      'shrink-0 rounded-sm p-0.5 transition-all',
                      activeTabId === tab.id
                        ? 'opacity-70 hover:opacity-100 hover:bg-muted'
                        : 'opacity-0 group-hover:opacity-70 hover:opacity-100'
                    )}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => startRename(tab.id)}>
                  <Pencil className="size-4 mr-2" />
                  {t('terminal.rename')}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => closeTab(tab.id)}>{t('terminal.close')}</ContextMenuItem>
                <ContextMenuItem onClick={() => closeOtherTabs(tab.id)} disabled={tabs.length <= 1}>
                  {t('terminal.close_other')}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => closeTabsToRight(tab.id)}
                  disabled={tabs.findIndex((x) => x.id === tab.id) === tabs.length - 1}
                >
                  {t('terminal.close_right')}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={closeAllTabs}>{t('terminal.close_all')}</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>

        <div className="flex items-center gap-1 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={createNewTerminal}
            title={t('terminal.new_terminal')}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {tabs.map((tab) => (
          <div
            key={tab.terminalId}
            className={cn('absolute inset-0', activeTabId === tab.id ? 'block' : 'hidden')}
          >
            <Terminal terminalId={tab.terminalId} />
          </div>
        ))}
      </div>
    </div>
  )
}
