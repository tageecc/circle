import { useState, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Clock, Search } from 'lucide-react'
import { CommandDialog } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/file-icons'

interface QuickOpenFile {
  name: string
  path: string
  relativePath: string
}

interface QuickOpenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceRoot: string | null
  onFileSelect: (path: string) => void
}

/**
 * 文件快速打开对话框
 * 类似 VSCode 的 Ctrl+P 功能
 */
export function QuickOpenDialog({
  open,
  onOpenChange,
  workspaceRoot,
  onFileSelect
}: QuickOpenDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<QuickOpenFile[]>([])
  const [recentFileItems, setRecentFileItems] = useState<QuickOpenFile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 加载最近文件历史（从持久化存储中获取）
  useEffect(() => {
    if (!open || !workspaceRoot) {
      setRecentFileItems([])
      return
    }

    const loadRecentFiles = async () => {
      try {
        const recentFiles = await window.api.recentFiles.get(workspaceRoot, 15)
        const items = recentFiles.map((path) => ({
          name: path.split('/').pop() || '',
          path,
          relativePath: path.replace(workspaceRoot + '/', '')
        }))
        setRecentFileItems(items)
      } catch (error) {
        console.error('Failed to load recent files:', error)
        setRecentFileItems([])
      }
    }

    loadRecentFiles()
  }, [open, workspaceRoot])

  // 显示的项目：无查询时显示最近文件，有查询时显示搜索结果
  const displayItems = query ? results : recentFileItems

  // 虚拟滚动
  const virtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 40,
    overscan: 10
  })

  // 执行搜索
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!workspaceRoot || !searchQuery.trim()) {
        setResults([])
        setSelectedIndex(0)
        return
      }

      setIsSearching(true)
      try {
        const searchResults = await window.api.files.quickOpen(workspaceRoot, searchQuery, 100)
        setResults(searchResults)
        setSelectedIndex(0)
      } catch (error) {
        console.error('Quick open search failed:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [workspaceRoot]
  )

  // 防抖搜索
  useEffect(() => {
    if (!open) return

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    searchTimerRef.current = setTimeout(() => {
      performSearch(query)
    }, 150)

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [query, open, performSearch])

  // 重置状态当对话框关闭
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [open])

  // 处理文件选择
  const handleSelect = useCallback(
    (file: QuickOpenFile) => {
      onFileSelect(file.path)
      onOpenChange(false)
    },
    [onFileSelect, onOpenChange]
  )

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const itemCount = displayItems.length
      if (itemCount === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % itemCount)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount)
          break
        case 'Enter':
          e.preventDefault()
          if (displayItems[selectedIndex]) {
            handleSelect(displayItems[selectedIndex])
          }
          break
      }
    },
    [displayItems, selectedIndex, handleSelect]
  )

  // 滚动到选中项
  useEffect(() => {
    if (displayItems.length > 0) {
      virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
    }
  }, [selectedIndex, displayItems.length, virtualizer])

  // 高亮匹配的文本
  const highlightMatch = useCallback((text: string, searchQuery: string) => {
    if (!searchQuery) return text

    const lowerText = text.toLowerCase()
    const lowerQuery = searchQuery.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)

    if (index === -1) return text

    return (
      <>
        {text.slice(0, index)}
        <span className="bg-primary/30 text-primary font-medium rounded-sm px-0.5">
          {text.slice(index, index + searchQuery.length)}
        </span>
        {text.slice(index + searchQuery.length)}
      </>
    )
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Open"
      description="Search for files by name"
      className="sm:max-w-[600px] top-[20%] translate-y-0"
      showCloseButton={false}
    >
      <div onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-2 border-b px-3 h-12">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search for files..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {isSearching && (
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        <div
          ref={listRef}
          className="min-h-[360px] max-h-[480px] overflow-y-auto overflow-x-hidden py-1"
        >
          {displayItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {query
                ? isSearching
                  ? 'Searching...'
                  : 'No files found'
                : workspaceRoot
                  ? 'Type to search for files'
                  : 'Open a project first'}
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {!query && recentFileItems.length > 0 && (
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3" />
                  Recent Files
                </div>
              )}
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const file = displayItems[virtualRow.index]
                const isSelected = virtualRow.index === selectedIndex
                const { icon: Icon, color } = getFileIcon(file.name)

                return (
                  <div
                    key={file.path}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start + (query ? 0 : 28)}px)`
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(file)}
                      onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm cursor-pointer rounded-md mx-1',
                        'transition-colors duration-75',
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      )}
                      style={{ width: 'calc(100% - 8px)' }}
                    >
                      <Icon className={cn('size-4 shrink-0', color)} />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="truncate font-medium">
                          {highlightMatch(file.name, query)}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {highlightMatch(file.relativePath, query)}
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
              to open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>
              to close
            </span>
          </div>
          {displayItems.length > 0 && (
            <span>
              {displayItems.length} file{displayItems.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </CommandDialog>
  )
}
