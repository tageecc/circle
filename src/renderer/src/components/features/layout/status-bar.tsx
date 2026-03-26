import { useMemo } from 'react'
import { AlertCircle, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CodebaseIndexStatus } from './codebase-index-status'
import { ProjectSwitcher } from './project-switcher'
import { GitBranchSwitcher } from './git-branch-switcher'
import { EditorStatusIndicator } from './editor-status-indicator'
import { NotificationPanel } from '@/components/features/notifications/notification-panel'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useWorkspaceStore } from '@/stores/workspace.store'

interface StatusBarProps {
  hasGitChanges?: boolean
  onProjectChange?: (path: string) => void
  onGitStatusChange?: () => void
  onStartCompare?: (baseBranch: string, compareBranch: string) => void
}

export function StatusBar({
  hasGitChanges,
  onProjectChange,
  onGitStatusChange,
  onStartCompare
}: StatusBarProps) {
  // Store - 精确订阅
  const bottomPanel = useWorkspaceUIStore((state) => state.bottomPanel)
  const setBottomPanel = useWorkspaceUIStore((state) => state.setBottomPanel)
  const terminalTabCount = useWorkspaceUIStore((state) => state.terminalTabCount)
  const workspaceRoot = useWorkspaceStore((state) => state.workspaceRoot)
  const diagnostics = useWorkspaceStore((state) => state.diagnostics)

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics]
  )
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics]
  )

  const handleTogglePanel = (panel: 'terminal' | 'problems') => {
    if (bottomPanel === panel) {
      setBottomPanel(null)
    } else {
      setBottomPanel(panel)
    }
  }

  return (
    <div className="flex h-8 items-center justify-between border-t border-border/50 bg-muted/30 px-2 text-xs select-none">
      {/* 左侧：项目信息 + 底部面板切换按钮 */}
      <div className="flex items-center gap-2">
        {/* 项目切换器 */}
        <ProjectSwitcher onProjectChange={onProjectChange} />

        {/* Git 分支切换器 */}
        <GitBranchSwitcher
          hasChanges={hasGitChanges}
          onGitStatusChange={onGitStatusChange}
          onStartCompare={onStartCompare}
        />

        {/* 分隔符 */}
        <div className="h-4 w-px bg-border/50" />

        {/* 底部面板切换按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 gap-1 px-2 hover:bg-accent',
            bottomPanel === 'terminal' && 'bg-accent'
          )}
          onClick={() => handleTogglePanel('terminal')}
          title="切换终端 (Ctrl+`)"
        >
          <Terminal className="size-3.5" />
          <span className="text-xs">终端</span>
          {terminalTabCount > 0 && (
            <span className="ml-1 text-[10px] leading-none text-muted-foreground font-medium">
              {terminalTabCount}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 gap-1 px-2 hover:bg-accent relative',
            bottomPanel === 'problems' && 'bg-accent'
          )}
          onClick={() => handleTogglePanel('problems')}
          title="切换问题面板 (Ctrl+Shift+M)"
        >
          <AlertCircle className="size-3.5" />
          <span className="text-xs">问题</span>
          {(errorCount > 0 || warningCount > 0) && (
            <span className="ml-1 flex items-center gap-0.5">
              {errorCount > 0 && (
                <span className="text-[10px] leading-none text-red-500 font-medium">
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <>
                  {errorCount > 0 && (
                    <span className="text-[10px] leading-none text-muted-foreground">/</span>
                  )}
                  <span className="text-[10px] leading-none text-yellow-500 font-medium">
                    {warningCount}
                  </span>
                </>
              )}
            </span>
          )}
        </Button>
      </div>

      {/* 右侧：编辑器信息 + 代码索引状态 + 通知 */}
      <div className="flex items-center gap-2">
        {/* 编辑器状态（语言、编码、光标位置） */}
        <EditorStatusIndicator />

        {/* 分隔符 */}
        <div className="h-4 w-px bg-border/50" />

        {/* 代码库索引状态 */}
        <CodebaseIndexStatus projectPath={workspaceRoot || ''} />

        {/* 分隔符 */}
        <div className="h-4 w-px bg-border/50" />

        {/* 通知中心 */}
        <NotificationPanel />
      </div>
    </div>
  )
}
