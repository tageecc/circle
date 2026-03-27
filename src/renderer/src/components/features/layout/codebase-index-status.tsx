import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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

function formatIndexedTime(timestamp: number, t: TFunction, lng: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) return t('git.time_just_now')
  if (diff < 60 * 60 * 1000) {
    return t('git.time_minutes_ago', { count: Math.floor(diff / (60 * 1000)) })
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return t('git.time_hours_ago', { count: Math.floor(diff / (60 * 60 * 1000)) })
  }

  return date.toLocaleDateString(lng === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric'
  })
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
  const { t, i18n } = useTranslation()
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
              toast.success(t('codebase_index.toast_fully_unchanged', { count: result.totalFiles }))
            } else {
              const sep = t('codebase_index.list_separator')
              const parts: string[] = []
              if (result.newFiles)
                parts.push(t('codebase_index.part_new', { count: result.newFiles }))
              if (result.modifiedFiles) {
                parts.push(t('codebase_index.part_modified', { count: result.modifiedFiles }))
              }
              if (result.deletedFiles) {
                parts.push(t('codebase_index.part_deleted', { count: result.deletedFiles }))
              }

              let detail = parts.join(sep)
              if (result.unchangedFiles) {
                detail +=
                  (parts.length ? sep : '') +
                  t('codebase_index.part_unchanged', { count: result.unchangedFiles })
              }

              toast.success(t('codebase_index.toast_incremental', { detail }))
            }
          } else {
            toast.success(t('codebase_index.toast_complete', { count: result.totalFiles }))
          }
        }
      } catch (error: any) {
        toast.error(t('codebase_index.index_failed', { message: error.message }))
        console.error('Indexing failed:', error)
      } finally {
        isIndexingRef.current = false
        setIsIndexing(false)
        setProgress(0)
        setCurrentMessage('')
      }
    },
    [projectPath, t]
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
      toast.success(t('codebase_index.index_deleted'))
      setIndexInfo(null)
      hasAutoIndexedForProjectRef.current = false
    } catch (error: any) {
      toast.error(t('codebase_index.delete_index_failed', { message: error.message }))
      console.error('Delete index failed:', error)
    }
  }

  // 格式化大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
                <span>
                  {t('codebase_index.indexing_percent', { percent: Math.round(progress) })}
                </span>
              </>
            ) : indexInfo ? (
              <>
                <Database className="size-3" />
                <span className="text-muted-foreground">
                  {t('codebase_index.files_count_short', { count: indexInfo.totalFiles })}
                </span>
              </>
            ) : (
              <>
                <FileSearch className="size-3" />
                <span className="text-muted-foreground">{t('codebase_index.not_indexed')}</span>
              </>
            )}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{t('codebase_index.title')}</h4>
              <div className="flex gap-1">
                {!isIndexing && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleIndex(false)}
                      title={t('codebase_index.reindex_tooltip')}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                    {indexInfo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={handleDeleteIndex}
                        title={t('codebase_index.delete_index_tooltip')}
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
                  <span className="text-muted-foreground">{t('codebase_index.file_count')}</span>
                  <span className="font-medium">{indexInfo.totalFiles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('codebase_index.chunk_count')}</span>
                  <span className="font-medium">{indexInfo.totalChunks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('codebase_index.total_size')}</span>
                  <span className="font-medium">{formatSize(indexInfo.totalSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('codebase_index.updated_at')}</span>
                  <span className="font-medium">
                    {formatIndexedTime(indexInfo.indexedAt, t, i18n.language)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {t('codebase_index.no_index_yet')}
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
          <h3 className="font-medium">{t('codebase_index.title')}</h3>
        </div>
        <div className="flex gap-2">
          {!isIndexing && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleIndex(false)}>
                <RefreshCw className="size-4 mr-1" />
                {t('codebase_index.reindex')}
              </Button>
              {indexInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteIndex}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4 mr-1" />
                  {t('codebase_index.delete_index')}
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
            <span>{t('codebase_index.indexing_percent', { percent: Math.round(progress) })}</span>
            <span className="truncate max-w-xs">{currentMessage}</span>
          </div>
        </div>
      ) : indexInfo ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="size-4" />
            <span>{t('codebase_index.index_built')}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('codebase_index.file_count')}</div>
              <div className="text-lg font-semibold">{indexInfo.totalFiles}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('codebase_index.chunk_count')}</div>
              <div className="text-lg font-semibold">{indexInfo.totalChunks}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('codebase_index.total_size')}</div>
              <div className="text-lg font-semibold">{formatSize(indexInfo.totalSize)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('codebase_index.updated_at')}</div>
              <div className="text-lg font-semibold">
                {formatIndexedTime(indexInfo.indexedAt, t, i18n.language)}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? t('codebase_index.hide_details') : t('codebase_index.show_details')}
            <ChevronDown
              className={cn('size-4 ml-1 transition-transform', showDetails && 'rotate-180')}
            />
          </Button>

          {showDetails && (
            <div className="pt-3 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('codebase_index.project_name')}</span>
                <span className="font-medium">{indexInfo.projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('codebase_index.project_path')}</span>
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
          <p className="text-sm text-muted-foreground mb-4">{t('codebase_index.no_index_yet')}</p>
          <Button onClick={() => handleIndex(false)}>
            <Database className="size-4 mr-2" />
            {t('codebase_index.start_index')}
          </Button>
        </div>
      )}
    </Card>
  )
}
