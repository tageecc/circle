import { useState, useEffect, useRef, useMemo, useCallback, DragEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
  FileText,
  ExternalLink,
  Plus,
  Minimize2,
  Maximize2,
  LocateFixed,
  RefreshCw,
  Undo2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getFileIcon } from '@/lib/file-icons'
import { CollapsiblePanel } from '@/components/features/common/collapsible-panel'
import { eventBus } from '@/lib/event-bus'
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
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { GitFileStatus } from '@/types/ide'

// ⭐ 防止自动展开的大目录（性能优化，目录仍会显示但不会自动展开）
// 注意：这不同于 files.exclude 配置，这些目录仍然会在文件树中显示
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '.vscode',
  '.idea',
  'target', // Java
  'bin', // 通用
  'obj', // C#
  'vendor', // PHP/Go
  '__pycache__', // Python
  '.pytest_cache',
  'venv',
  '.venv'
])

// 检查是否应该跳过自动展开此目录
const shouldSkipDirectory = (path: string): boolean => {
  const dirName = path.split('/').pop() || ''
  return EXCLUDED_DIRS.has(dirName)
}

// 最大展开深度（VSCode默认2-3层）
const MAX_EXPAND_DEPTH = 3

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileTreeProps {
  workspaceRoot: string
  onFileSelect: (path: string) => void
  onFilePreview?: (path: string) => void
  activeFile: string | null
  gitStatus?: GitFileStatus | null
  onNewFile?: (parentPath: string) => void
  onNewFolder?: (parentPath: string) => void
  onRename?: (oldPath: string, newName: string) => void
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
  onMove?: (sourcePath: string, targetPath: string) => void
}

