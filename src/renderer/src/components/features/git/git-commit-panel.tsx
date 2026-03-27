import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/sonner'
import {
  Check,
  ChevronDown,
  Undo2,
  RefreshCw,
  Loader2,
  Minus,
  AlertTriangle,
  FileEdit,
  GitMerge,
  X,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/file-icons'
import { GitPushMismatchDialog } from '@/components/features/git/git-push-mismatch-dialog'
import { GitAddRemoteDialog } from '@/components/features/git/git-add-remote-dialog'
import { useGitActions } from '@/hooks/use-git-actions'
import type { GitFileStatus } from '@/types/ide'

interface GitCommitPanelProps {
  workspaceRoot: string
  gitStatus: GitFileStatus | null
  onFileClick?: (
    filePath: string,
    options?: { isDeleted?: boolean; showDiff?: boolean; showConflict?: boolean }
  ) => void
  onRefresh: () => void
  onOpenHistory?: () => void
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

interface FileItem {
  path: string
  status: 'modified' | 'deleted' | 'untracked' | 'conflicted'
}

// 获取文件状态标记和颜色
function getStatusInfo(status: FileItem['status']) {
  switch (status) {
    case 'modified':
      return { label: 'M', color: 'text-blue-500', bg: 'bg-blue-500/10' }
    case 'deleted':
      return { label: 'D', color: 'text-red-500', bg: 'bg-red-500/10' }
    case 'untracked':
      return { label: 'U', color: 'text-green-500', bg: 'bg-green-500/10' }
    case 'conflicted':
      return { label: 'C', color: 'text-orange-500', bg: 'bg-orange-500/10' }
    default:
      return { label: '?', color: 'text-muted-foreground', bg: 'bg-muted' }
  }
}

// 获取文件名和目录
function getFileInfo(path: string) {
  const parts = path.split('/')
  const fileName = parts.pop() || path
  const directory = parts.join('/')
  return { fileName, directory }
}

// 自定义 Checkbox 组件 - 更小更精致
function MiniCheckbox({
  checked,
  indeterminate,
  onChange,
  className
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        'size-[14px] rounded-[3px] border flex items-center justify-center shrink-0 transition-all duration-150',
        checked || indeterminate
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-muted-foreground/40 hover:border-muted-foreground/60 bg-transparent',
        className
      )}
    >
      {checked && <Check className="size-2.5 stroke-3" />}
      {indeterminate && !checked && <Minus className="size-2.5 stroke-3" />}
    </button>
  )
}

