import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Loader2,
  FilePlus,
  FolderPlus,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Edit,
  FileText,
  ExternalLink,
  Plus,
  Minimize2,
  Maximize2,
  LocateFixed,
  RefreshCw,
  GitBranch,
  History,
  Undo2,
  FileCode,
  GitCompare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { getFileIcon } from '@/lib/file-icons'
import { CollapsiblePanel } from '../shared/CollapsiblePanel'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut
} from '../ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface GitStatus {
  modified: string[]
  untracked: string[]
  staged: string[]
  conflicted: string[]
}

interface FileTreeProps {
  workspaceRoot: string
  onFileSelect: (path: string) => void
  activeFile: string | null
  gitStatus?: GitStatus | null
  onNewFile?: (parentPath: string) => void
  onNewFolder?: (parentPath: string) => void
  onRename?: (path: string) => void
  onDelete?: (path: string) => void
  onCut?: (path: string) => void
  onCopy?: (path: string) => void
  onPaste?: (targetPath: string) => void
  onCopyPath?: (path: string) => void
  onRevealInFinder?: (path: string) => void
  onRefresh?: () => void
  clipboard?: { path: string; type: 'cut' | 'copy' } | null
  initialExpandedDirs?: string[]
  onExpandedDirsChange?: (dirs: string[]) => void
  refreshTrigger?: number
  onToggleCollapse?: () => void
  isExpanded?: boolean
  onGitRevert?: (path: string) => void
  onGitShowHistory?: (path: string) => void
  onGitShowDiff?: (path: string) => void
  onGitAnnotate?: (path: string) => void
  onGitCompareWithBranch?: (path: string) => void
}

