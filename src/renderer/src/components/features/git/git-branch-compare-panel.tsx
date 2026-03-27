import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  GitBranch,
  ArrowLeftRight,
  FilePlus,
  FileEdit,
  FileMinus,
  FileSymlink,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  Folder,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BranchCompareFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

interface GitBranchComparePanelProps {
  workspaceRoot: string
  baseBranch: string
  compareBranch: string
  onFileClick: (file: BranchCompareFile) => void
  onClose: () => void
  onSwapBranches?: () => void
}

const statusConfig = {
  added: { icon: FilePlus, color: 'text-green-500', label: 'A' },
  modified: { icon: FileEdit, color: 'text-yellow-500', label: 'M' },
  deleted: { icon: FileMinus, color: 'text-red-500', label: 'D' },
  renamed: { icon: FileSymlink, color: 'text-blue-500', label: 'R' }
}

// 构建文件树结构
interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children: Map<string, FileTreeNode>
  file?: BranchCompareFile
}

function buildFileTree(files: BranchCompareFile[]): FileTreeNode {
  const root: FileTreeNode = { name: '', path: '', isDir: true, children: new Map() }

  files.forEach((file) => {
    const parts = file.path.split('/')
    let current = root

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      const currentPath = parts.slice(0, index + 1).join('/')

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          isDir: !isLast,
          children: new Map(),
          file: isLast ? file : undefined
        })
      }

      current = current.children.get(part)!
    })
  })

  return root
}

// 递归获取目录下的文件数量
function getFileCount(node: FileTreeNode): number {
  if (!node.isDir) return 1
  let count = 0
  node.children.forEach((child) => {
    count += getFileCount(child)
  })
  return count
}

export function GitBranchComparePanel({
  workspaceRoot,
  baseBranch,
  compareBranch,
  onFileClick,
  onClose,
  onSwapBranches
}: GitBranchComparePanelProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<BranchCompareFile[]>([])
  const [stats, setStats] = useState({ additions: 0, deletions: 0, filesChanged: 0 })
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const loadComparison = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.git.compareBranches(workspaceRoot, baseBranch, compareBranch)
      setFiles(result.files)
      setStats(result.stats)
      // 默认展开所有目录
      const dirs = new Set<string>()
      result.files.forEach((f) => {
        const parts = f.path.split('/')
        for (let i = 0; i < parts.length - 1; i++) {
          dirs.add(parts.slice(0, i + 1).join('/'))
        }
      })
      setExpandedDirs(dirs)
    } catch (err: any) {
      setError(err.message || t('git.compare_load_failed'))
    } finally {
      setLoading(false)
    }
  }, [workspaceRoot, baseBranch, compareBranch, t])

  useEffect(() => {
    if (baseBranch && compareBranch) {
      loadComparison()
    }
  }, [loadComparison, baseBranch, compareBranch])

  const handleFileClick = (file: BranchCompareFile) => {
    setSelectedFile(file.path)
    onFileClick(file)
  }

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const fileTree = buildFileTree(files)

  // 渲染文件树节点
  const renderTreeNode = (node: FileTreeNode, depth: number = 0) => {
    if (node.isDir) {
      const isExpanded = expandedDirs.has(node.path)
      const fileCount = getFileCount(node)
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
        // 目录排前面
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return (
        <div key={node.path || 'root'}>
          {node.path && (
            <div
              className="flex items-center gap-1 py-1 px-2 hover:bg-accent/50 cursor-pointer rounded-sm"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => toggleDir(node.path)}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <Folder className="size-4 shrink-0 text-yellow-500/80" />
              <span className="text-sm truncate flex-1">{node.name}</span>
              <span className="text-xs text-muted-foreground">{fileCount}</span>
            </div>
          )}
          {(isExpanded || !node.path) &&
            sortedChildren.map((child) => renderTreeNode(child, node.path ? depth + 1 : 0))}
        </div>
      )
    }

    // 文件节点
    const file = node.file!
    const config = statusConfig[file.status]
    const Icon = config.icon
    const isSelected = selectedFile === file.path

    return (
      <div
        key={file.path}
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded-sm transition-colors',
          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => handleFileClick(file)}
      >
        <Icon className={cn('size-4 shrink-0', config.color)} />
        <span className="text-sm truncate flex-1">{node.name}</span>
        <span className={cn('text-[10px] font-mono', config.color)}>{config.label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-foreground uppercase tracking-wide">Compare</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/50"
            onClick={loadComparison}
            title={t('common.refresh')}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/50"
            onClick={onClose}
            title={t('common.close')}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 分支信息 */}
      <div className="px-3 py-2 border-b border-border/30 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium" title={baseBranch}>
              {baseBranch}
            </span>
          </div>
          {onSwapBranches && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={onSwapBranches}
              title={t('git.compare_swap_branches')}
            >
              <ArrowLeftRight className="size-3" />
            </Button>
          )}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <GitBranch className="size-3.5 shrink-0 text-primary" />
            <span className="truncate font-medium text-primary" title={compareBranch}>
              {compareBranch}
            </span>
          </div>
        </div>
        {!loading && !error && files.length > 0 && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>{t('git.compare_files_stats', { count: stats.filesChanged })}</span>
            <span className="text-green-500">+{stats.additions}</span>
            <span className="text-red-500">-{stats.deletions}</span>
          </div>
        )}
      </div>

      {/* 文件列表 */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-sm text-destructive">
            {error}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <GitBranch className="size-8 mb-2 opacity-20" />
            <span>{t('git.compare_no_diff')}</span>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="py-1">{renderTreeNode(fileTree)}</div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
