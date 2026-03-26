import { useState, useEffect, useCallback, useRef } from 'react'
import { Database, RefreshCw, Trash2, Loader2, Check, FileSearch, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

interface CodebaseIndexStatusProps {
  projectPath: string | null
  autoIndex?: boolean
  mode?: 'compact' | 'full'
}

interface IndexInfo {
  projectPath: string
  projectName: string
  totalFiles: number
  totalChunks?: number
  totalSize: number
  indexedAt: number
}

interface IndexResult {
  success: boolean
  projectPath?: string
  projectName?: string
  totalFiles: number
  totalChunks: number
  totalSize: number
  indexedAt: number
  newFiles?: number
  modifiedFiles?: number
  deletedFiles?: number
  unchangedFiles?: number
}

export function CodebaseIndexStatus({
  projectPath,
  autoIndex = true,
  mode = 'compact'
}: CodebaseIndexStatusProps) {
  const [indexInfo, setIndexInfo] = useState<IndexInfo | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentMessage, setCurrentMessage] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // ✅ 关键修复：使用 Ref 彻底避免重复索引
  const isIndexingRef = useRef(false)
  const projectPathRef = useRef<string | null>(null)
  const hasAutoIndexedForProjectRef = useRef(false)

  // 加载索引信息
  const loadIndexInfo = useCallback(async () => {
    if (!projectPath) {
      setIndexInfo(null)
      return null
    }

    try {
      if (mode === 'full') {
        setLoading(true)
      }
      const info = await window.api.codebase.getIndex(projectPath)
      if (info) {
        setIndexInfo({
          projectPath,
          projectName: info.projectName,
          totalFiles: info.totalFiles,
          totalChunks: info.totalChunks,
          totalSize: info.totalSize,
          indexedAt: info.indexedAt
        })
      } else {
        setIndexInfo(null)
      }
      return info
    } catch (error) {
      console.error('Failed to load index info:', error)
      return null
    } finally {
      if (mode === 'full') {
        setLoading(false)
      }
    }
  }, [projectPath, mode])

  // 监听进度更新
  useEffect(() => {
    const unsubscribe = window.api.codebase.onIndexProgress((event) => {
      setProgress(event.progress)
      setCurrentMessage(event.file)
    })

    return () => unsubscribe()
  }, [])

  // ✅ 执行索引
  const handleIndex = useCallback(
    async (silent = false) => {
      if (!projectPath) return

      // ✅ 严格的并发检查
      if (isIndexingRef.current) {
        console.log('[CodebaseIndexStatus] Already indexing, skipping')
        return
      }

      console.log('[CodebaseIndexStatus] Starting index for:', projectPath)
      isIndexingRef.current = true
      setIsIndexing(true)
      setProgress(0)
      setCurrentMessage('')

      try {
        const result = (await window.api.codebase.index(projectPath)) as IndexResult

        // 直接使用返回结果，不查询数据库
        setIndexInfo({
          projectPath: result.projectPath || projectPath,
          projectName: result.projectName || projectPath.split('/').pop() || 'Unknown',
          totalFiles: result.totalFiles,
          totalChunks: result.totalChunks,
          totalSize: result.totalSize,
          indexedAt: result.indexedAt
        })

        hasAutoIndexedForProjectRef.current = true

        if (!silent) {
          const hasIncrementalInfo =
            result.newFiles !== undefined ||
            result.modifiedFiles !== undefined ||
            result.unchangedFiles !== undefined

          if (hasIncrementalInfo) {
            const changedCount = (result.newFiles || 0) + (result.modifiedFiles || 0)

            if (changedCount === 0 && (result.unchangedFiles || 0) > 0) {
              toast.success(`索引已是最新！所有 ${result.totalFiles} 个文件均无变化`)
            } else {
              const parts: string[] = []
              if (result.newFiles) parts.push(`新增 ${result.newFiles} 个`)
              if (result.modifiedFiles) parts.push(`修改 ${result.modifiedFiles} 个`)
              if (result.deletedFiles) parts.push(`删除 ${result.deletedFiles} 个`)

              toast.success(
                `索引更新完成！${parts.join('，')}${
                  result.unchangedFiles ? `，${result.unchangedFiles} 个未变化` : ''
                }`
              )
            }
          } else {
            toast.success(`索引完成！已索引 ${result.totalFiles} 个文件`)
          }
        }
      } catch (error: any) {
        toast.error('索引失败: ' + error.message)
        console.error('Indexing failed:', error)
      } finally {
        isIndexingRef.current = false
        setIsIndexing(false)
        setProgress(0)
        setCurrentMessage('')
      }
    },
    [projectPath]
  )

  // ✅ 项目变化时重置状态和加载索引信息
  useEffect(() => {
    if (!projectPath) {
      setIndexInfo(null)
      projectPathRef.current = null
      hasAutoIndexedForProjectRef.current = false
      return
    }

    // ✅ 项目路径变化时重置标记
    if (projectPathRef.current !== projectPath) {
      console.log('[CodebaseIndexStatus] Project changed, resetting flags')
      projectPathRef.current = projectPath
      hasAutoIndexedForProjectRef.current = false
    }

    // ✅ 加载现有索引信息
    loadIndexInfo()
  }, [projectPath, loadIndexInfo])

  // ✅ 自动索引逻辑 - 完全独立的 effect
  useEffect(() => {
    if (
      !projectPath ||
      !autoIndex ||
      hasAutoIndexedForProjectRef.current ||
      isIndexingRef.current
    ) {
      return
    }

    // ✅ 只在挂载时检查一次，不响应其他变化
    const checkAndAutoIndex = async () => {
      const info = await window.api.codebase.getIndex(projectPath)

      if (!info && !hasAutoIndexedForProjectRef.current && !isIndexingRef.current) {
        console.log('[CodebaseIndexStatus] Auto-indexing new project:', projectPath)
        hasAutoIndexedForProjectRef.current = true
        handleIndex(true)
      }
    }

    // ✅ 延迟执行，确保组件已完全挂载
    const timer = setTimeout(checkAndAutoIndex, 500)
    return () => clearTimeout(timer)
  }, []) // ✅ 空依赖数组 - 只在挂载时执行一次

  // 删除索引
  const handleDeleteIndex = async () => {
    if (!projectPath) return

    setPopoverOpen(false)

    try {
      await window.api.codebase.deleteIndex(projectPath)
      toast.success('索引已删除')
      setIndexInfo(null)
      hasAutoIndexedForProjectRef.current = false
    } catch (error: any) {
      toast.error('删除索引失败: ' + error.message)
      console.error('Delete index failed:', error)
    }
  }

  // 格式化大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60 * 1000) return '刚刚'
    if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + ' 分钟前'
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / (60 * 60 * 1000)) + ' 小时前'

    return date.toLocaleDateString('zh-CN')
  }

  if (!projectPath) {
    return null
  }

  // compact 模式
  if (mode === 'compact') {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-5 gap-1 px-1.5 text-xs hover:bg-accent">
            {isIndexing ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                <span>索引中 {Math.round(progress)}%</span>
              </>
            ) : indexInfo ? (
              <>
                <Database className="size-3" />
                <span className="text-muted-foreground">{indexInfo.totalFiles} files</span>
              </>
            ) : (
              <>
                <FileSearch className="size-3" />
                <span className="text-muted-foreground">未索引</span>
              </>
            )}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">代码库索引</h4>
              <div className="flex gap-1">
                {!isIndexing && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleIndex(false)}
                      title="重新索引"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                    {indexInfo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={handleDeleteIndex}
                        title="删除索引"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {isIndexing ? (
              <div className="space-y-2">
                <Progress value={progress} className="h-1" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{Math.round(progress)}%</span>
                  <span className="truncate max-w-[180px]">{currentMessage}</span>
                </div>
              </div>
            ) : indexInfo ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">文件数量</span>
                  <span className="font-medium">{indexInfo.totalFiles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">代码块数量</span>
                  <span className="font-medium">{indexInfo.totalChunks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">总大小</span>
                  <span className="font-medium">{formatSize(indexInfo.totalSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">更新时间</span>
                  <span className="font-medium">{formatTime(indexInfo.indexedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                该项目尚未建立索引
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // full 模式
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="size-5" />
          <h3 className="font-medium">代码库索引</h3>
        </div>
        <div className="flex gap-2">
          {!isIndexing && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleIndex(false)}>
                <RefreshCw className="size-4 mr-1" />
                重新索引
              </Button>
              {indexInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteIndex}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4 mr-1" />
                  删除索引
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isIndexing ? (
        <div className="space-y-3">
          <Progress value={progress} />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>索引中... {Math.round(progress)}%</span>
            <span className="truncate max-w-xs">{currentMessage}</span>
          </div>
        </div>
      ) : indexInfo ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="size-4" />
            <span>索引已建立</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">文件数量</div>
              <div className="text-lg font-semibold">{indexInfo.totalFiles}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">代码块数量</div>
              <div className="text-lg font-semibold">{indexInfo.totalChunks}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">总大小</div>
              <div className="text-lg font-semibold">{formatSize(indexInfo.totalSize)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">更新时间</div>
              <div className="text-lg font-semibold">{formatTime(indexInfo.indexedAt)}</div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '隐藏详情' : '显示详情'}
            <ChevronDown
              className={cn('size-4 ml-1 transition-transform', showDetails && 'rotate-180')}
            />
          </Button>

          {showDetails && (
            <div className="pt-3 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">项目名称</span>
                <span className="font-medium">{indexInfo.projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">项目路径</span>
                <span className="font-mono text-xs truncate max-w-xs" title={indexInfo.projectPath}>
                  {indexInfo.projectPath}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center">
          <FileSearch className="size-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">该项目尚未建立索引</p>
          <Button onClick={() => handleIndex(false)}>
            <Database className="size-4 mr-2" />
            开始索引
          </Button>
        </div>
      )}
    </Card>
  )
}
