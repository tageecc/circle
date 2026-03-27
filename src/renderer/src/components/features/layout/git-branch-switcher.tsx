import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GitBranchMenu, GitBranchMenuRef } from '@/components/features/git/git-branch-menu'
import { GitBranch, ChevronDown } from 'lucide-react'
import { GitNewBranchDialog } from '@/components/features/git/git-new-branch-dialog'
import { GitStashDialog } from '@/components/features/git/git-stash-dialog'
import { GitPushMismatchDialog } from '@/components/features/git/git-push-mismatch-dialog'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useGitStore } from '@/stores/git.store'
import { useGitActions } from '@/hooks/use-git-actions'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface GitBranchSwitcherProps {
  hasChanges?: boolean
  onGitStatusChange?: () => void
  onStartCompare?: (baseBranch: string, compareBranch: string) => void
}

export function GitBranchSwitcher({
  hasChanges,
  onGitStatusChange,
  onStartCompare
}: GitBranchSwitcherProps) {
  const { t } = useTranslation()
  // Store - 精确订阅
  const workspaceRoot = useWorkspaceStore((state) => state.workspaceRoot)
  const setActiveLeftTab = useWorkspaceUIStore((state) => state.setActiveLeftTab)
  
  // 从全局 Git Store 读取状态
  const isGitRepo = useGitStore((state) => state.isGitRepo)
  const currentBranch = useGitStore((state) => state.currentBranch)
  
  const [showNewBranchDialog, setShowNewBranchDialog] = useState(false)
  const [showStashDialog, setShowStashDialog] = useState(false)
  const branchMenuRef = useRef<GitBranchMenuRef>(null)

  // 统一的成功回调
  const handleGitSuccess = useCallback(() => {
    onGitStatusChange?.()
    branchMenuRef.current?.refresh()
  }, [onGitStatusChange])

  // 使用统一的 Git 操作 hook
  const gitActions = useGitActions({
    workspaceRoot: workspaceRoot || '',
    onSuccess: handleGitSuccess,
    onOpenHistory: () => setActiveLeftTab('history')
  })

  // 封装 push，传入当前分支
  const handlePush = useCallback(() => {
    if (currentBranch) {
      gitActions.push(currentBranch)
    }
  }, [currentBranch, gitActions])

  if (!isGitRepo) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs font-normal hover:bg-accent"
          >
            <GitBranch className="size-3.5" />
            <span className={cn("max-w-[120px] truncate", !currentBranch && "opacity-70")}>
              {currentBranch || t('git.no_branch')}
            </span>
            <ChevronDown className="size-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <GitBranchMenu
          ref={branchMenuRef}
          workspaceRoot={workspaceRoot || ''}
          currentBranch={currentBranch}
          hasChanges={hasChanges}
          onCommit={() => setActiveLeftTab('changes')}
          onPush={handlePush}
          onPull={gitActions.pull}
          onFetch={gitActions.fetch}
          onNewBranch={() => setShowNewBranchDialog(true)}
          onStash={() => setShowStashDialog(true)}
          onCheckoutBranch={gitActions.checkout}
          onRefresh={onGitStatusChange || (() => {})}
          onStartCompare={onStartCompare}
        />
      </DropdownMenu>

      <GitNewBranchDialog
        open={showNewBranchDialog}
        workspaceRoot={workspaceRoot || ''}
        currentBranch={currentBranch || ''}
        onClose={() => setShowNewBranchDialog(false)}
        onSuccess={handleGitSuccess}
      />

      <GitStashDialog
        open={showStashDialog}
        workspaceRoot={workspaceRoot || ''}
        currentBranch={currentBranch || ''}
        onClose={() => setShowStashDialog(false)}
        onSuccess={handleGitSuccess}
      />

      <GitPushMismatchDialog
        open={gitActions.pushMismatch.open}
        currentBranch={gitActions.pushMismatch.currentBranch}
        remote={gitActions.pushMismatch.remote}
        trackedBranch={gitActions.pushMismatch.trackedBranch}
        onClose={gitActions.closePushMismatch}
        onPushToTracked={gitActions.pushToTracked}
        onPushAndSetTracking={gitActions.pushAndSetTracking}
      />
    </>
  )
}
