import { useState, useEffect } from 'react'
import { Terminal } from './Terminal'
import { Button } from '../ui/button'
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '../../contexts/SettingsContext'

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
}

export function TerminalPanel({
  workspaceRoot,
  className,
  onClose,
  pendingCommand,
  onCommandHandled
}: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [nextTabNumber, setNextTabNumber] = useState(1)
  const { appearanceSettings } = useSettings()

  const createNewTerminal = async () => {
    try {
      const cwd = workspaceRoot || '~'
      const terminalId = await window.api.terminal.create(cwd)

      const newTab: TerminalTab = {
        id: `tab-${Date.now()}`,
        terminalId,
        title: `终端 ${nextTabNumber}`
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
      setNextTabNumber((prev) => prev + 1)
      return { terminalId, id: newTab.id }
    } catch (error) {
      console.error('Failed to create terminal:', error)
      return null
    }
  }

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

  useEffect(() => {
    if (tabs.length === 0 && workspaceRoot && !pendingCommand) {
      createNewTerminal()
    }
  }, [workspaceRoot])

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
  }, [pendingCommand])

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const bgColor = appearanceSettings.theme === 'dark' ? '#282c34' : '#fafafa'

  return (
    <div className={cn('flex flex-col h-full', className)} style={{ backgroundColor: bgColor }}>
      <div className="flex items-center h-10 border-b bg-background">
        <div className="flex flex-1 items-center gap-1 px-2 overflow-x-auto tab-scroll">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all min-w-[100px] max-w-[200px] cursor-pointer',
                activeTabId === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <TerminalIcon className="size-3.5 shrink-0" />
              <span className="flex-1 truncate font-medium">{tab.title}</span>
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
          ))}
        </div>

        <div className="flex items-center gap-1 px-2 border-l">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={createNewTerminal}
            title="新建终端"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab && <Terminal key={activeTab.terminalId} terminalId={activeTab.terminalId} />}
      </div>
    </div>
  )
}
