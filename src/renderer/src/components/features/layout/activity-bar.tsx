import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Files,
  Search,
  GitBranch,
  GitCompare,
  History,
  Unplug,
  Settings,
  Puzzle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeftTabType } from '@/hooks/use-layout-manager'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'

interface ActivityBarProps {
  activeTab: LeftTabType
  onTabChange: (tab: LeftTabType) => void
  showGitTab?: boolean
  showCompareTab?: boolean
}

export function ActivityBar({
  activeTab,
  onTabChange,
  showGitTab = true,
  showCompareTab = false
}: ActivityBarProps) {
  const { t } = useTranslation()
  const openDialog = useWorkspaceUIStore((state) => state.openDialog)
  const isFullscreen = useWorkspaceUIStore((state) => state.isFullscreen)

  const baseTabs: Array<{ id: LeftTabType; icon: typeof Files; label: string }> = useMemo(
    () => [
      { id: 'explorer', icon: Files, label: t('activity_bar.explorer') },
      { id: 'search', icon: Search, label: t('activity_bar.search') },
      { id: 'changes', icon: GitBranch, label: t('activity_bar.git') },
      { id: 'history', icon: History, label: t('activity_bar.history') },
      { id: 'skills', icon: Puzzle, label: t('activity_bar.skills') },
      { id: 'mcp', icon: Unplug, label: t('activity_bar.mcp') }
    ],
    [t]
  )

  const visibleTabs = useMemo(() => {
    const tabs = showGitTab ? baseTabs : baseTabs.filter((t) => t.id !== 'changes')
    return showCompareTab
      ? [
          ...tabs,
          { id: 'compare' as LeftTabType, icon: GitCompare, label: t('activity_bar.compare') }
        ]
      : tabs
  }, [showGitTab, showCompareTab, baseTabs, t])

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
          title={t('activity_bar.settings')}
        >
          <Settings className="size-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
