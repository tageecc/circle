import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '../ui/dropdown-menu'
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  Upload,
  Download,
  RefreshCw,
  Plus,
  Check,
  Circle
} from 'lucide-react'

interface GitBranch {
  name: string
  current: boolean
  remote: boolean
}

interface GitBranchMenuProps {
  workspaceRoot: string
  currentBranch: string
  onUpdate: () => void
  onCommit: () => void
  onPush: () => void
  onPull: () => void
  onFetch: () => void
  onNewBranch: () => void
  onCheckoutBranch: (branchName: string) => void
  onRefresh: () => void
}

export function GitBranchMenu({
  workspaceRoot,
  onUpdate,
  onCommit,
  onPush,
  onPull,
  onFetch,
  onNewBranch,
  onCheckoutBranch,
  onRefresh
}: GitBranchMenuProps) {
  const { t } = useTranslation('git')
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [, setLoading] = useState(false)

  useEffect(() => {
    loadBranches()
  }, [workspaceRoot])

  const loadBranches = async () => {
    try {
      setLoading(true)
      const allBranches = await window.api.git.getAllBranches(workspaceRoot)
      setBranches(allBranches)
    } catch (error) {
      console.error('Failed to load branches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckoutBranch = async (branchName: string) => {
    try {
      // 移除 origin/ 前缀（如果是远程分支）
      const cleanBranchName = branchName.replace('origin/', '')
      await onCheckoutBranch(cleanBranchName)
      await loadBranches()
      onRefresh()
    } catch (error) {
      console.error('Failed to checkout branch:', error)
    }
  }

  // 分离本地和远程分支
  const localBranches = branches.filter((b) => !b.remote)
  const remoteBranches = branches.filter((b) => b.remote)

  return (
    <DropdownMenuContent align="start" className="w-[320px]">
      {/* Quick Actions */}
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t('branchMenu.gitOperations')}
      </DropdownMenuLabel>

      <DropdownMenuItem className="cursor-pointer" onClick={onUpdate}>
        <RefreshCw className="mr-2 size-4" />
        <span>{t('branchMenu.updateProject')}</span>
        <span className="ml-auto text-xs text-muted-foreground">⌘T</span>
      </DropdownMenuItem>

      <DropdownMenuItem className="cursor-pointer" onClick={onCommit}>
        <GitCommit className="mr-2 size-4" />
        <span>{t('branchMenu.commit')}</span>
        <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
      </DropdownMenuItem>

      <DropdownMenuItem className="cursor-pointer" onClick={onPush}>
        <Upload className="mr-2 size-4" />
        <span>Push...</span>
        <span className="ml-auto text-xs text-muted-foreground">⇧⌘K</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* Branch Operations */}
      <DropdownMenuItem className="cursor-pointer" onClick={onNewBranch}>
        <Plus className="mr-2 size-4" />
        <span>New Branch...</span>
        <span className="ml-auto text-xs text-muted-foreground">⌥⇧N</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* Local Branches */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <GitBranch className="mr-2 size-4" />
          <span>Checkout Tag or Revision...</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-[300px] w-[280px] overflow-y-auto">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t('branchMenu.localBranches')}
          </DropdownMenuLabel>
          {localBranches.length > 0 ? (
            localBranches.map((branch) => (
              <DropdownMenuItem
                key={branch.name}
                className="cursor-pointer"
                onClick={() => !branch.current && handleCheckoutBranch(branch.name)}
                disabled={branch.current}
              >
                {branch.current ? (
                  <Check className="mr-2 size-4 text-primary" />
                ) : (
                  <Circle className="mr-2 size-4 text-muted-foreground" />
                )}
                <span className={branch.current ? 'font-medium text-primary' : ''}>
                  {branch.name}
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground">{t('branchMenu.noLocalBranches')}</span>
            </DropdownMenuItem>
          )}

          {remoteBranches.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t('branchMenu.remoteBranches')}
              </DropdownMenuLabel>
              {remoteBranches.slice(0, 10).map((branch) => (
                <DropdownMenuItem
                  key={branch.name}
                  className="cursor-pointer"
                  onClick={() => handleCheckoutBranch(branch.name)}
                >
                  <GitPullRequest className="mr-2 size-4 text-muted-foreground" />
                  <span className="text-sm">{branch.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator />

      {/* Remote Operations */}
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t('branchMenu.remote')}
      </DropdownMenuLabel>

      <DropdownMenuItem className="cursor-pointer" onClick={onPull}>
        <Download className="mr-2 size-4" />
        <span>{t('branchMenu.pull')}</span>
      </DropdownMenuItem>

      <DropdownMenuItem className="cursor-pointer" onClick={onFetch}>
        <RefreshCw className="mr-2 size-4" />
        <span>{t('branchMenu.fetch')}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