// 放弃更改确认对话框 - 内部管理"不再提醒"状态
function DiscardConfirmDialog({
  open,
  type,
  file,
  allFilesCount,
  onClose,
  onConfirm
}: {
  open: boolean
  type: 'all' | 'single'
  file?: string
  allFilesCount: number
  onClose: () => void
  onConfirm: (dontAskAgain: boolean) => void
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // 对话框关闭时重置状态
  const handleClose = () => {
    setDontAskAgain(false)
    onClose()
  }

  const handleConfirm = () => {
    onConfirm(dontAskAgain)
    setDontAskAgain(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-500" />
            {type === 'all' ? '放弃所有更改？' : '放弃更改？'}
          </DialogTitle>
          <DialogDescription>
            {type === 'all'
              ? `将放弃 ${allFilesCount} 个文件的所有更改，此操作无法撤销。`
              : `将放弃对 "${file?.split('/').pop()}" 的更改，此操作无法撤销。`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="dont-ask-again"
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked as boolean)}
          />
          <Label
            htmlFor="dont-ask-again"
            className="text-sm font-normal text-muted-foreground cursor-pointer"
          >
            不再提醒
          </Label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            放弃更改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GitCommitPanel({
  workspaceRoot,
  gitStatus: status,
  onFileClick,
  onRefresh,
  onOpenHistory,
  expanded: controlledExpanded,
  onExpandedChange
}: GitCommitPanelProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isAmend, setIsAmend] = useState(false)
  const [lastCommitInfo, setLastCommitInfo] = useState<{
    hash: string
    shortHash: string
    message: string
    author: string
    date: string
    files: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }>
    isPushed: boolean
  } | null>(null)
  const [showPushWarning, setShowPushWarning] = useState(false)
  const [pendingAmendAction, setPendingAmendAction] = useState<'commit' | 'commitAndPush' | null>(
    null
  )
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)
  const [showAddRemoteDialog, setShowAddRemoteDialog] = useState(false)

  // 放弃更改确认对话框
  const [discardConfirm, setDiscardConfirm] = useState<{
    open: boolean
    type: 'all' | 'single'
    file?: string
  }>({ open: false, type: 'all' })

  // 是否跳过确认（每个场景独立）
  const [skipDiscardAllConfirm, setSkipDiscardAllConfirm] = useState(() => {
    return localStorage.getItem('git:skipDiscardAllConfirm') === 'true'
  })
  const [skipDiscardFileConfirm, setSkipDiscardFileConfirm] = useState(() => {
    return localStorage.getItem('git:skipDiscardFileConfirm') === 'true'
  })

  // 使用统一的 Git 操作 hook
  const gitActions = useGitActions({
    workspaceRoot,
    onSuccess: onRefresh,
    onOpenHistory
  })

  // 支持受控和非受控模式
  const changesExpanded = controlledExpanded ?? internalExpanded
  const setChangesExpanded = (value: boolean) => {
    setInternalExpanded(value)
    onExpandedChange?.(value)
  }

  // 冲突文件列表
  const conflictFiles: FileItem[] = useMemo(() => {
    if (!status) return []
    return status.conflicted.map((f) => ({ path: f, status: 'conflicted' as const }))
  }, [status])

  // 非冲突的变更文件（包括 staged 和 unstaged）
  const changeFiles: FileItem[] = useMemo(() => {
    if (!status) return []

    // 用 Set 去重（同一文件可能同时在 staged 和 modified 中）
    const fileMap = new Map<string, FileItem>()
    const conflictedSet = new Set(status.conflicted)

    // staged 文件（根据文件是否存在判断是新增还是修改）
    status.staged.forEach((f) => {
      // 跳过冲突文件，它们在 conflictFiles 中
      if (conflictedSet.has(f)) return
      // staged 的文件可能是新增（untracked 被 stage）或修改
      // 这里统一标记为 modified，因为用户角度看都是"有变更"
      if (!fileMap.has(f)) {
        fileMap.set(f, { path: f, status: 'modified' })
      }
    })

    // 工作区的变更会覆盖 staged 的状态显示
    status.modified.forEach((f) => {
      if (!conflictedSet.has(f)) {
        fileMap.set(f, { path: f, status: 'modified' })
      }
    })
    status.deleted.forEach((f) => {
      if (!conflictedSet.has(f)) {
        fileMap.set(f, { path: f, status: 'deleted' })
      }
    })
    status.untracked.forEach((f) => {
      if (!conflictedSet.has(f)) {
        fileMap.set(f, { path: f, status: 'untracked' })
      }
    })

    return Array.from(fileMap.values())
  }, [status])

  // 合并所有文件（用于选择状态管理）
  const allFiles: FileItem[] = useMemo(() => {
    return [...conflictFiles, ...changeFiles]
  }, [conflictFiles, changeFiles])

  // 当文件列表变化时，默认全选
  useEffect(() => {
    const allPaths = new Set(allFiles.map((f) => f.path))
    setSelectedFiles(allPaths)
  }, [allFiles])

  // 快捷键支持：Ctrl+Shift+A 切换 Amend 模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault()
        setIsAmend((prev) => {
          if (!prev && workspaceRoot) {
            // 打开 Amend 模式时获取上次提交信息
            window.api.git.getLastCommitInfo(workspaceRoot).then((info) => {
              setLastCommitInfo(info)
              if (info && !message.trim()) {
                setMessage(info.message)
              }
            })
          }
          if (prev) {
            // 关闭 Amend 模式时清理
            setLastCommitInfo(null)
          }
          return !prev
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [workspaceRoot, message])

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedFiles.size === allFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(allFiles.map((f) => f.path)))
    }
  }

  // 实际执行放弃单个文件
  const doDiscardFile = async (file: string) => {
    try {
      await window.api.git.discardFileChanges(workspaceRoot, file)
      onRefresh()
      toast.success(t('git.discard_changes_success'))
    } catch (error) {
      toast.error(t('git.discard_changes_failed'), {
        description: error instanceof Error ? error.message : t('git.unknown_error')
      })
    }
  }

  // 实际执行放弃所有更改
  const doDiscardAll = async () => {
    if (!status) return
    const allFilesToDiscard = [
      ...new Set([
        ...status.staged,
        ...status.modified,
        ...status.deleted,
        ...status.untracked,
        ...status.conflicted
      ])
    ]
    if (allFilesToDiscard.length === 0) return

    try {
      for (const file of allFilesToDiscard) {
        await window.api.git.discardFileChanges(workspaceRoot, file)
      }
      onRefresh()
      toast.success(t('git.discard_all_success'))
    } catch (error) {
      toast.error(t('git.discard_changes_failed'), {
        description: error instanceof Error ? error.message : t('git.unknown_error')
      })
    }
  }

  // 触发放弃单个文件（可能需要确认）
  const handleDiscardFile = (file: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (skipDiscardFileConfirm) {
      doDiscardFile(file)
    } else {
      setDiscardConfirm({ open: true, type: 'single', file })
    }
  }

  // 触发放弃所有更改（始终需要确认，除非选择了"不再提醒"）
  const handleDiscardAll = () => {
    if (skipDiscardAllConfirm) {
      doDiscardAll()
    } else {
      setDiscardConfirm({ open: true, type: 'all' })
    }
  }

  // 确认放弃操作
  const confirmDiscard = async (dontAskAgain: boolean) => {
    const isAll = discardConfirm.type === 'all'

    if (dontAskAgain) {
      if (isAll) {
        localStorage.setItem('git:skipDiscardAllConfirm', 'true')
        setSkipDiscardAllConfirm(true)
      } else {
        localStorage.setItem('git:skipDiscardFileConfirm', 'true')
        setSkipDiscardFileConfirm(true)
      }
    }

    setDiscardConfirm({ open: false, type: 'all' })

    if (isAll) {
      await doDiscardAll()
    } else if (discardConfirm.file) {
      await doDiscardFile(discardConfirm.file)
    }
  }

  // 冲突处理：中止合并（需要二次确认）
  const confirmAbortMerge = async () => {
    setShowAbortConfirm(false)
    try {
      await window.api.git.abortMerge(workspaceRoot)
      onRefresh()
      toast.success(t('git.abort_merge_success'))
    } catch (error) {
      toast.error(t('git.abort_merge_failed'), {
        description: error instanceof Error ? error.message : t('git.unknown_error')
      })
    }
  }

  // 冲突处理：批量接受某一方的更改
  const handleAcceptAll = async (side: 'ours' | 'theirs') => {
    if (conflictFiles.length === 0) return
    const isOurs = side === 'ours'
    try {
      const files = conflictFiles.map((f) => f.path)
      if (isOurs) {
        await window.api.git.acceptAllOurs(workspaceRoot, files)
      } else {
        await window.api.git.acceptAllTheirs(workspaceRoot, files)
      }
      onRefresh()
      toast.success(isOurs ? t('git.accept_local_success') : t('git.accept_remote_success'), {
        description: t('git.conflicts_resolved', { count: conflictFiles.length })
      })
    } catch (error) {
      toast.error(isOurs ? t('git.accept_local_failed') : t('git.accept_remote_failed'), {
        description: error instanceof Error ? error.message : t('git.unknown_error')
      })
    }
  }

  // 检查是否有远程仓库
  const checkRemoteExists = async (): Promise<boolean> => {
    try {
      const remotes = await window.api.git.getRemotes(workspaceRoot)
      return remotes.length > 0
    } catch (error) {
      console.error('Failed to check remotes:', error)
      return false
    }
  }

  // 添加远程仓库
  const handleAddRemote = async (name: string, url: string) => {
    await window.api.git.addRemote(workspaceRoot, name, url)
    toast.success(t('git.add_remote_success', { name }))
    onRefresh()
  }

  // Push操作（带remote检测）
  const handlePushWithRemoteCheck = async () => {
    if (!status) return
    const hasRemote = await checkRemoteExists()
    if (!hasRemote) {
      setShowAddRemoteDialog(true)
      return
    }
    await gitActions.push(status.branch)
  }

  const doCommit = async (action: 'commit' | 'commitAndPush'): Promise<boolean> => {
    setCommitting(true)
    try {
      const filesToCommit = Array.from(selectedFiles)

      if (isAmend) {
        // Amend 模式：先 stage 选中的文件（如果有），然后 amend
        if (filesToCommit.length > 0) {
          await window.api.git.stageFiles(workspaceRoot, filesToCommit)
        }
        await window.api.git.amendCommit(workspaceRoot, message.trim())
        toast.success(t('git.amend_success'), {
          description:
            filesToCommit.length > 0
              ? t('git.amend_with_files', { count: filesToCommit.length })
              : t('git.amend_message_only')
        })
      } else {
        // 普通提交
        await window.api.git.stageFiles(workspaceRoot, filesToCommit)
        await window.api.git.commit(workspaceRoot, message.trim())
        toast.success(t('git.commit_success'), {
          description: t('git.files_committed', { count: filesToCommit.length })
        })
      }

      setMessage('')
      setIsAmend(false)
      setLastCommitInfo(null)
      onRefresh()

      // 如果需要推送
      if (action === 'commitAndPush' && status) {
        const hasRemote = await checkRemoteExists()
        if (!hasRemote) {
          setShowAddRemoteDialog(true)
          return false
        }
        await gitActions.push(status.branch)
      }
      return true
    } catch (error) {
      toast.error(isAmend ? t('git.amend_failed') : t('git.commit_failed'), {
        description: error instanceof Error ? error.message : t('git.unknown_error')
      })
      return false
    } finally {
      setCommitting(false)
    }
  }

  const handleCommit = async () => {
    // Amend 时可以不选择文件（只修改提交消息）
    if (!message.trim() || (!isAmend && selectedFiles.size === 0)) return

    // Amend 已推送提交时显示警告
    if (isAmend && lastCommitInfo?.isPushed) {
      setPendingAmendAction('commit')
      setShowPushWarning(true)
      return
    }

    await doCommit('commit')
  }

  const handleCommitAndPush = async () => {
    if (!message.trim() || (!isAmend && selectedFiles.size === 0)) return

    // Amend 已推送提交时显示警告
    if (isAmend && lastCommitInfo?.isPushed) {
      setPendingAmendAction('commitAndPush')
      setShowPushWarning(true)
      return
    }

    await doCommit('commitAndPush')
  }

  // 确认 Amend 已推送的提交
  const confirmAmendPushed = async () => {
    setShowPushWarning(false)
    if (pendingAmendAction) {
      await doCommit(pendingAmendAction)
    }
    setPendingAmendAction(null)
  }

  if (!status) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <p className="text-xs text-muted-foreground">无法加载 Git 状态</p>
        <Button size="sm" variant="ghost" onClick={onRefresh} className="mt-2">
          <RefreshCw className="size-3 mr-1" />
          重试
        </Button>
      </div>
    )
  }

  const totalChanges = allFiles.length
  const selectedCount = selectedFiles.size
  // Amend 时可以不选择文件（只修改消息）
  const canCommit = message.trim() && (isAmend || selectedCount > 0) && !committing
  const isAllSelected = selectedCount === totalChanges && totalChanges > 0
  const isPartialSelected = selectedCount > 0 && selectedCount < totalChanges

  const renderFileItem = (file: FileItem) => {
    const { fileName, directory } = getFileInfo(file.path)
    const { icon: FileIcon, color: iconColor } = getFileIcon(fileName)
    const isSelected = selectedFiles.has(file.path)
    const statusInfo = getStatusInfo(file.status)

    return (
      <div
        key={file.path}
        className={cn(
          'flex items-center gap-2 px-2 py-[5px] cursor-pointer group transition-colors duration-100',
          isSelected ? 'hover:bg-accent/60' : 'hover:bg-accent/40 opacity-60'
        )}
        onClick={() =>
          onFileClick?.(file.path, {
            isDeleted: file.status === 'deleted',
            showDiff: file.status === 'modified' || file.status === 'deleted',
            showConflict: file.status === 'conflicted'
          })
        }
      >
        {/* Checkbox */}
        <MiniCheckbox checked={isSelected} onChange={() => toggleFile(file.path)} />

        {/* 文件图标 */}
        <FileIcon className={cn('size-4 shrink-0', iconColor)} />

        {/* 文件名和路径 - 只在路径较长时才有意义显示 tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1 flex items-baseline gap-1 truncate">
              <span className="text-[13px] text-foreground truncate">{fileName}</span>
              {directory && (
                <span className="text-[11px] text-muted-foreground/70 truncate">{directory}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs">{file.path}</p>
          </TooltipContent>
        </Tooltip>

        {/* 放弃更改按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => handleDiscardFile(file.path, e)}
            >
              <Undo2 className="size-3 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>放弃更改</TooltipContent>
        </Tooltip>

        {/* 状态标记 */}
        <span
          className={cn(
            'text-[10px] font-semibold px-1 py-0.5 rounded shrink-0',
            statusInfo.color,
            statusInfo.bg
          )}
        >
          {statusInfo.label}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col shrink-0', changesExpanded && 'flex-1 min-h-0')}>
      {/* Changes 标题栏 */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-accent/30 cursor-pointer select-none group shrink-0"
        onClick={() => setChangesExpanded(!changesExpanded)}
      >
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            !changesExpanded && '-rotate-90'
          )}
        />

        {/* 全选 Checkbox */}
        {totalChanges > 0 && (
          <MiniCheckbox
            checked={isAllSelected}
            indeterminate={isPartialSelected}
            onChange={toggleSelectAll}
          />
        )}

        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Changes
        </span>

        {/* 放弃所有更改按钮 */}
        {totalChanges > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDiscardAll()
                }}
              >
                <Undo2 className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>放弃所有更改</TooltipContent>
          </Tooltip>
        )}

        {/* 刷新按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onRefresh()
              }}
            >
              <RefreshCw className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>刷新</TooltipContent>
        </Tooltip>

        {/* 计数器 */}
        <span
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular-nums',
            totalChanges > 0 && selectedCount === totalChanges
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {totalChanges > 0 ? `${selectedCount}/${totalChanges}` : '0'}
        </span>
      </div>

      {/* 内容区域 - CSS Grid 动画 */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          changesExpanded && 'flex-1 min-h-0'
        )}
        style={{ gridTemplateRows: changesExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden flex flex-col min-h-0">
          {/* 输入区域 */}
          <div className="p-2.5 space-y-2.5 shrink-0">
            <Input
              placeholder={isAmend ? 'Amend commit message' : 'Commit message (⌘↵ to commit)'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={committing}
              className="h-8 text-[13px] bg-background/50"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canCommit) {
                  handleCommit()
                }
              }}
            />

            {/* Amend 模式提示 */}
            {isAmend && (
              <div className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md bg-primary/10 text-xs">
                <span className="text-primary font-medium">Amend 模式</span>
                {lastCommitInfo && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono text-muted-foreground">
                      {lastCommitInfo.shortHash}
                    </span>
                  </>
                )}
                {lastCommitInfo?.isPushed && (
                  <AlertTriangle className="size-3 text-yellow-500 ml-auto" />
                )}
                <button
                  onClick={() => setIsAmend(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Commit 按钮 */}
            <div className="flex gap-0">
              <Button
                onClick={handleCommit}
                disabled={!canCommit}
                className="flex-1 h-8 rounded-r-none font-medium"
                size="sm"
              >
                {committing ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="size-3.5 mr-1.5" />
                )}
                {isAmend ? 'Amend Commit' : 'Commit'}
                {selectedCount > 0 && ` (${selectedCount})`}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={!canCommit}
                    className="h-8 px-2 rounded-l-none border-l border-primary-foreground/20"
                    size="sm"
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={handleCommit} disabled={!canCommit}>
                    <Check className="size-4 mr-2" />
                    Commit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setIsAmend(true)
                      if (workspaceRoot) {
                        window.api.git.getLastCommitInfo(workspaceRoot).then((info) => {
                          setLastCommitInfo(info)
                          if (info && !message.trim()) {
                            setMessage(info.message)
                          }
                        })
                      }
                    }}
                  >
                    <FileEdit className="size-4 mr-2" />
                    Commit (Amend)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCommitAndPush} disabled={!canCommit}>
                    <ArrowRight className="size-4 mr-2 -rotate-90" />
                    Commit & Push
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!canCommit || !status) return
                      const hasRemote = await checkRemoteExists()
                      if (!hasRemote) {
                        setShowAddRemoteDialog(true)
                        return
                      }
                      const success = await doCommit('commit')
                      if (!success) return
                      const pullSuccess = await gitActions.pull()
                      if (!pullSuccess) return
                      await gitActions.push(status.branch)
                    }}
                    disabled={!canCommit}
                  >
                    <RefreshCw className="size-4 mr-2" />
                    Commit & Sync
                  </DropdownMenuItem>
                  
                  {/* 分隔线 */}
                  <div className="my-1 h-px bg-border" />
                  
                  {/* 独立的 Push/Pull 操作 - 随时可用 */}
                  <DropdownMenuItem
                    onClick={handlePushWithRemoteCheck}
                    disabled={!status}
                  >
                    <ArrowRight className="size-4 mr-2 -rotate-90" />
                    Push{status?.ahead ? ` (${status.ahead})` : ''}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={gitActions.pull} disabled={!status}>
                    <ArrowRight className="size-4 mr-2 rotate-90" />
                    Pull{status?.behind ? ` (${status.behind})` : ''}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={gitActions.fetch} disabled={!status}>
                    <RefreshCw className="size-4 mr-2" />
                    Fetch
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Push/Pull 操作区域 - 只在有 ahead/behind 时显示 */}
            {status && (status.ahead > 0 || status.behind > 0) && (
              <>
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {status.behind > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8"
                      onClick={gitActions.pull}
                    >
                      <ArrowRight className="size-3.5 mr-1.5 rotate-90" />
                      Pull ({status.behind})
                    </Button>
                  )}
                  {status.ahead > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8"
                      onClick={handlePushWithRemoteCheck}
                    >
                      <ArrowRight className="size-3.5 mr-1.5 -rotate-90" />
                      Push ({status.ahead})
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 冲突提醒横幅 */}
          {conflictFiles.length > 0 && (
            <div className="mx-2.5 mb-2.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <GitMerge className="size-4 text-destructive shrink-0" />
                <span className="text-sm font-medium text-destructive">
                  {conflictFiles.length} 个合并冲突
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">需要手动解决冲突后才能继续提交</p>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-7 text-xs flex flex-1">
                      <Check className="size-3 mr-1.5" />
                      解决全部
                      <ChevronDown className="size-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem onClick={() => handleAcceptAll('ours')}>
                      <ArrowLeft className="size-4 mr-2" />
                      接受本地版本
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAcceptAll('theirs')}>
                      <ArrowRight className="size-4 mr-2" />
                      接受远程版本
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex flex-1"
                      onClick={() => setShowAbortConfirm(true)}
                    >
                      <X className="size-3 mr-1.5" />
                      中止合并
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>放弃合并，恢复到合并前状态</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* 文件列表滚动容器 */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* 冲突文件列表 */}
            {conflictFiles.length > 0 && (
              <div className="mb-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-destructive/70 flex items-center gap-1.5">
                  <GitMerge className="size-3" />
                  Conflicts
                  <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-destructive/15 text-destructive ml-auto">
                    {conflictFiles.length}
                  </span>
                </div>
                <div>{conflictFiles.map(renderFileItem)}</div>
              </div>
            )}

            {/* 变更文件列表 */}
            {changeFiles.length > 0 ? (
              <div className="pb-2">
                {conflictFiles.length > 0 && (
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileEdit className="size-3" />
                    Changes
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-muted ml-auto">
                      {changeFiles.length}
                    </span>
                  </div>
                )}
                {changeFiles.map(renderFileItem)}
              </div>
            ) : totalChanges === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Check className="size-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">没有更改</p>
                <p className="text-xs text-muted-foreground/60 mt-1">工作区是干净的</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Amend 已推送提交的警告对话框 */}
      <Dialog open={showPushWarning} onOpenChange={setShowPushWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-yellow-500" />
              Amend 已推送的提交
            </DialogTitle>
            <DialogDescription>
              此提交已推送到远程仓库。Amend 后会改变提交历史，需要使用{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">git push --force</code>{' '}
              强制推送。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="text-sm p-3 bg-accent/30 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {lastCommitInfo?.shortHash}
                </span>
                <span className="truncate">{lastCommitInfo?.message}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>⚠️ 强制推送可能会影响其他协作者</p>
              <p>⚠️ 如果有人基于此提交进行了开发，他们需要处理冲突</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPushWarning(false)
                setPendingAmendAction(null)
              }}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmAmendPushed}>
              确认 Amend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 中止合并确认对话框 */}
      <Dialog open={showAbortConfirm} onOpenChange={setShowAbortConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-yellow-500" />
              确认中止合并？
            </DialogTitle>
            <DialogDescription>
              中止合并将放弃所有未解决的冲突更改，恢复到合并前的状态。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground py-2 space-y-1">
            <p>• 当前有 {conflictFiles.length} 个冲突文件</p>
            <p>• 所有冲突解决进度将丢失</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbortConfirm(false)}>
              继续解决冲突
            </Button>
            <Button variant="destructive" onClick={confirmAbortMerge}>
              中止合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 放弃更改确认对话框 */}
      <DiscardConfirmDialog
        open={discardConfirm.open}
        type={discardConfirm.type}
        file={discardConfirm.file}
        allFilesCount={allFiles.length}
        onClose={() => setDiscardConfirm({ open: false, type: 'all' })}
        onConfirm={confirmDiscard}
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

      {/* 添加远程仓库对话框 */}
      <GitAddRemoteDialog
        open={showAddRemoteDialog}
        onClose={() => setShowAddRemoteDialog(false)}
        onConfirm={handleAddRemote}
      />
    </div>
  )
}
