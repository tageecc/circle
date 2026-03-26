import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/sonner'
import {
  Archive,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  ChevronDown,
  RefreshCw,
  Plus,
  FileText,
  GitBranch,
  Clock,
  Loader2,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/file-icons'

interface GitStashEntry {
  index: number
  branch: string
  message: string
  date: string
  hash: string
}

interface GitStashPanelProps {
  workspaceRoot: string
  onRefresh?: () => void
  onCreateStash?: () => void
  onFileClick?: (stashIndex: number, filePath: string, stashMessage: string) => void
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`
  return date.toLocaleDateString()
}

export function GitStashPanel({
  workspaceRoot,
  onRefresh,
  onCreateStash,
  onFileClick,
  expanded: controlledExpanded,
  onExpandedChange
}: GitStashPanelProps) {
  const [stashes, setStashes] = useState<GitStashEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(false) // 默认收起

  // 支持受控和非受控模式
  const expanded = controlledExpanded ?? internalExpanded
  const setExpanded = (value: boolean) => {
    setInternalExpanded(value)
    onExpandedChange?.(value)
  }
  const [expandedStash, setExpandedStash] = useState<number | null>(null)
  const [stashFiles, setStashFiles] = useState<Record<number, string[]>>({})
  const [loadingFiles, setLoadingFiles] = useState<number | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'drop' | 'clear' | 'pop'
    index?: number
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 加载 stash 列表
  const loadStashes = useCallback(async () => {
    if (!workspaceRoot) return

    setLoading(true)
    try {
      const list = await window.api.git.stashList(workspaceRoot)
      setStashes(list)
    } catch (error) {
      console.error('Failed to load stashes:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceRoot])

  useEffect(() => {
    loadStashes()
  }, [loadStashes])

  // 加载 stash 文件列表
  const loadStashFiles = useCallback(
    async (index: number) => {
      if (stashFiles[index]) return

      setLoadingFiles(index)
      try {
        const files = await window.api.git.stashShowFiles(workspaceRoot, index)
        setStashFiles((prev) => ({ ...prev, [index]: files }))
      } catch (error) {
        console.error('Failed to load stash files:', error)
      } finally {
        setLoadingFiles(null)
      }
    },
    [workspaceRoot, stashFiles]
  )

  // 展开/收起 stash 文件
  const toggleStashExpand = useCallback(
    (index: number) => {
      if (expandedStash === index) {
        setExpandedStash(null)
      } else {
        setExpandedStash(index)
        loadStashFiles(index)
      }
    },
    [expandedStash, loadStashFiles]
  )

  // Apply stash
  const handleApply = useCallback(
    async (index: number) => {
      setActionLoading(true)
      try {
        await window.api.git.stashApply(workspaceRoot, index)
        toast.success('已恢复到工作区')
        onRefresh?.()
      } catch (error: any) {
        toast.error('恢复失败', {
          description: error.message
        })
      } finally {
        setActionLoading(false)
      }
    },
    [workspaceRoot, onRefresh]
  )

  // Pop stash
  const handlePop = useCallback(
    async (index: number) => {
      setActionLoading(true)
      try {
        await window.api.git.stashPop(workspaceRoot, index)
        toast.success('已恢复并移除')
        await loadStashes()
        // 清除所有文件缓存（因为 stash 索引会重新排列）
        setStashFiles({})
        setExpandedStash(null)
        onRefresh?.()
      } catch (error: any) {
        toast.error('恢复失败', {
          description: error.message
        })
      } finally {
        setActionLoading(false)
        setConfirmDialog(null)
      }
    },
    [workspaceRoot, loadStashes, onRefresh]
  )

  // Drop stash
  const handleDrop = useCallback(
    async (index: number) => {
      setActionLoading(true)
      try {
        await window.api.git.stashDrop(workspaceRoot, index)
        toast.success('已丢弃')
        await loadStashes()
        // 清除所有文件缓存（因为 stash 索引会重新排列）
        setStashFiles({})
        setExpandedStash(null)
      } catch (error: any) {
        toast.error('操作失败', {
          description: error.message
        })
      } finally {
        setActionLoading(false)
        setConfirmDialog(null)
      }
    },
    [workspaceRoot, loadStashes]
  )

  // Clear all stashes
  const handleClearAll = useCallback(async () => {
    setActionLoading(true)
    try {
      await window.api.git.stashClear(workspaceRoot)
      toast.success('已清空全部')
      await loadStashes()
      setStashFiles({})
      setExpandedStash(null)
    } catch (error: any) {
      toast.error('操作失败', {
        description: error.message
      })
    } finally {
      setActionLoading(false)
      setConfirmDialog(null)
    }
  }, [workspaceRoot, loadStashes])

  // 渲染单个 stash 条目
  const renderStashItem = (stash: GitStashEntry) => {
    const isExpanded = expandedStash === stash.index
    const files = stashFiles[stash.index] || []
    const isLoadingThisFiles = loadingFiles === stash.index

    return (
      <div key={stash.index} className="group select-none">
        {/* Stash 主条目 */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-accent/50 cursor-pointer"
          onClick={() => toggleStashExpand(stash.index)}
        >
          {/* 展开/收起图标 */}
          <div className="w-4 shrink-0">
            {isLoadingThisFiles ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
          </div>

          {/* Stash 图标 */}
          <Archive className="size-4 shrink-0 text-primary" />

          {/* Stash 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium truncate">
                {stash.message || `stash@{${stash.index}}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <GitBranch className="size-3" />
                {stash.branch}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="size-3" />
                {formatRelativeTime(stash.date)}
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleApply(stash.index)
                  }}
                  disabled={actionLoading}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>恢复到工作区</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => e.stopPropagation()}
                  disabled={actionLoading}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleApply(stash.index)}>
                  <RotateCcw className="mr-2 size-4" />
                  恢复
                  <span className="ml-auto text-[10px] text-muted-foreground">保留此条</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setConfirmDialog({ type: 'pop', index: stash.index })}
                >
                  <RotateCcw className="mr-2 size-4" />
                  恢复并移除
                  <span className="ml-auto text-[10px] text-muted-foreground">移除此条</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDialog({ type: 'drop', index: stash.index })}
                >
                  <Trash2 className="mr-2 size-4" />
                  丢弃
                  <span className="ml-auto text-[10px] text-muted-foreground">不恢复</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 文件列表 */}
        {isExpanded && files.length > 0 && (
          <div className="pl-8 pr-2 pb-1">
            {files.map((file) => {
              const fileName = file.split('/').pop() || file
              const { icon: FileIcon, color: iconColor } = getFileIcon(fileName)
              return (
                <div
                  key={file}
                  className="flex items-center gap-1.5 py-0.5 text-[12px] text-muted-foreground/80 hover:text-foreground hover:bg-accent/30 rounded px-1 -mx-1 cursor-pointer select-none"
                  onClick={() => onFileClick?.(stash.index, file, stash.message)}
                >
                  <FileIcon className={cn('size-3.5 shrink-0', iconColor)} />
                  <span className="truncate">{fileName}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col shrink-0', expanded && 'flex-1 min-h-0')}>
      {/* 标题栏 */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-accent/30 cursor-pointer select-none group shrink-0"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            !expanded && '-rotate-90'
          )}
        />
        <Archive className="size-4 text-muted-foreground" />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stashes
        </span>

        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateStash?.()
                }}
              >
                <Plus className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>创建 Stash</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation()
                  loadStashes()
                }}
                disabled={loading}
              >
                <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>刷新</p>
            </TooltipContent>
          </Tooltip>

          {stashes.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDialog({ type: 'clear' })
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>清空所有 Stash</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* 数量标记 */}
        <span className="text-[11px] tabular-nums text-muted-foreground mr-1">
          {stashes.length}
        </span>
      </div>

      {/* Stash 列表 - CSS Grid 动画 */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded && 'flex-1 min-h-0'
        )}
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-y-auto flex flex-col min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : stashes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <FileText className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">没有 stash</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={onCreateStash}
              >
                <Plus className="size-3 mr-1" />
                创建 Stash
              </Button>
            </div>
          ) : (
            stashes.map(renderStashItem)
          )}
        </div>
      </div>

      {/* 确认对话框 */}
      <Dialog
        open={confirmDialog !== null}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent className="sm:max-w-[360px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'clear'
                ? '清空全部?'
                : confirmDialog?.type === 'drop'
                  ? '丢弃此暂存?'
                  : '恢复并移除?'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'clear'
                ? '将删除所有暂存的更改，此操作无法撤销。'
                : confirmDialog?.type === 'drop'
                  ? '将丢弃这些更改，此操作无法撤销。'
                  : '更改将恢复到工作区，此暂存将被移除。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={actionLoading}
            >
              取消
            </Button>
            <Button
              variant={confirmDialog?.type !== 'pop' ? 'destructive' : 'default'}
              onClick={() => {
                if (confirmDialog?.type === 'clear') {
                  handleClearAll()
                } else if (confirmDialog?.type === 'drop' && confirmDialog.index !== undefined) {
                  handleDrop(confirmDialog.index)
                } else if (confirmDialog?.type === 'pop' && confirmDialog.index !== undefined) {
                  handlePop(confirmDialog.index)
                }
              }}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {confirmDialog?.type === 'clear'
                ? '清空'
                : confirmDialog?.type === 'drop'
                  ? '丢弃'
                  : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
