import { useState, useEffect, useCallback, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import {
  GitCommit as GitCommitIcon,
  Search,
  Loader2,
  RefreshCw,
  FilePlus,
  FileEdit,
  FileMinus,
  FileSymlink,
  RotateCcw,
  User,
  Clock,
  MoreHorizontal,
  GitBranch,
  Tag,
  Undo2,
  X,
  Combine
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/file-icons'

interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
  parents: string[]
  refs?: string[]
}

interface GitCommitFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

interface GitCommitDetail extends GitCommit {
  body: string
  files: GitCommitFile[]
  stats: {
    additions: number
    deletions: number
    filesChanged: number
  }
}

interface GitHistoryPanelProps {
  workspaceRoot: string
  currentBranch: string
  onFileClick?: (filePath: string, commitHash: string) => void
  onRefresh?: () => void
}

const statusConfig = {
  added: { icon: FilePlus, color: 'text-green-500', label: 'A' },
  modified: { icon: FileEdit, color: 'text-yellow-500', label: 'M' },
  deleted: { icon: FileMinus, color: 'text-red-500', label: 'D' },
  renamed: { icon: FileSymlink, color: 'text-blue-500', label: 'R' }
}

function formatCommitDate(dateStr: string, t: TFunction, locale: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('git.time_just_now')
  if (diffMins < 60) return t('git.time_minutes_ago', { count: diffMins })
  if (diffHours < 24) return t('git.time_hours_ago', { count: diffHours })
  if (diffDays < 7) return t('git.time_days_ago', { count: diffDays })

  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatCommitFullDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 解析 ref 字符串
function parseRefs(refs: string[] = []): { heads: string[]; tags: string[]; isHead: boolean } {
  const heads: string[] = []
  const tags: string[] = []
  let isHead = false

  refs.forEach((ref) => {
    if (ref.startsWith('HEAD')) {
      isHead = true
      // "HEAD -> main" 格式
      const match = ref.match(/HEAD -> (.+)/)
      if (match) {
        heads.push(match[1])
      }
    } else if (ref.startsWith('tag:')) {
      tags.push(ref.replace('tag: ', ''))
    } else if (ref.includes('/')) {
      // origin/main 等远程分支
      heads.push(ref)
    } else {
      heads.push(ref)
    }
  })

  return { heads, tags, isHead }
}

// 虚拟滚动的提交列表组件
interface CommitListProps {
  commits: GitCommit[]
  selectedCommit: string | null
  commitDetail: GitCommitDetail | null
  loadingDetail: boolean
  hasMore: boolean
  loadingMore: boolean
  onSelectCommit: (commit: GitCommit) => void
  onResetDialog: (dialog: {
    open: boolean
    commit: GitCommit | null
    mode: 'soft' | 'mixed' | 'hard'
  }) => void
  onRevertCommit: (commit: GitCommit) => void
  onSquashTo: (commit: GitCommit, index: number) => void
  onFileClick: (file: GitCommitFile) => void
  onLoadMore: () => void
  renderRefs: (refs?: string[]) => React.ReactNode
}

function CommitList({
  commits,
  selectedCommit,
  commitDetail,
  loadingDetail,
  hasMore,
  loadingMore,
  onSelectCommit,
  onResetDialog,
  onRevertCommit,
  onSquashTo,
  onFileClick,
  onLoadMore,
  renderRefs
}: CommitListProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const parentRef = useRef<HTMLDivElement>(null)

  // 估算每个提交项的高度
  const estimateSize = useCallback(
    (index: number) => {
      // 最后一个是"加载更多"按钮
      if (index >= commits.length) {
        return 48
      }

      const commit = commits[index]
      const { heads, tags } = parseRefs(commit.refs)
      const hasRefs = heads.length > 0 || tags.length > 0
      const isExpanded = selectedCommit === commit.hash

      // 基础高度：56px，有 refs 时：76px
      let height = hasRefs ? 76 : 56

      // 展开详情时增加高度
      if (isExpanded && commitDetail) {
        // 基础详情高度 + 每个文件 28px
        height += 200 + commitDetail.files.length * 28
      } else if (isExpanded) {
        // 加载中
        height += 60
      }

      return height
    },
    [commits, selectedCommit, commitDetail]
  )

  const virtualizer = useVirtualizer({
    count: commits.length + (hasMore ? 1 : 0), // +1 用于加载更多按钮
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5
  })

  // 当选中的提交改变时，重新测量
  useEffect(() => {
    virtualizer.measure()
  }, [selectedCommit, commitDetail])

  // 滚动到底部时加载更多（使用原生滚动事件）
  useEffect(() => {
    const scrollElement = parentRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      // 距离底部 200px 时触发加载
      if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !loadingMore) {
        onLoadMore()
      }
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [hasMore, loadingMore, onLoadMore])

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const index = virtualRow.index

          // 最后一个是加载更多
          if (index >= commits.length) {
            return (
              <div
                key="load-more"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {loadingMore ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-2">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={onLoadMore}>
                      {t('git.load_more')}
                    </Button>
                  </div>
                )}
              </div>
            )
          }

          const commit = commits[index]
          const { heads, tags, isHead } = parseRefs(commit.refs)
          const isExpanded = selectedCommit === commit.hash

          return (
            <div
              key={commit.hash}
              data-index={index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {/* 提交项 */}
              <div
                className={cn(
                  'flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors group',
                  isExpanded ? 'bg-accent' : 'hover:bg-accent/50'
                )}
                onClick={() => onSelectCommit(commit)}
              >
                {/* 简单的节点标记 */}
                <div className="flex flex-col items-center w-4 shrink-0 pt-0.5">
                  <div
                    className={cn(
                      'size-2.5 rounded-full border-2',
                      index === 0 || isHead
                        ? 'bg-primary border-primary'
                        : 'bg-background border-muted-foreground/50'
                    )}
                  />
                  {index < commits.length - 1 && (
                    <div className="w-0.5 flex-1 min-h-4 bg-muted-foreground/30 mt-1" />
                  )}
                </div>

                {/* 提交信息 */}
                <div className="flex-1 min-w-0">
                  {/* Refs 标签 */}
                  {(heads.length > 0 || tags.length > 0) && (
                    <div className="mb-1">{renderRefs(commit.refs)}</div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">{commit.message}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Reset to this commit
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onResetDialog({ open: true, commit, mode: 'soft' })
                          }}
                        >
                          <RotateCcw className="size-4 mr-2" />
                          Reset Soft
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onResetDialog({ open: true, commit, mode: 'mixed' })
                          }}
                        >
                          <RotateCcw className="size-4 mr-2" />
                          Reset Mixed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onResetDialog({ open: true, commit, mode: 'hard' })
                          }}
                          className="text-destructive"
                        >
                          <RotateCcw className="size-4 mr-2" />
                          Reset Hard
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onRevertCommit(commit)
                          }}
                        >
                          <Undo2 className="size-4 mr-2" />
                          Revert Commit
                        </DropdownMenuItem>
                        {/* Squash - 只有非第一个提交才能 squash */}
                        {virtualRow.index > 0 && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onSquashTo(commit, virtualRow.index)
                            }}
                          >
                            <Combine className="size-4 mr-2" />
                            Squash with Previous
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(commit.hash)
                            toast.success(t('git.copy_hash_success'))
                          }}
                        >
                          {t('git.copy_hash')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{commit.shortHash}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 truncate">
                      <User className="size-3" />
                      {commit.author}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatCommitDate(commit.date, t, locale)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 展开的详情 */}
              {isExpanded && (
                <div className="px-3 py-2 bg-accent/30 border-y border-border/20">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : commitDetail ? (
                    <div className="space-y-3">
                      {/* 详细信息 */}
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-16">Hash:</span>
                          <span className="font-mono">{commitDetail.hash}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-16">Author:</span>
                          <span>
                            {commitDetail.author} &lt;{commitDetail.email}&gt;
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-16">Date:</span>
                          <span>{formatCommitFullDate(commitDetail.date, locale)}</span>
                        </div>
                        {commitDetail.parents.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16">Parents:</span>
                            <span className="font-mono">
                              {commitDetail.parents.map((p) => p.slice(0, 7)).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 提交消息 */}
                      {commitDetail.body && commitDetail.body !== commitDetail.message && (
                        <div className="text-xs whitespace-pre-wrap bg-background/50 p-2 rounded border border-border/30">
                          {commitDetail.body}
                        </div>
                      )}

                      {/* 文件变更统计 */}
                      <div className="flex items-center gap-3 text-xs">
                        <span>{commitDetail.stats.filesChanged} files</span>
                        <span className="text-green-500">+{commitDetail.stats.additions}</span>
                        <span className="text-red-500">-{commitDetail.stats.deletions}</span>
                      </div>

                      {/* 文件列表 */}
                      <div className="space-y-1">
                        {commitDetail.files.map((file) => {
                          const config = statusConfig[file.status]
                          const StatusIcon = config.icon
                          const fileIconConfig = getFileIcon(file.path)
                          const FileTypeIcon = fileIconConfig.icon

                          return (
                            <div
                              key={file.path}
                              className="flex items-center gap-1.5 py-1 px-2 text-xs cursor-pointer rounded hover:bg-accent/50 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                onFileClick(file)
                              }}
                            >
                              <StatusIcon className={cn('size-3.5 shrink-0', config.color)} />
                              <FileTypeIcon
                                className={cn('size-3.5 shrink-0', fileIconConfig.color)}
                              />
                              <span className="truncate flex-1">{file.path}</span>
                              <span className={cn('text-[10px] font-mono', config.color)}>
                                {config.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GitHistoryPanel({
  workspaceRoot,
  currentBranch,
  onFileClick,
  onRefresh
}: GitHistoryPanelProps) {
  const { t } = useTranslation()
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [resetDialog, setResetDialog] = useState<{
    open: boolean
    commit: GitCommit | null
    mode: 'soft' | 'mixed' | 'hard'
  }>({ open: false, commit: null, mode: 'mixed' })

  // 过滤器状态
  const [branches, setBranches] = useState<Array<{ name: string; current: boolean }>>([])
  const [authors, setAuthors] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('') // 空表示当前分支
  const [selectedAuthor, setSelectedAuthor] = useState<string>('') // 空表示所有
  const [showAllBranches, setShowAllBranches] = useState(false)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 加载分支和作者列表
  useEffect(() => {
    if (!workspaceRoot) return

    // 加载分支
    window.api.git.getAllBranches(workspaceRoot).then((data) => {
      setBranches(data.filter((b) => !b.remote))
    })

    // 加载作者
    window.api.git.getAuthors(workspaceRoot).then(setAuthors)
  }, [workspaceRoot])

  // 加载提交历史
  const loadCommits = useCallback(
    async (reset = false) => {
      if (!workspaceRoot) return

      if (reset) {
        setLoading(true)
        setCommits([])
      } else {
        setLoadingMore(true)
      }

      try {
        const skip = reset ? 0 : commits.length
        const result = await window.api.git.getCommitHistory(workspaceRoot, {
          limit: 50,
          skip,
          branch: showAllBranches ? 'all' : selectedBranch || currentBranch,
          author: selectedAuthor || undefined,
          search: searchQuery || undefined
        })

        if (reset) {
          setCommits(result.commits)
        } else {
          setCommits((prev) => [...prev, ...result.commits])
        }
        setHasMore(result.hasMore)
      } catch (error) {
        console.error('Failed to load commit history:', error)
        toast.error(t('git.load_commit_history_failed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      workspaceRoot,
      currentBranch,
      commits.length,
      searchQuery,
      selectedBranch,
      selectedAuthor,
      showAllBranches,
      t
    ]
  )

  // 初始加载
  useEffect(() => {
    loadCommits(true)
  }, [workspaceRoot, currentBranch, selectedBranch, selectedAuthor, showAllBranches])

  // 搜索防抖
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadCommits(true)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  // 加载提交详情
  const loadCommitDetail = useCallback(
    async (hash: string) => {
      if (!workspaceRoot) return

      setLoadingDetail(true)
      try {
        const detail = await window.api.git.getCommitDetail(workspaceRoot, hash)
        setCommitDetail(detail)
      } catch (error) {
        console.error('Failed to load commit detail:', error)
      } finally {
        setLoadingDetail(false)
      }
    },
    [workspaceRoot]
  )

  // 选择提交
  const handleSelectCommit = (commit: GitCommit) => {
    if (selectedCommit === commit.hash) {
      setSelectedCommit(null)
      setCommitDetail(null)
    } else {
      setSelectedCommit(commit.hash)
      loadCommitDetail(commit.hash)
    }
  }

  // Reset 到指定提交
  const handleReset = async () => {
    const { commit, mode } = resetDialog
    if (!commit || !workspaceRoot) return

    try {
      await window.api.git.resetToCommit(workspaceRoot, commit.hash, mode)
      toast.success(t('git.reset_to_commit_success', { shortHash: commit.shortHash }), {
        description: t('git.reset_mode_description', { mode })
      })
      setResetDialog({ open: false, commit: null, mode: 'mixed' })
      loadCommits(true)
      onRefresh?.()
    } catch (error: any) {
      toast.error(t('git.reset_failed'), { description: error.message })
    }
  }

  // Revert 指定提交
  const handleRevert = async (commit: GitCommit) => {
    if (!workspaceRoot) return

    try {
      await window.api.git.revertCommit(workspaceRoot, commit.hash)
      toast.success(t('git.revert_commit_success', { shortHash: commit.shortHash }), {
        description: t('git.revert_commit_created')
      })
      loadCommits(true)
      onRefresh?.()
    } catch (error: any) {
      toast.error(t('git.revert_failed'), { description: error.message })
    }
  }

  // Squash 对话框状态
  const [squashDialog, setSquashDialog] = useState<{
    open: boolean
    commitIndex: number
    message: string
  }>({ open: false, commitIndex: 0, message: '' })

  const handleSquash = async () => {
    if (!workspaceRoot || squashDialog.commitIndex <= 0) return

    try {
      // squashDialog.commitIndex 是目标提交的索引，count = 从 HEAD 到目标的提交数
      const count = squashDialog.commitIndex + 1
      await window.api.git.squashCommits(workspaceRoot, count, squashDialog.message)
      toast.success(t('git.squash_commits_success', { count }))
      setSquashDialog({ open: false, commitIndex: 0, message: '' })
      loadCommits(true)
      onRefresh?.()
    } catch (error: any) {
      toast.error(t('git.squash_failed'), { description: error.message })
    }
  }

  // 点击文件
  const handleFileClick = (file: GitCommitFile) => {
    if (selectedCommit && onFileClick) {
      onFileClick(file.path, selectedCommit)
    }
  }

  // 清除过滤器
  const clearFilters = () => {
    setSelectedBranch('')
    setSelectedAuthor('')
    setShowAllBranches(false)
    setSearchQuery('')
  }

  const hasFilters = selectedBranch || selectedAuthor || showAllBranches || searchQuery

  // 渲染 refs 标签
  const renderRefs = (refs: string[] = []) => {
    const { heads, tags, isHead } = parseRefs(refs)
    if (heads.length === 0 && tags.length === 0) return null

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {heads.map((head, i) => (
          <span
            key={`head-${i}`}
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
              isHead && i === 0
                ? 'bg-primary/20 text-primary'
                : head.includes('/')
                  ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                  : 'bg-green-500/20 text-green-600 dark:text-green-400'
            )}
          >
            <GitBranch className="size-2.5" />
            {head}
          </span>
        ))}
        {tags.map((tag, i) => (
          <span
            key={`tag-${i}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
          >
            <Tag className="size-2.5" />
            {tag}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-foreground uppercase tracking-wide">
          Git History
        </span>
        <div className="flex items-center gap-1">
          {hasFilters && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent/50"
              onClick={clearFilters}
              title={t('git.clear_filters')}
            >
              <X className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/50"
            onClick={() => loadCommits(true)}
            disabled={loading}
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="px-3 py-2 border-b border-border/30 space-y-2">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('git.search_commits_placeholder')}
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* 过滤选项 */}
        <div className="flex items-center gap-2">
          {/* 分支选择 */}
          <Select
            value={showAllBranches ? '__all__' : selectedBranch || '__current__'}
            onValueChange={(v) => {
              if (v === '__all__') {
                setShowAllBranches(true)
                setSelectedBranch('')
              } else if (v === '__current__') {
                setShowAllBranches(false)
                setSelectedBranch('')
              } else {
                setShowAllBranches(false)
                setSelectedBranch(v)
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <GitBranch className="size-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder={t('git.filter_branch_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__current__">
                <span className="flex items-center gap-1">
                  {t('git.filter_current_branch')}
                  <span className="text-muted-foreground">({currentBranch})</span>
                </span>
              </SelectItem>
              <SelectItem value="__all__">
                <span className="text-primary font-medium">{t('git.filter_all_branches')}</span>
              </SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.current && <span className="text-muted-foreground ml-1">(current)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 作者选择 */}
          <Select
            value={selectedAuthor || '__all__'}
            onValueChange={(v) => setSelectedAuthor(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <User className="size-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder={t('git.filter_author_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('git.filter_all_authors')}</SelectItem>
              {authors.map((author) => (
                <SelectItem key={author} value={author}>
                  {author}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 提交列表 - 虚拟滚动 */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <GitCommitIcon className="size-8 mb-2 opacity-20" />
            <span>{t('git.no_commit_history')}</span>
          </div>
        ) : (
          <CommitList
            commits={commits}
            selectedCommit={selectedCommit}
            commitDetail={commitDetail}
            loadingDetail={loadingDetail}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onSelectCommit={handleSelectCommit}
            onResetDialog={setResetDialog}
            onRevertCommit={handleRevert}
            onSquashTo={(_commit, index) => {
              // 收集从 HEAD 到目标提交的所有消息
              const messages = commits
                .slice(0, index + 1)
                .map((c) => c.message)
                .join('\n\n')
              setSquashDialog({
                open: true,
                commitIndex: index,
                message: messages
              })
            }}
            onFileClick={handleFileClick}
            onLoadMore={() => loadCommits(false)}
            renderRefs={renderRefs}
          />
        )}
      </div>

      {/* Reset 确认对话框 */}
      <Dialog
        open={resetDialog.open}
        onOpenChange={(open) => {
          if (!open) setResetDialog({ open: false, commit: null, mode: 'mixed' })
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset to Commit</DialogTitle>
            <DialogDescription>{t('git.reset_dialog_confirm')}</DialogDescription>
          </DialogHeader>

          {resetDialog.commit && (
            <div className="space-y-4 py-2">
              <div className="text-sm space-y-2 p-3 bg-accent/30 rounded-lg">
                <div className="font-medium truncate">{resetDialog.commit.message}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{resetDialog.commit.shortHash}</span>
                  <span className="mx-2">·</span>
                  <span>{resetDialog.commit.author}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('git.reset_mode_label')}</label>
                <div className="space-y-2">
                  {(
                    [
                      { mode: 'soft' as const, title: 'Soft', descKey: 'git.reset_mode_soft_desc' },
                      {
                        mode: 'mixed' as const,
                        title: 'Mixed',
                        descKey: 'git.reset_mode_mixed_desc'
                      },
                      { mode: 'hard' as const, title: 'Hard', descKey: 'git.reset_mode_hard_desc' }
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.mode}
                      className={cn(
                        'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors',
                        resetDialog.mode === opt.mode ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <input
                        type="radio"
                        name="resetMode"
                        checked={resetDialog.mode === opt.mode}
                        onChange={() => setResetDialog((prev) => ({ ...prev, mode: opt.mode }))}
                        className="mt-0.5"
                      />
                      <div>
                        <div
                          className={cn(
                            'text-sm font-medium',
                            opt.mode === 'hard' && 'text-destructive'
                          )}
                        >
                          {opt.title}
                        </div>
                        <div className="text-xs text-muted-foreground">{t(opt.descKey)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialog({ open: false, commit: null, mode: 'mixed' })}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant={resetDialog.mode === 'hard' ? 'destructive' : 'default'}
              onClick={handleReset}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Squash Dialog */}
      <Dialog
        open={squashDialog.open}
        onOpenChange={(open) => {
          if (!open) setSquashDialog({ open: false, commitIndex: 0, message: '' })
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Squash Commits</DialogTitle>
            <DialogDescription>
              {t('git.squash_dialog_description', { count: squashDialog.commitIndex + 1 })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground p-2 rounded bg-yellow-500/10 text-yellow-600">
              ⚠️ {t('git.squash_history_warning')}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('git.squash_combined_message_label')}
              </label>
              <Textarea
                value={squashDialog.message}
                onChange={(e) => setSquashDialog((prev) => ({ ...prev, message: e.target.value }))}
                placeholder={t('git.squash_combined_message_placeholder')}
                className="min-h-[120px] text-sm font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSquashDialog({ open: false, commitIndex: 0, message: '' })}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSquash} disabled={!squashDialog.message.trim()}>
              <Combine className="size-4 mr-2" />
              Squash {squashDialog.commitIndex + 1} Commits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
