import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import {
  GitBranch,
  GitCommit,
  Upload,
  Download,
  RefreshCw,
  Plus,
  Check,
  Archive,
  Trash2,
  Cloud,
  ChevronDown,
  ChevronRight,
  Search,
  GitMerge,
  Pencil,
  GitCompare,
  Tag,
  CornerDownRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface GitBranchData {
  name: string
  current: boolean
  remote: boolean
}

interface GitTagData {
  name: string
  hash: string
  message?: string
  date?: string
}

interface GitBranchMenuProps {
  workspaceRoot: string
  currentBranch: string | null
  hasChanges?: boolean
  onCommit: () => void
  onPush: () => void
  onPull: () => void
  onFetch: () => void
  onNewBranch: () => void
  onStash: () => void
  onCheckoutBranch: (branchName: string) => void
  onRefresh: () => void
  onStartCompare?: (baseBranch: string, compareBranch: string) => void
}

// 最近切换的分支存储（使用 SQLite）
async function getRecentBranches(workspaceRoot: string): Promise<string[]> {
  try {
    return await window.api.recentBranches.get(workspaceRoot, 5)
  } catch {
    return []
  }
}

async function addRecentBranch(workspaceRoot: string, branchName: string): Promise<void> {
  try {
    await window.api.recentBranches.add(workspaceRoot, branchName)
  } catch (error) {
    console.error('Failed to save recent branch:', error)
  }
}

export interface GitBranchMenuRef {
  refresh: () => void
}

export const GitBranchMenu = forwardRef<GitBranchMenuRef, GitBranchMenuProps>(
  function GitBranchMenu(
    {
      workspaceRoot,
      currentBranch,
      hasChanges = false,
      onCommit,
      onPush,
      onPull,
      onFetch,
      onNewBranch,
      onStash,
      onCheckoutBranch,
      onRefresh,
      onStartCompare
    },
    ref
  ) {
    const { t } = useTranslation()
    const [branches, setBranches] = useState<GitBranchData[]>([])
    const [tags, setTags] = useState<GitTagData[]>([])
    const [recentBranches, setRecentBranches] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedSections, setExpandedSections] = useState({
      recent: true,
      local: true,
      remote: false,
      tags: false
    })

    const currentBranchDisplay = currentBranch || t('git.current_branch')
    const isLoadingRef = useRef(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // 对话框状态
    const [deleteDialog, setDeleteDialog] = useState<{
      open: boolean
      branch: string
      isRemote: boolean
      remoteName?: string
      isForceConfirm?: boolean // 是否是强制删除确认
    }>({
      open: false,
      branch: '',
      isRemote: false
    })
    const [renameDialog, setRenameDialog] = useState<{
      open: boolean
      branch: string
      newName: string
      hasTracking: boolean
      trackingRemote: string
      trackingBranch: string
      // 'keep' = 保持追踪（push时选择）, 'rename' = 同时重命名远程, 'unset' = 取消追踪
      remoteAction: 'keep' | 'rename' | 'unset'
    }>({
      open: false,
      branch: '',
      newName: '',
      hasTracking: false,
      trackingRemote: '',
      trackingBranch: '',
      remoteAction: 'keep'
    })

    // 创建 Tag 对话框
    const [createTagDialog, setCreateTagDialog] = useState<{
      open: boolean
      name: string
      message: string
    }>({
      open: false,
      name: '',
      message: ''
    })

    const loadBranches = useCallback(async () => {
      if (isLoadingRef.current) return
      isLoadingRef.current = true
      try {
        const [allBranches, allTags, recent] = await Promise.all([
          window.api.git.getAllBranches(workspaceRoot),
          window.api.git.listTags(workspaceRoot),
          getRecentBranches(workspaceRoot)
        ])
        setBranches(allBranches)
        setTags(allTags)
        setRecentBranches(recent)
      } catch (error) {
        console.error('Failed to load branches:', error)
      } finally {
        isLoadingRef.current = false
      }
    }, [workspaceRoot])

    useEffect(() => {
      loadBranches()
    }, [loadBranches])

    // 暴露 refresh 方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        refresh: loadBranches
      }),
      [loadBranches]
    )

    // 自动聚焦搜索框
    useEffect(() => {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }, [])

    const handleCheckout = async (branchName: string) => {
      const cleanName = branchName.replace('origin/', '')
      await addRecentBranch(workspaceRoot, cleanName)
      await onCheckoutBranch(cleanName)
      await loadBranches()
      onRefresh()
    }

    const handleDelete = async () => {
      const { branch: branchName, isRemote, remoteName, isForceConfirm } = deleteDialog
      setDeleteDialog({ open: false, branch: '', isRemote: false })

      if (isRemote && remoteName) {
        // 删除远程分支
        try {
          await window.api.git.deleteRemoteBranch(workspaceRoot, remoteName, branchName)
          toast.success(`Deleted Remote Branch: ${remoteName}/${branchName}`)
          await loadBranches()
          onRefresh()
        } catch (e: any) {
          toast.error(t('git.delete_remote_branch_failed'), { description: e.message })
        }
        return
      }

      // 删除前获取信息（用于恢复和删除远程分支），失败时使用默认值
      let commitHash = ''
      let tracking: { remote: string; branch: string } | null = null
      try {
        ;[commitHash, tracking] = await Promise.all([
          window.api.git.getBranchCommit(workspaceRoot, branchName),
          window.api.git.getTrackingBranch(workspaceRoot, branchName)
        ])
      } catch {
        // 获取信息失败不影响删除操作
      }

      const showSuccessToast = () => {
        const toastId = `delete-branch-${Date.now()}`

        const handleRestore = async () => {
          toast.dismiss(toastId)
          try {
            await window.api.git.createBranch(workspaceRoot, branchName, true, commitHash)
            toast.success(`已恢复分支 ${branchName}`)
            await loadBranches()
            onRefresh()
          } catch (e: any) {
            toast.error(t('git.restore_failed'), { description: e.message })
          }
        }

        const handleDeleteTracked = async () => {
          if (!tracking) return
          toast.dismiss(toastId)
          try {
            await window.api.git.deleteRemoteBranch(workspaceRoot, tracking.remote, tracking.branch)
            toast.success(`Deleted Remote Branch: ${tracking.remote}/${tracking.branch}`)
            await loadBranches()
            onRefresh()
          } catch (e: any) {
            toast.error(t('git.delete_remote_branch_failed'), { description: e.message })
          }
        }

        toast.success(`Deleted Branch: ${branchName}`, {
          id: toastId,
          duration: 8000,
          description:
            commitHash || tracking
              ? ((
                  <div className="flex items-center gap-3 mt-1">
                    {commitHash && (
                      <button
                        onClick={handleRestore}
                        className="text-primary hover:underline text-sm font-medium cursor-pointer"
                      >
                        Restore
                      </button>
                    )}
                    {tracking && (
                      <button
                        onClick={handleDeleteTracked}
                        className="text-primary hover:underline text-sm font-medium cursor-pointer"
                      >
                        Delete Tracked Branch
                      </button>
                    )}
                  </div>
                ) as any)
              : undefined
        })
      }

      // 强制删除
      if (isForceConfirm) {
        try {
          await window.api.git.deleteBranch(workspaceRoot, branchName, true)
          await loadBranches()
          onRefresh()
          showSuccessToast()
        } catch (e: any) {
          toast.error(t('git.delete_failed'), { description: e.message })
        }
        return
      }

      // 普通删除
      try {
        await window.api.git.deleteBranch(workspaceRoot, branchName, false)
        await loadBranches()
        onRefresh()
        showSuccessToast()
      } catch {
        // 删除失败，显示强制删除确认弹窗
        setDeleteDialog({
          open: true,
          branch: branchName,
          isRemote: false,
          isForceConfirm: true
        })
      }
    }

    const handleRename = async () => {
      const { branch, newName, remoteAction, trackingRemote, trackingBranch } = renameDialog
      const trimmedName = newName.trim()

      if (!trimmedName || trimmedName === branch) {
        setRenameDialog({
          open: false,
          branch: '',
          newName: '',
          hasTracking: false,
          trackingRemote: '',
          trackingBranch: '',
          remoteAction: 'keep'
        })
        return
      }

      setRenameDialog({
        open: false,
        branch: '',
        newName: '',
        hasTracking: false,
        trackingRemote: '',
        trackingBranch: '',
        remoteAction: 'keep'
      })

      try {
        // 1. 重命名本地分支
        await window.api.git.renameBranch(workspaceRoot, branch, trimmedName)

        // 2. 根据选择处理远程分支
        if (remoteAction === 'rename' && trackingRemote && trackingBranch) {
          // 同时重命名远程分支：删除旧的 + 推送新的 + 设置追踪
          try {
            // 删除旧的远程分支
            await window.api.git.deleteRemoteBranch(workspaceRoot, trackingRemote, trackingBranch)
            // 推送新分支并设置追踪
            await window.api.git.push(workspaceRoot, trackingRemote, trimmedName, true)
            toast.success(`已重命名: ${branch} → ${trimmedName}（包括远程分支）`)
          } catch (e: any) {
            // 本地重命名成功但远程操作失败
            toast.warning(`本地分支已重命名，但远程操作失败`, { description: e.message })
          }
        } else if (remoteAction === 'unset') {
          // 取消追踪
          await window.api.git.unsetUpstream(workspaceRoot, trimmedName)
          toast.success(`已重命名: ${branch} → ${trimmedName}（已取消追踪）`)
        } else {
          // 保持追踪关系不变
          toast.success(`已重命名: ${branch} → ${trimmedName}`)
        }

        await loadBranches()
        onRefresh()
      } catch (error: any) {
        toast.error(t('git.rename_failed'), { description: error.message })
      }
    }

    const handleMerge = async (branchName: string) => {
      if (!currentBranch) {
        toast.error(t('git.merge_no_branch'), { description: t('git.merge_no_branch_desc') })
        return
      }
      try {
        const result = await window.api.git.mergeBranch(workspaceRoot, branchName)
        if (result.success) {
          toast.success(`已合并 ${branchName} 到 ${currentBranch}`)
          onRefresh()
        } else {
          toast.warning(t('git.merge_conflict'), { description: result.message })
          onRefresh()
        }
      } catch (error: any) {
        toast.error(t('git.merge_failed'), { description: error.message })
      }
    }

    const handleRebase = async (ontoBranch: string) => {
      if (!currentBranch) {
        toast.error(t('git.rebase_failed'), { description: t('git.rebase_no_branch_desc') })
        return
      }
      try {
        const result = await window.api.git.rebase(workspaceRoot, ontoBranch)
        if (result.success) {
          toast.success(`已将 ${currentBranch} 变基到 ${ontoBranch}`)
          onRefresh()
        } else {
          toast.warning('Rebase 产生冲突', { description: result.message })
          onRefresh()
        }
      } catch (error: any) {
        toast.error('Rebase 失败', { description: error.message })
      }
    }

    const handleCreateTag = async () => {
      try {
        await window.api.git.createTag(workspaceRoot, createTagDialog.name, {
          message: createTagDialog.message || undefined
        })
        toast.success(`已创建标签 ${createTagDialog.name}`)
        setCreateTagDialog({ open: false, name: '', message: '' })
        await loadBranches()
      } catch (error: any) {
        toast.error(t('git.create_tag_failed'), { description: error.message })
      }
    }

    const toggleSection = (section: 'recent' | 'local' | 'remote' | 'tags') => {
      setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
    }

    const localBranches = branches.filter((b) => !b.remote)
    const remoteBranches = branches.filter((b) => b.remote)

    // 搜索过滤
    const filterBranches = (branchList: GitBranchData[]) => {
      if (!searchQuery.trim()) return branchList
      const query = searchQuery.toLowerCase()
      return branchList.filter((b) => b.name.toLowerCase().includes(query))
    }

    const filteredLocalBranches = filterBranches(localBranches)
    const filteredRemoteBranches = filterBranches(remoteBranches)
    const filteredTags = searchQuery
      ? tags.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : tags

    // 过滤出有效的最近分支
    const validRecentBranches = recentBranches
      .filter((name) => {
        const exists = localBranches.some((b) => b.name === name)
        if (!searchQuery.trim()) return exists
        return exists && name.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .slice(0, 5)

    // 是否有搜索结果
    const hasSearchResults =
      validRecentBranches.length > 0 ||
      filteredLocalBranches.length > 0 ||
      filteredRemoteBranches.length > 0 ||
      filteredTags.length > 0

    // 高亮搜索关键字
    const highlightText = (text: string) => {
      if (!searchQuery.trim()) return text
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-500/30 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )
    }

    // 渲染分支项（带子菜单）
    const renderBranchItem = (branch: GitBranchData, isRemote: boolean = false) => {
      const displayName = isRemote ? branch.name.replace(/^origin\//, '') : branch.name
      const hasTracking =
        !isRemote && remoteBranches.some((r) => r.name === `origin/${branch.name}`)

      return (
        <DropdownMenuSub key={branch.name}>
          <DropdownMenuSubTrigger className="gap-2 pl-6">
            <GitBranch
              className={cn(
                'size-4 shrink-0',
                branch.current ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span className={cn('flex-1 truncate', branch.current && 'font-medium text-primary')}>
              {highlightText(displayName)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasTracking && <Cloud className="size-3.5 text-muted-foreground" />}
              {branch.current && <Check className="size-4 text-primary" />}
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[200px]">
            {/* Checkout */}
            <DropdownMenuItem onClick={() => handleCheckout(branch.name)} disabled={branch.current}>
              <Check className="mr-2 size-4" />
              Checkout
            </DropdownMenuItem>

            {/* New Branch from this */}
            <DropdownMenuItem onClick={onNewBranch}>
              <Plus className="mr-2 size-4" />
              New Branch...
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Compare with current */}
            <DropdownMenuItem
              onClick={() => currentBranch && onStartCompare?.(currentBranch, branch.name)}
              disabled={branch.current || !currentBranch}
            >
              <GitCompare className="mr-2 size-4" />
              Compare with '{currentBranchDisplay}'
            </DropdownMenuItem>

            {/* Merge into current */}
            <DropdownMenuItem
              onClick={() => handleMerge(branch.name)}
              disabled={branch.current || !currentBranch}
            >
              <GitMerge className="mr-2 size-4" />
              Merge into '{currentBranchDisplay}'
            </DropdownMenuItem>

            {/* Rebase onto this branch */}
            <DropdownMenuItem
              onClick={() => handleRebase(branch.name)}
              disabled={branch.current || !currentBranch}
            >
              <CornerDownRight className="mr-2 size-4" />
              Rebase '{currentBranchDisplay}' onto This
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Local branch specific actions */}
            {!isRemote && (
              <>
                {/* Rename - 当前分支也可以重命名 */}
                <DropdownMenuItem
                  onClick={async () => {
                    // 获取追踪分支详细信息
                    let trackingRemote = ''
                    let trackingBranch = ''
                    if (hasTracking) {
                      try {
                        const tracking = await window.api.git.getTrackingBranch(
                          workspaceRoot,
                          branch.name
                        )
                        if (tracking) {
                          trackingRemote = tracking.remote
                          trackingBranch = tracking.branch
                        }
                      } catch {
                        // 获取失败，忽略
                      }
                    }
                    setRenameDialog({
                      open: true,
                      branch: branch.name,
                      newName: branch.name,
                      hasTracking,
                      trackingRemote,
                      trackingBranch,
                      remoteAction: 'keep'
                    })
                  }}
                >
                  <Pencil className="mr-2 size-4" />
                  Rename...
                </DropdownMenuItem>

                {/* Unset upstream - 仅当有追踪分支时显示 */}
                {hasTracking && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await window.api.git.unsetUpstream(workspaceRoot, branch.name)
                        toast.success(`已取消 ${branch.name} 的上游分支`)
                        await loadBranches()
                        onRefresh()
                      } catch (e: any) {
                        toast.error(t('git.unset_upstream_failed'), { description: e.message })
                      }
                    }}
                  >
                    <Cloud className="mr-2 size-4" />
                    Unset Upstream Branch
                  </DropdownMenuItem>
                )}

                {/* Delete Local */}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    setDeleteDialog({ open: true, branch: branch.name, isRemote: false })
                  }
                  disabled={branch.current}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}

            {/* Remote branch delete */}
            {isRemote && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  // 远程分支格式: origin/branch-name
                  const parts = branch.name.split('/')
                  const remoteName = parts[0]
                  const remoteBranch = parts.slice(1).join('/')
                  setDeleteDialog({
                    open: true,
                    branch: remoteBranch,
                    isRemote: true,
                    remoteName
                  })
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Delete from Remote
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    // 渲染 Tag 项（带子菜单）
    const renderTagItem = (tag: GitTagData) => {
      const handleCheckoutTag = async () => {
        try {
          await window.api.git.checkoutBranch(workspaceRoot, tag.name)
          toast.success(`已切换到标签 ${tag.name}`)
          onRefresh()
        } catch (error: any) {
          toast.error(t('git.switch_failed'), { description: error.message })
        }
      }

      const handlePushTag = async () => {
        try {
          await window.api.git.pushTag(workspaceRoot, tag.name)
          toast.success(`已推送标签 ${tag.name}`)
        } catch (error: any) {
          toast.error(t('git.push_failed'), { description: error.message })
        }
      }

      const handleDeleteTag = async () => {
        try {
          await window.api.git.deleteTag(workspaceRoot, tag.name)
          toast.success(`已删除标签 ${tag.name}`)
          await loadBranches()
        } catch (error: any) {
          toast.error(t('git.delete_failed'), { description: error.message })
        }
      }

      const handleDeleteRemoteTag = async () => {
        try {
          await window.api.git.deleteRemoteTag(workspaceRoot, tag.name)
          toast.success(`已删除远程标签 ${tag.name}`)
        } catch (error: any) {
          toast.error(t('git.delete_remote_tag_failed'), { description: error.message })
        }
      }

      return (
        <DropdownMenuSub key={tag.name}>
          <DropdownMenuSubTrigger className="gap-2 pl-6">
            <Tag className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{highlightText(tag.name)}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{tag.hash}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[180px]">
            <DropdownMenuItem onClick={handleCheckoutTag}>
              <Check className="mr-2 size-4" />
              Checkout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePushTag}>
              <Upload className="mr-2 size-4" />
              Push to Remote
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDeleteTag}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete Local
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteRemoteTag}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete from Remote
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    // 渲染分组标题（可折叠）
    const renderSectionHeader = (
      label: string,
      section: 'recent' | 'local' | 'remote' | 'tags',
      count?: number
    ) => (
      <DropdownMenuItem
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.preventDefault()
          toggleSection(section)
        }}
      >
        {expandedSections[section] ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {count !== undefined && (
          <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
        )}
      </DropdownMenuItem>
    )

    return (
      <>
        <DropdownMenuContent align="start" className="w-72">
          {/* 搜索框 */}
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto overflow-x-hidden">
            {/* Git 操作 - 搜索时隐藏 */}
            {!searchQuery && (
              <>
                <DropdownMenuItem onClick={onCommit} disabled={!hasChanges}>
                  <GitCommit className="mr-2 size-4" />
                  Commit
                  <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onPush}>
                  <Upload className="mr-2 size-4" />
                  Push
                  <span className="ml-auto text-xs text-muted-foreground">⇧⌘K</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onPull}>
                  <Download className="mr-2 size-4" />
                  Pull
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onFetch}>
                  <RefreshCw className="mr-2 size-4" />
                  Fetch
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onStash} disabled={!hasChanges}>
                  <Archive className="mr-2 size-4" />
                  Stash...
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onNewBranch}>
                  <Plus className="mr-2 size-4" />
                  New Branch...
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setCreateTagDialog({ open: true, name: '', message: '' })}
                >
                  <Tag className="mr-2 size-4" />
                  New Tag...
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            )}

            {/* 搜索无结果 */}
            {searchQuery && !hasSearchResults && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No branches found
              </div>
            )}

            {/* Recent 分支 */}
            {validRecentBranches.length > 0 && (
              <>
                {renderSectionHeader('Recent', 'recent')}
                {expandedSections.recent &&
                  validRecentBranches.map((name) => {
                    const branch = localBranches.find((b) => b.name === name)
                    return branch ? renderBranchItem(branch, false) : null
                  })}
              </>
            )}

            {/* Local 分支 */}
            {filteredLocalBranches.length > 0 && (
              <>
                {validRecentBranches.length > 0 && <DropdownMenuSeparator />}
                {renderSectionHeader('Local', 'local', filteredLocalBranches.length)}
                {expandedSections.local &&
                  filteredLocalBranches.map((branch) => renderBranchItem(branch, false))}
              </>
            )}

            {/* Remote 分支 */}
            {filteredRemoteBranches.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {renderSectionHeader('Remote', 'remote', filteredRemoteBranches.length)}
                {expandedSections.remote &&
                  filteredRemoteBranches.map((branch) => renderBranchItem(branch, true))}
              </>
            )}

            {/* Tags */}
            {filteredTags.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {renderSectionHeader('Tags', 'tags', filteredTags.length)}
                {expandedSections.tags && filteredTags.map((tag) => renderTagItem(tag))}
              </>
            )}

            {/* 无分支 */}
            {!searchQuery && localBranches.length === 0 && remoteBranches.length === 0 && (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No branches
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuContent>

        {/* 删除确认对话框 */}
        <Dialog
          open={deleteDialog.open}
          onOpenChange={(open) =>
            !open && setDeleteDialog({ open: false, branch: '', isRemote: false })
          }
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {deleteDialog.isForceConfirm
                  ? t('git.force_delete_branch')
                  : deleteDialog.isRemote
                    ? t('git.delete_remote_branch')
                    : t('git.delete_branch')}
              </DialogTitle>
              <DialogDescription>
                {deleteDialog.isForceConfirm ? (
                  <>
                    分支 <span className="font-medium text-foreground">{deleteDialog.branch}</span>{' '}
                    未完全合并，是否强制删除？
                  </>
                ) : deleteDialog.isRemote ? (
                  <>
                    确定要从远程仓库{' '}
                    <span className="font-medium text-foreground">{deleteDialog.remoteName}</span>{' '}
                    删除分支{' '}
                    <span className="font-medium text-foreground">{deleteDialog.branch}</span>{' '}
                    吗？此操作不可撤销。
                  </>
                ) : (
                  <>
                    确定要删除分支{' '}
                    <span className="font-medium text-foreground">{deleteDialog.branch}</span>{' '}
                    吗？此操作不可撤销。
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDeleteDialog({ open: false, branch: '', isRemote: false })}
              >
                取消
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {deleteDialog.isForceConfirm ? t('git.force_delete') : t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 重命名对话框 */}
        <Dialog
          open={renameDialog.open}
          onOpenChange={(open) =>
            !open &&
            setRenameDialog({
              open: false,
              branch: '',
              newName: '',
              hasTracking: false,
              trackingRemote: '',
              trackingBranch: '',
              remoteAction: 'keep'
            })
          }
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rename Branch '{renameDialog.branch}'</DialogTitle>
              {renameDialog.hasTracking && (
                <DialogDescription>
                  当前追踪: {renameDialog.trackingRemote}/{renameDialog.trackingBranch}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">New Name:</label>
                <Input
                  value={renameDialog.newName}
                  onChange={(e) =>
                    setRenameDialog((prev) => ({ ...prev, newName: e.target.value }))
                  }
                  placeholder={t('git.new_branch_name')}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  autoFocus
                />
              </div>
              {renameDialog.hasTracking && renameDialog.newName !== renameDialog.branch && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Remote Branch:</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-accent">
                      <input
                        type="radio"
                        name="remoteAction"
                        checked={renameDialog.remoteAction === 'rename'}
                        onChange={() =>
                          setRenameDialog((prev) => ({ ...prev, remoteAction: 'rename' }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">同时重命名远程分支</div>
                        <div className="text-xs text-muted-foreground">
                          删除 {renameDialog.trackingRemote}/{renameDialog.trackingBranch}，推送{' '}
                          {renameDialog.trackingRemote}/{renameDialog.newName}
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-accent">
                      <input
                        type="radio"
                        name="remoteAction"
                        checked={renameDialog.remoteAction === 'keep'}
                        onChange={() =>
                          setRenameDialog((prev) => ({ ...prev, remoteAction: 'keep' }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">保持追踪关系</div>
                        <div className="text-xs text-muted-foreground">
                          Push 时再选择推送到哪个分支
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-accent">
                      <input
                        type="radio"
                        name="remoteAction"
                        checked={renameDialog.remoteAction === 'unset'}
                        onChange={() =>
                          setRenameDialog((prev) => ({ ...prev, remoteAction: 'unset' }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">取消追踪</div>
                        <div className="text-xs text-muted-foreground">不再追踪任何远程分支</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() =>
                  setRenameDialog({
                    open: false,
                    branch: '',
                    newName: '',
                    hasTracking: false,
                    trackingRemote: '',
                    trackingBranch: '',
                    remoteAction: 'keep'
                  })
                }
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={
                  !renameDialog.newName.trim() || renameDialog.newName === renameDialog.branch
                }
              >
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 创建 Tag 对话框 */}
        <Dialog
          open={createTagDialog.open}
          onOpenChange={(open) => {
            if (!open) setCreateTagDialog({ open: false, name: '', message: '' })
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Tag</DialogTitle>
              <DialogDescription>在当前 HEAD 创建一个新标签</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Tag Name:</label>
                <Input
                  value={createTagDialog.name}
                  onChange={(e) =>
                    setCreateTagDialog((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="v1.0.0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && createTagDialog.name.trim()) {
                      handleCreateTag()
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Message (optional):</label>
                <Input
                  value={createTagDialog.message}
                  onChange={(e) =>
                    setCreateTagDialog((prev) => ({ ...prev, message: e.target.value }))
                  }
                  placeholder="Release v1.0.0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setCreateTagDialog({ open: false, name: '', message: '' })}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTag} disabled={!createTagDialog.name.trim()}>
                <Tag className="size-4 mr-2" />
                Create Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }
)