export function FileTree({
  workspaceRoot,
  onFileSelect,
  onFilePreview,
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
  onMove
}: FileTreeProps) {
  const { t } = useTranslation()
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
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 拖拽状态
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null)
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const dragExpandTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 内联编辑状态
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

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
    if (gitStatus.deleted.includes(relativePath)) return 'deleted'
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
      case 'deleted':
        return 'text-red-600 dark:text-red-500' // 删除的文件：红色
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
      case 'deleted':
        return 'D'
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

  // ✅ 定义函数（在 useEffect 之前）
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

  // ✅ 智能刷新：防抖 + 异步 + 并行加载，避免阻塞主线程
  const refreshFileTree = useCallback(
    async (silent = true) => {
      // ✅ 防抖：300ms 内多次调用只执行最后一次
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      refreshTimerRef.current = setTimeout(async () => {
        if (expandedDirs.size === 0) {
          await loadFileTree(false)
          return
        }

        // 保存当前滚动位置
        savedScrollTop.current = scrollContainerRef.current?.scrollTop || 0
        shouldRestoreScroll.current = true

        try {
          // ✅ 静默刷新：不显示 loading，避免闪烁
          if (!silent) {
            setLoading(true)
          }

          // ✅ 并行加载目录，避免阻塞
          const loadDirectoryRecursive = async (dirPath: string): Promise<FileNode[]> => {
            const children = await window.api.files.listDirectory(dirPath)

            // ✅ 使用 Promise.all 并行加载所有子目录
            const result = await Promise.all(
              children.map(async (node) => {
                if (node.type === 'directory' && expandedDirs.has(node.path)) {
                  const subChildren = await loadDirectoryRecursive(node.path)
                  return { ...node, children: subChildren }
                }
                return node
              })
            )

            return result
          }

          const refreshedTree = await loadDirectoryRecursive(workspaceRoot)
          setTree(refreshedTree)
        } catch (error) {
          console.error('Failed to refresh file tree:', error)
        } finally {
          if (!silent) {
            setLoading(false)
          }
        }
      }, 300) // ✅ 300ms 防抖，让 UI 保持响应
    },
    [expandedDirs, workspaceRoot]
  )

  // ✅ useEffect 钩子（在函数定义之后）
  useEffect(() => {
    loadFileTree()

    // 清理定时器
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [workspaceRoot])

  // ✅ 使用 ref 保存最新的 refreshFileTree，避免依赖变化
  const refreshFileTreeRef = useRef(refreshFileTree)
  useEffect(() => {
    refreshFileTreeRef.current = refreshFileTree
  })

  // 监听外部刷新请求
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0 && tree.length > 0) {
      refreshFileTreeRef.current()
    }
  }, [refreshTrigger, tree.length])

  // 监听全局事件：文件排除规则变化时刷新
  useEffect(() => {
    const handleFilesExcludeChange = () => {
      if (tree.length > 0) {
        refreshFileTreeRef.current()
      }
    }

    eventBus.on('files-exclude-changed', handleFilesExcludeChange)
    return () => eventBus.off('files-exclude-changed', handleFilesExcludeChange)
  }, [tree.length])

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

  // ✅ 智能展开 - 只展开前2-3层，跳过大目录（参考VSCode）
  const expandAll = async () => {
    setLoading(true)

    try {
      const allExpandedDirs = new Set<string>([workspaceRoot])
      let currentTree = [...tree]

      // 递归加载指定深度的目录
      const loadToDepth = async (nodes: FileNode[], currentDepth: number): Promise<FileNode[]> => {
        if (currentDepth >= MAX_EXPAND_DEPTH) return nodes

        const result = await Promise.all(
          nodes.map(async (node) => {
            if (node.type === 'directory') {
              // 跳过大目录
              if (shouldSkipDirectory(node.path)) {
                return node
              }

              allExpandedDirs.add(node.path)

              try {
                const children = await window.api.files.listDirectory(node.path)

                // 递归加载子目录（只到指定深度）
                const loadedChildren = await loadToDepth(children, currentDepth + 1)

                return { ...node, children: loadedChildren }
              } catch (error) {
                // 静默处理错误
                return node
              }
            } else {
              return node
            }
          })
        )

        return result
      }

      // 执行加载
      currentTree = await loadToDepth(tree, 1)

      // 更新状态
      setTree(currentTree)
      setExpandedDirs(allExpandedDirs)
      onExpandedDirsChange?.(Array.from(allExpandedDirs))

      console.log(`[FileTree] 已展开前 ${MAX_EXPAND_DEPTH} 层，共 ${allExpandedDirs.size} 个目录`)
    } catch (error) {
      console.error('Failed to expand directories:', error)
    } finally {
      setLoading(false)
    }
  }

  // 收起所有文件夹
  const collapseAll = () => {
    setExpandedDirs(new Set([workspaceRoot]))
    onExpandedDirsChange?.([workspaceRoot])
  }

  // 拖拽开始
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, node: FileNode) => {
    e.stopPropagation()
    setDraggedNode(node)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.path)
  }, [])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedNode(null)
    setDropTargetPath(null)
    if (dragExpandTimeoutRef.current) {
      clearTimeout(dragExpandTimeoutRef.current)
      dragExpandTimeoutRef.current = null
    }
  }, [])

  // 检查是否可以放置到目标文件夹
  const canDropToFolder = useCallback(
    (targetPath: string): boolean => {
      if (!draggedNode) return false
      // 不能拖拽到自己（仅当拖拽的是文件夹时）
      if (draggedNode.path === targetPath) return false
      // 不能拖拽到自己的子目录
      if (targetPath.startsWith(draggedNode.path + '/')) return false
      // 不能拖拽到当前所在目录（无意义）
      const draggedParent = draggedNode.path.split('/').slice(0, -1).join('/')
      if (targetPath === draggedParent) return false
      return true
    },
    [draggedNode]
  )

  // 处理拖拽到根目录容器
  const handleRootDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!canDropToFolder(workspaceRoot)) {
        e.dataTransfer.dropEffect = 'none'
        return
      }
      e.dataTransfer.dropEffect = 'move'
      setDropTargetPath(workspaceRoot)
    },
    [canDropToFolder, workspaceRoot]
  )

  const handleRootDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!draggedNode || !onMove || !canDropToFolder(workspaceRoot)) {
        handleDragEnd()
        return
      }
      onMove(draggedNode.path, workspaceRoot)
      handleDragEnd()
    },
    [draggedNode, onMove, canDropToFolder, workspaceRoot, handleDragEnd]
  )

  // 开始内联编辑
  const startEditing = useCallback((path: string, name: string) => {
    setEditingPath(path)
    setEditingName(name)
    // 延迟聚焦，等待 input 渲染
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus()
        // 选中文件名（不含扩展名）
        const dotIndex = name.lastIndexOf('.')
        if (dotIndex > 0) {
          editInputRef.current.setSelectionRange(0, dotIndex)
        } else {
          editInputRef.current.select()
        }
      }
    }, 0)
  }, [])

  // 确认编辑
  const confirmEditing = useCallback(() => {
    if (!editingPath || !editingName.trim()) {
      setEditingPath(null)
      return
    }
    const originalName = editingPath.split('/').pop() || ''
    if (editingName.trim() !== originalName) {
      onRename?.(editingPath, editingName.trim())
    }
    setEditingPath(null)
  }, [editingPath, editingName, onRename])

  // 取消编辑
  const cancelEditing = useCallback(() => {
    setEditingPath(null)
  }, [])

  // 处理编辑输入框的键盘事件
  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirmEditing()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditing()
      }
    },
    [confirmEditing, cancelEditing]
  )

  // 拖拽悬停 - 只处理文件夹
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, node: FileNode) => {
      e.preventDefault()
      e.stopPropagation()

      // 只允许拖拽到文件夹
      if (node.type !== 'directory' || !canDropToFolder(node.path)) {
        e.dataTransfer.dropEffect = 'none'
        setDropTargetPath(null)
        return
      }

      e.dataTransfer.dropEffect = 'move'
      setDropTargetPath(node.path)

      // 悬停在未展开的文件夹上 800ms 后自动展开
      if (!expandedDirs.has(node.path)) {
        if (dragExpandTimeoutRef.current) {
          clearTimeout(dragExpandTimeoutRef.current)
        }
        dragExpandTimeoutRef.current = setTimeout(() => {
          toggleDirectory(node.path)
        }, 800)
      }
    },
    [canDropToFolder, expandedDirs, toggleDirectory]
  )

  // 拖拽离开
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTargetPath(null)
      if (dragExpandTimeoutRef.current) {
        clearTimeout(dragExpandTimeoutRef.current)
        dragExpandTimeoutRef.current = null
      }
    }
  }, [])

  // 放置
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, node: FileNode) => {
      e.preventDefault()
      e.stopPropagation()

      if (!draggedNode || !onMove || node.type !== 'directory' || !canDropToFolder(node.path)) {
        handleDragEnd()
        return
      }

      onMove(draggedNode.path, node.path)
      handleDragEnd()
    },
    [draggedNode, onMove, canDropToFolder, handleDragEnd]
  )

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

    // 拖拽状态
    const isDragging = draggedNode?.path === node.path
    const isDropTarget = isDirectory && dropTargetPath === node.path

    // 编辑状态
    const isEditing = editingPath === node.path

    return (
      <div key={node.path} ref={isActive && !isDirectory ? activeFileRef : undefined}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, node)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, node)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, node)}
              className={cn(
                'relative',
                isDragging && 'opacity-50',
                isDropTarget && 'ring-2 ring-primary ring-inset bg-primary/10 rounded-md'
              )}
            >
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
                  if (isEditing) return
                  if (isDirectory) {
                    setSelectedDir(node.path)
                    toggleDirectory(node.path)
                  } else {
                    setSelectedDir(null)
                    // 单击文件：只有开启预览模式时才打开
                    if (onFilePreview) {
                      onFilePreview(node.path)
                    }
                    // 如果没有提供预览回调（开关关闭），单击仅选中，不打开文件
                  }
                }}
                onDoubleClick={(e) => {
                  // 双击文件：永久打开
                  if (!isDirectory && !isEditing) {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedDir(null)
                    onFileSelect(node.path)
                  }
                }}
                onKeyDown={(e) => {
                  // Enter 键触发重命名（VSCode 风格）
                  if (e.key === 'Enter' && isActive && !isEditing) {
                    e.preventDefault()
                    e.stopPropagation()
                    startEditing(node.path, node.name)
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
                    {FileIcon && (
                      <FileIcon className={cn('size-4 shrink-0', fileIconConfig.color)} />
                    )}
                  </>
                )}
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={confirmEditing}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-background border border-primary rounded px-1 py-0 text-sm outline-none"
                  />
                ) : (
                  <span className="flex-1 truncate text-left">{node.name}</span>
                )}
                {!isEditing && statusBadge && (
                  <span className={cn('shrink-0 text-xs font-semibold', statusColor)}>
                    {statusBadge}
                  </span>
                )}
              </Button>
            </div>
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

            <ContextMenuItem onClick={() => onDelete?.(node.path)} className="text-destructive">
              <Trash2 className="mr-2 size-4" />
              <span>Delete</span>
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {!isDirectory && (
              <ContextMenuItem onClick={() => onGitRevert?.(node.path)}>
                <Undo2 className="mr-2 size-4" />
                <span>Revert Changes</span>
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />

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
            title={t('file_tree.tooltip_new')}
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onNewFile?.(selectedDir || workspaceRoot)}>
            <FileText className="mr-2 size-4" />
            <span>{t('file_tree.item_file')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNewFolder?.(selectedDir || workspaceRoot)}>
            <FolderPlus className="mr-2 size-4" />
            <span>{t('file_tree.item_folder')}</span>
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
        title={t('file_tree.tooltip_reveal_active')}
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
        title={t('file_tree.tooltip_collapse_all')}
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
        title={t('file_tree.tooltip_expand_all')}
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
        title={t('common.refresh')}
      >
        <RefreshCw className="size-3.5" />
      </Button>
    </div>
  )

  const isRootDropTarget = dropTargetPath === workspaceRoot

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-sidebar group/tree">
      <CollapsiblePanel
        title={projectName}
        isExpanded={isExpanded}
        onToggle={() => onToggleCollapse?.()}
        actions={renderActions()}
      >
        <div
          ref={scrollContainerRef}
          className={cn('flex-1 py-2 px-2 min-h-[100px]', isRootDropTarget && 'bg-primary/5')}
          onDragOver={handleRootDragOver}
          onDrop={handleRootDrop}
          onDragLeave={(e) => {
            // 只有真正离开容器时才清除（不是进入子元素）
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropTargetPath(null)
            }
          }}
        >
          {tree.map((node) => renderNode(node))}
        </div>
      </CollapsiblePanel>
    </div>
  )
}
