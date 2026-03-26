import { useMemo } from 'react'
import { Files, Search, GitBranch, GitCompare, History, Unplug, Settings, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeftTabType } from '@/hooks/use-layout-manager'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'

interface ActivityBarProps {
  activeTab: LeftTabType
  onTabChange: (tab: LeftTabType) => void
  showGitTab?: boolean
  showCompareTab?: boolean
}

const baseTabs: Array<{ id: LeftTabType; icon: typeof Files; label: string }> = [
  { id: 'explorer', icon: Files, label: '资源管理器' },
  { id: 'search', icon: Search, label: '搜索' },
  { id: 'changes', icon: GitBranch, label: '源代码管理' },
  { id: 'history', icon: History, label: 'Git 历史' },
  { id: 'skills', icon: Puzzle, label: 'Skills' },
  { id: 'mcp', icon: Unplug, label: 'MCP 市场' }
]

export function ActivityBar({
  activeTab,
  onTabChange,
  showGitTab = true,
  showCompareTab = false
}: ActivityBarProps) {
  const openDialog = useWorkspaceUIStore((state) => state.openDialog)
  const isFullscreen = useWorkspaceUIStore((state) => state.isFullscreen)

  const visibleTabs = useMemo(() => {
    const tabs = showGitTab ? baseTabs : baseTabs.filter((t) => t.id !== 'changes')
    return showCompareTab
      ? [...tabs, { id: 'compare' as LeftTabType, icon: GitCompare, label: '比较分支' }]
      : tabs
  }, [showGitTab, showCompareTab])

  return (
    <div className="flex flex-col h-full w-12 border-r border-border/30 bg-sidebar">
      {/* 顶部窗口拖拽区域 - 全屏时缩小高度 */}
      <div
        className={cn(
          'w-full window-drag-region shrink-0 transition-all',
          isFullscreen ? 'h-2' : 'h-[38px]'
        )}
      />

      {/* 主功能图标 */}
      <div className="flex flex-col items-center gap-2.5 py-2">
        {visibleTabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'w-8.5 h-8.5 flex items-center justify-center rounded-md transition-all cursor-pointer',
              activeTab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={label}
          >
            <Icon className="size-5" strokeWidth={1.5} />
          </button>
        ))}
      </div>

      {/* 底部功能 */}
      <div className="mt-auto flex flex-col items-center gap-1 py-2">
        {/* 设置按钮 */}
        <button
          onClick={() => openDialog('settings')}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
          title="设置"
        >
          <Settings className="size-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
