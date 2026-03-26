import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  X,
  CaseSensitive,
  Regex,
  WholeWord,
  Replace,
  ReplaceAll,
  FoldVertical,
  UnfoldVertical
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/file-icons'
import { toast } from '@/components/ui/sonner'

interface SearchMatch {
  line: number
  column: number
  length: number
  lineContent: string
  matchText: string
}

interface SearchResult {
  filePath: string
  relativePath: string
  matches: SearchMatch[]
}

interface SearchPanelProps {
  workspaceRoot: string | null
  onFileClick: (
    filePath: string,
    line?: number,
    column?: number,
    length?: number,
    searchText?: string
  ) => void
}

// 虚拟列表的 item 类型
type VirtualItem =
  | { type: 'file'; result: SearchResult }
  | { type: 'match'; result: SearchResult; match: SearchMatch }

export function SearchPanel({ workspaceRoot, onFileClick }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [includePattern, setIncludePattern] = useState('')
  const [excludePattern, setExcludePattern] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [isAllExpanded, setIsAllExpanded] = useState(true)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryInputRef = useRef<HTMLInputElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  // 统计
  const stats = useMemo(() => {
    const totalFiles = results.length
    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0)
    return { totalFiles, totalMatches }
  }, [results])

  // 展平列表用于虚拟滚动
  const flatItems = useMemo<VirtualItem[]>(() => {
    const items: VirtualItem[] = []
    for (const result of results) {
      items.push({ type: 'file', result })
      if (expandedFiles.has(result.filePath)) {
        for (const match of result.matches) {
          items.push({ type: 'match', result, match })
        }
      }
    }
    return items
  }, [results, expandedFiles])

  // 虚拟化
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22, // 每行高度约 22px
    overscan: 20 // 预渲染 20 行
  })

  // 执行搜索
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!workspaceRoot || !searchQuery.trim()) {
        setResults([])
        return
      }

      setIsSearching(true)
      try {
        const searchResults = await window.api.search.find(workspaceRoot, searchQuery, {
          caseSensitive,
          wholeWord,
          useRegex,
          includePattern: includePattern || undefined,
          excludePattern: excludePattern || undefined
        })

        setResults(searchResults)
        setExpandedFiles(new Set(searchResults.map((r) => r.filePath)))
        setIsAllExpanded(true)
      } catch (error) {
        console.error('Search failed:', error)
        toast.error('Search failed')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [workspaceRoot, caseSensitive, wholeWord, useRegex, includePattern, excludePattern]
  )

  // 当选项变化时重新搜索
  const optionsRef = useRef({ caseSensitive, wholeWord, useRegex })
  useEffect(() => {
    const prev = optionsRef.current
    if (
      query &&
      (prev.caseSensitive !== caseSensitive ||
        prev.wholeWord !== wholeWord ||
        prev.useRegex !== useRegex)
    ) {
      performSearch(query)
    }
    optionsRef.current = { caseSensitive, wholeWord, useRegex }
  }, [caseSensitive, wholeWord, useRegex, query, performSearch])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => performSearch(value), 300)
    },
    [performSearch]
  )

  const handleRefresh = useCallback(() => {
    if (query) performSearch(query)
  }, [query, performSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setReplaceText('')
    setResults([])
    queryInputRef.current?.focus()
  }, [])

  const toggleFileExpand = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }, [])

  const toggleAllExpand = useCallback(() => {
    if (isAllExpanded) {
      setExpandedFiles(new Set())
    } else {
      setExpandedFiles(new Set(results.map((r) => r.filePath)))
    }
    setIsAllExpanded(!isAllExpanded)
  }, [isAllExpanded, results])

  const handleReplaceInFile = useCallback(
    async (filePath: string) => {
      if (!replaceText && replaceText !== '') return
      try {
        const result = await window.api.search.replaceInFile(filePath, query, replaceText, {
          caseSensitive,
          wholeWord,
          useRegex
        })
        if (result.replacements > 0) {
          toast.success(`Replaced ${result.replacements} occurrence(s)`)
          performSearch(query)
        }
      } catch (error) {
        console.error('Replace failed:', error)
        toast.error('Replace failed')
      }
    },
    [query, replaceText, caseSensitive, wholeWord, useRegex, performSearch]
  )

  const handleReplaceAll = useCallback(async () => {
    if (!workspaceRoot || !query) return
    try {
      const results = await window.api.search.replaceAll(workspaceRoot, query, replaceText, {
        caseSensitive,
        wholeWord,
        useRegex,
        includePattern: includePattern || undefined,
        excludePattern: excludePattern || undefined
      })
      const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0)
      if (totalReplacements > 0) {
        toast.success(`Replaced ${totalReplacements} occurrence(s) in ${results.length} file(s)`)
        performSearch(query)
      } else {
        toast.info('No matches to replace')
      }
    } catch (error) {
      console.error('Replace all failed:', error)
      toast.error('Replace all failed')
    }
  }, [
    workspaceRoot,
    query,
    replaceText,
    caseSensitive,
    wholeWord,
    useRegex,
    includePattern,
    excludePattern,
    performSearch
  ])

  // 渲染文件行
  const renderFileRow = useCallback(
    (item: VirtualItem & { type: 'file' }) => {
      const { result } = item
      const { icon: Icon, color } = getFileIcon(result.relativePath.split('/').pop() || '')
      const isExpanded = expandedFiles.has(result.filePath)

      return (
        <div className="flex items-center gap-1 px-2 hover:bg-accent/50 cursor-pointer group h-[22px]">
          <button
            onClick={() => toggleFileExpand(result.filePath)}
            className="flex items-center gap-1 flex-1 min-w-0 text-left cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
            )}
            <Icon className={cn('size-4 shrink-0', color)} />
            <span className="text-xs truncate">{result.relativePath}</span>
            <span className="text-xs text-muted-foreground bg-accent/50 px-1.5 rounded ml-auto shrink-0">
              {result.matches.length}
            </span>
          </button>
          {showReplace && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={() => handleReplaceInFile(result.filePath)}
              title="Replace in File"
            >
              <Replace className="size-3" />
            </Button>
          )}
        </div>
      )
    },
    [expandedFiles, showReplace, toggleFileExpand, handleReplaceInFile]
  )

  // 渲染匹配行
  const renderMatchRow = useCallback(
    (item: VirtualItem & { type: 'match' }) => {
      const { result, match } = item
      const trimmedContent = match.lineContent.trim()
      const trimOffset = match.lineContent.length - match.lineContent.trimStart().length
      const adjustedColumn = match.column - trimOffset

      return (
        <button
          onClick={() =>
            onFileClick(result.filePath, match.line, match.column, match.length, query)
          }
          className="flex items-center gap-2 w-full px-2 pl-7 hover:bg-accent/50 cursor-pointer text-left h-[22px]"
        >
          <span className="text-xs text-muted-foreground w-6 text-right shrink-0 tabular-nums">
            {match.line}
          </span>
          <span className="text-xs text-foreground/80 truncate flex-1">
            {trimmedContent.slice(0, adjustedColumn - 1)}
            <span className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5">
              {match.matchText}
            </span>
            {trimmedContent.slice(adjustedColumn - 1 + match.length)}
          </span>
        </button>
      )
    },
    [onFileClick, query]
  )

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-foreground uppercase tracking-wide">Search</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            disabled={isSearching || !query}
            title="Refresh"
          >
            <RefreshCw className={cn('size-3.5', isSearching && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClear}
            title="Clear"
          >
            <X className="size-3.5" />
          </Button>
          {results.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={toggleAllExpand}
              title={isAllExpanded ? 'Collapse All' : 'Expand All'}
            >
              {isAllExpanded ? (
                <FoldVertical className="size-3.5" />
              ) : (
                <UnfoldVertical className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Search Input Area */}
      <div className="p-2 space-y-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showReplace ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          <div className="flex-1 flex items-center gap-0.5 bg-input/50 rounded-md border border-border/50 focus-within:border-primary/50 pr-0.5">
            <Input
              ref={queryInputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search"
              className="border-0 bg-transparent h-7 text-sm focus-visible:ring-0 px-2"
            />
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-5 w-5', caseSensitive && 'bg-accent text-accent-foreground')}
                onClick={() => setCaseSensitive(!caseSensitive)}
                title="Match Case"
              >
                <CaseSensitive className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-5 w-5', wholeWord && 'bg-accent text-accent-foreground')}
                onClick={() => setWholeWord(!wholeWord)}
                title="Match Whole Word"
              >
                <WholeWord className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-5 w-5', useRegex && 'bg-accent text-accent-foreground')}
                onClick={() => setUseRegex(!useRegex)}
                title="Use Regular Expression"
              >
                <Regex className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {showReplace && (
          <div className="flex items-center gap-1 ml-5">
            <div className="flex-1 flex items-center bg-input/50 rounded-md border border-border/50 focus-within:border-primary/50 pr-0.5">
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace"
                className="border-0 bg-transparent h-7 text-sm focus-visible:ring-0 px-2"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleReplaceAll}
                disabled={!query || results.length === 0}
                title="Replace All"
              >
                <ReplaceAll className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-5"
        >
          {showFilters ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <span>files to include/exclude</span>
        </button>

        {showFilters && (
          <div className="space-y-1.5 ml-5">
            <Input
              value={includePattern}
              onChange={(e) => setIncludePattern(e.target.value)}
              onBlur={() => query && performSearch(query)}
              placeholder="files to include (e.g. *.ts, src/**)"
              className="h-7 text-xs bg-input/50"
            />
            <Input
              value={excludePattern}
              onChange={(e) => setExcludePattern(e.target.value)}
              onBlur={() => query && performSearch(query)}
              placeholder="files to exclude (e.g. **/*.test.ts)"
              className="h-7 text-xs bg-input/50"
            />
          </div>
        )}
      </div>

      {/* Results Summary */}
      {stats.totalMatches > 0 && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border/30">
          {stats.totalMatches} result{stats.totalMatches > 1 ? 's' : ''} in {stats.totalFiles} file
          {stats.totalFiles > 1 ? 's' : ''}
        </div>
      )}

      {/* Virtual Results List */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {!workspaceRoot ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Open a project to search
          </div>
        ) : results.length === 0 && query && !isSearching ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No results found for "{query}"
          </div>
        ) : flatItems.length > 0 ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = flatItems[virtualRow.index]
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  {item.type === 'file' ? renderFileRow(item) : renderMatchRow(item)}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
