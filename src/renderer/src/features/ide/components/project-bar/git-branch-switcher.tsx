import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GitBranchMenu } from '@/components/git/GitBranchMenu'
import { GitBranch, ChevronDown } from 'lucide-react'

interface GitBranchSwitcherProps {
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

export function GitBranchSwitcher({
  workspaceRoot,
  currentBranch,
  onUpdate,
  onCommit,
  onPush,
  onPull,
  onFetch,
  onNewBranch,
  onCheckoutBranch,
  onRefresh
}: GitBranchSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs font-normal hover:bg-accent"
        >
          <GitBranch className="size-3.5" />
          <span className="max-w-[120px] truncate">{currentBranch}</span>
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <GitBranchMenu
        workspaceRoot={workspaceRoot}
        currentBranch={currentBranch}
        onUpdate={onUpdate}
        onCommit={onCommit}
        onPush={onPush}
        onPull={onPull}
        onFetch={onFetch}
        onNewBranch={onNewBranch}
        onCheckoutBranch={onCheckoutBranch}
        onRefresh={onRefresh}
      />
    </DropdownMenu>
  )
}