export function FileTree({
  workspaceRoot,
  onFileSelect,
  activeFile,
  gitStatus,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  onCopyPath,
  onRevealInFinder,
  onRefresh,
  clipboard,
  initialExpandedDirs,
  onExpandedDirsChange,
  refreshTrigger,
  onToggleCollapse,
  isExpanded = true,
  onGitRevert,
  onGitShowHistory,
  onGitShowDiff,
  onGitAnnotate,
  onGitCompareWithBranch
}: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    return initialExpandedDirs ? new Set(initialExpandedDirs) : new Set()
  })
  const [loading, setLoading] = useState(true)
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const activeFileRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef<number>(0)
  const shouldRestoreScroll = useRef<boolean>(false)

  const projectName = useMemo(() => {
    return workspaceRoot.split('/').pop() || 'Project'
  }, [workspaceRoot])

  // 获取文件的 Git 状态
  const getFileGitStatus = (filePath: string): string | null => {
    if (!gitStatus) return null

    // 获取相对于工作区的路径
    const relativePath = filePath.replace(workspaceRoot + '/', '')

    if (gitStatus.conflicted.includes(relativePath)) return 'conflicted'
    if (gitStatus.staged.includes(relativePath)) return 'staged'
    if (gitStatus.modified.includes(relativePath)) return 'modified'
    if (gitStatus.untracked.includes(relativePath)) return 'untracked'

    return null
  }

  // 获取文件状态对应的颜色类
  const getStatusColor = (status: string | null): string => {
    if (!status) return ''

    switch (status) {
      case 'modified':
        return 'text-yellow-600 dark:text-yellow-500' // 修改的文件：黄色
      case 'untracked':
        return 'text-green-600 dark:text-green-500' // 未跟踪的文件：绿色
      case 'staged':
        return 'text-green-600 dark:text-green-500' // 已暂存的文件：绿色
      case 'conflicted':
        return 'text-red-600 dark:text-red-500' // 冲突的文件：红色
      default:
        return ''
    }
  }

  // 获取文件状态标识
  const getStatusBadge = (status: string | null): string | null => {
    if (!status) return null

    switch (status) {
      case 'modified':
        return 'M'
      case 'untracked':
        return 'U'
      case 'staged':
        return 'A'
      case 'conflicted':
        return 'C'
      default:
        return null
    }
  }

  useEffect(() => {
    loadFileTree()
  }, [workspaceRoot])

  // 监听外部刷新请求
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0 && tree.length > 0) {
      refreshFileTree()
    }
  }, [refreshTrigger])

  // 当外部选中文件时，清除目录选中状态
  useEffect(() => {
    if (activeFile) {
      setSelectedDir(null)
    }
  }, [activeFile])

  // 在加载完成后恢复滚动位置
  useEffect(() => {
    if (!loading && shouldRestoreScroll.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollTop.current
      shouldRestoreScroll.current = false
    }
  }, [loading])

  const loadFileTree = async (preserveState = false) => {
    try {
      setLoading(true)
      const files = await window.api.files.listDirectory(workspaceRoot)
      setTree(files)

      if (!preserveState) {
        setExpandedDirs(new Set([workspaceRoot]))
        setSelectedDir(null)
      }
    } catch (error) {
      console.error('Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  // 智能刷新：保留展开状态并重新加载
  const refreshFileTree = async () => {
    if (expandedDirs.size === 0) {
      await loadFileTree(false)
      return
    }

    // 保存当前滚动位置
    savedScrollTop.current = scrollContainerRef.current?.scrollTop || 0
    shouldRestoreScroll.current = true

    try {
      setLoading(true)

      // 递归加载目录并保留展开状态
      const loadDirectoryRecursive = async (dirPath: string): Promise<FileNode[]> => {
        const children = await window.api.files.listDirectory(dirPath)
        const result: FileNode[] = []

        for (const node of children) {
          if (node.type === 'directory' && expandedDirs.has(node.path)) {
            const subChildren = await loadDirectoryRecursive(node.path)
            result.push({ ...node, children: subChildren })
          } else {
            result.push(node)
          }
        }

        return result
      }

      const refreshedTree = await loadDirectoryRecursive(workspaceRoot)
      setTree(refreshedTree)
    } catch (error) {
      console.error('Failed to refresh file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDirectory = async (path: string) => {
    const newExpanded = new Set(expandedDirs)
    if (expandedDirs.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
      // 加载子目录（如果需要）
      try {
        const children = await window.api.files.listDirectory(path)
        setTree((prevTree) => updateTreeWithChildren(prevTree, path, children))
      } catch (error) {
        console.error('Failed to load directory:', error)
      }
    }
    setExpandedDirs(newExpanded)
    // 通知父组件展开状态变化
    onExpandedDirsChange?.(Array.from(newExpanded))
  }

  const updateTreeWithChildren = (
    nodes: FileNode[],
    targetPath: string,
    children: FileNode[]
  ): FileNode[] => {
    return nodes.map((node) => {
      if (node.path === targetPath) {
        return { ...node, children }
      }
      if (node.children) {
        return { ...node, children: updateTreeWithChildren(node.children, targetPath, children) }
      }
      return node
    })
  }

  // 递归加载并展开所有目录
  const expandAll = async () => {
    const allExpandedDirs = new Set<string>([workspaceRoot])
    let updatedTree = [...tree]

    // 递归函数：加载目录及其所有子目录
    const loadAllDirectories = async (nodes: FileNode[]): Promise<FileNode[]> => {
      const result: FileNode[] = []

      for (const node of nodes) {
        if (node.type === 'directory') {
          allExpandedDirs.add(node.path)

          try {
            // 加载当前目录的内容
            const children = await window.api.files.listDirectory(node.path)
            // 递归加载子目录
            const loadedChildren = await loadAllDirectories(children)
            result.push({ ...node, children: loadedChildren })
          } catch (error) {
            console.error('Failed to load directory:', error)
            result.push(node)
          }
        } else {
          result.push(node)
        }
      }

      return result
    }

    // 从根节点开始递归加载
    updatedTree = await loadAllDirectories(tree)

    setTree(updatedTree)
    setExpandedDirs(allExpandedDirs)
    onExpandedDirsChange?.(Array.from(allExpandedDirs))
  }

  // 收起所有文件夹
  const collapseAll = () => {
    setExpandedDirs(new Set([workspaceRoot]))
    onExpandedDirsChange?.([workspaceRoot])
  }

  // 定位当前活动文件
  const locateActiveFile = async () => {
    if (!activeFile) return

    // 展开所有父目录
    const pathParts = activeFile.split('/')
    const parentDirs: string[] = []
    for (let i = 0; i < pathParts.length - 1; i++) {
      parentDirs.push(pathParts.slice(0, i + 1).join('/'))
    }

    const newExpanded = new Set(expandedDirs)
    for (const dir of parentDirs) {
      if (!newExpanded.has(dir)) {
        newExpanded.add(dir)
        try {
          const children = await window.api.files.listDirectory(dir)
          setTree((prevTree) => updateTreeWithChildren(prevTree, dir, children))
        } catch (error) {
          console.error('Failed to load directory:', error)
        }
      }
    }
    setExpandedDirs(newExpanded)
    onExpandedDirsChange?.(Array.from(newExpanded))

    // 滚动到活动文件
    setTimeout(() => {
      activeFileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedDirs.has(node.path)
    const isDirectory = node.type === 'directory'
    const isActive = isDirectory ? selectedDir === node.path : activeFile === node.path
    const fileIconConfig = !isDirectory ? getFileIcon(node.name) : null
    const FileIcon = fileIconConfig?.icon

    // 获取文件的 Git 状态
    const gitFileStatus = !isDirectory ? getFileGitStatus(node.path) : null
    const statusColor = getStatusColor(gitFileStatus)
    const statusBadge = getStatusBadge(gitFileStatus)

    return (
      <div key={node.path} ref={isActive && !isDirectory ? activeFileRef : undefined}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'h-8 w-full justify-start gap-1.5 rounded-md px-2 text-sm font-normal hover:bg-accent/50',
                isActive && 'bg-accent/80 text-accent-foreground font-medium',
                statusColor && !isActive && statusColor,
                clipboard?.path === node.path && 'opacity-50'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => {
                if (isDirectory) {
                  setSelectedDir(node.path)
                  toggleDirectory(node.path)
                } else {
                  setSelectedDir(null)
                  onFileSelect(node.path)
                }
              }}
            >
              {isDirectory ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="size-3 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="size-4 shrink-0 text-blue-500" />
                  ) : (
                    <Folder className="size-4 shrink-0 text-blue-500" />
                  )}
                </>
              ) : (
                <>
                  <span className="w-3" />
                  {FileIcon && <FileIcon className={cn('size-4 shrink-0', fileIconConfig.color)} />}
                </>
              )}
              <span className="flex-1 truncate text-left">{node.name}</span>
              {statusBadge && (
                <span className={cn('shrink-0 text-xs font-semibold', statusColor)}>
                  {statusBadge}
                </span>
              )}
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            {isDirectory && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <FilePlus className="mr-2 size-4" />
                    <span>New</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    <ContextMenuItem onClick={() => onNewFile?.(node.path)}>
                      <FileText className="mr-2 size-4" />
                      <span>File</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onNewFolder?.(node.path)}>
                      <FolderPlus className="mr-2 size-4" />
                      <span>Folder</span>
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
              </>
            )}

            <ContextMenuItem onClick={() => onCut?.(node.path)}>
              <Scissors className="mr-2 size-4" />
              <span>Cut</span>
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopy?.(node.path)}>
              <Copy className="mr-2 size-4" />
              <span>Copy</span>
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopyPath?.(node.path)}>
              <FileText className="mr-2 size-4" />
              <span>Copy Path</span>
            </ContextMenuItem>
            {clipboard && (
              <ContextMenuItem
                onClick={() =>
                  onPaste?.(isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/'))
                }
              >
                <Clipboard className="mr-2 size-4" />
                <span>Paste</span>
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => onRename?.(node.path)}>
              <Edit className="mr-2 size-4" />
              <span>Rename...</span>
              <ContextMenuShortcut>⇧F6</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDelete?.(node.path)} className="text-destructive">
              <Trash2 className="mr-2 size-4" />
              <span>Delete</span>
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {!isDirectory && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <GitBranch className="mr-2 size-4" />
                  <span>Git</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onClick={() => onGitRevert?.(node.path)}>
                    <Undo2 className="mr-2 size-4" />
                    <span>Rollback</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onGitShowDiff?.(node.path)}>
                    <GitCompare className="mr-2 size-4" />
                    <span>Show Diff</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onGitShowHistory?.(node.path)}>
                    <History className="mr-2 size-4" />
                    <span>Show History</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onGitAnnotate?.(node.path)}>
                    <FileCode className="mr-2 size-4" />
                    <span>Annotate</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onGitCompareWithBranch?.(node.path)}>
                    <GitCompare className="mr-2 size-4" />
                    <span>Compare with Branch...</span>
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            {!isDirectory && <ContextMenuSeparator />}

            <ContextMenuItem onClick={() => onRevealInFinder?.(node.path)}>
              <ExternalLink className="mr-2 size-4" />
              <span>Reveal in Finder</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRefresh?.()}>
              <Loader2 className="mr-2 size-4" />
              <span>Reload from Disk</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {isDirectory && isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const renderActions = () => (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/tree:opacity-100 transition-opacity">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/50"
            title="新建"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onNewFile?.(selectedDir || workspaceRoot)}>
            <FileText className="mr-2 size-4" />
            <span>文件</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNewFolder?.(selectedDir || workspaceRoot)}>
            <FolderPlus className="mr-2 size-4" />
            <span>文件夹</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-accent/50"
        onClick={(e) => {
          e.stopPropagation()
          locateActiveFile()
        }}
        disabled={!activeFile}
        title="定位当前文件"
      >
        <LocateFixed className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-accent/50"
        onClick={(e) => {
          e.stopPropagation()
          collapseAll()
        }}
        title="收起所有文件夹"
      >
        <Minimize2 className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-accent/50"
        onClick={(e) => {
          e.stopPropagation()
          expandAll()
        }}
        title="展开所有文件夹"
      >
        <Maximize2 className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-accent/50"
        onClick={(e) => {
          e.stopPropagation()
          refreshFileTree()
          onRefresh?.()
        }}
        title="刷新"
      >
        <RefreshCw className="size-3.5" />
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-sidebar group/tree">
      <CollapsiblePanel
        title={projectName}
        isExpanded={isExpanded}
        onToggle={() => onToggleCollapse?.()}
        actions={renderActions()}
      >
        <div ref={scrollContainerRef} className="flex-1 py-2 px-2">
          {tree.map((node) => renderNode(node))}
        </div>
      </CollapsiblePanel>
    </div>
  )
}
