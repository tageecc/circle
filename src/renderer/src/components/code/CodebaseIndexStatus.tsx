import { useState, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Database, RefreshCw, Trash2, Loader2, Check, FileSearch, ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Card } from '../ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CodebaseIndexStatusProps {
  projectPath: string | null
  autoIndex?: boolean // 是否自动索引
  mode?: 'compact' | 'full' // compact: 状态栏紧凑模式, full: 完整卡片模式
}

interface IndexInfo {
  projectName: string
  totalFiles: number
  totalChunks?: number
  totalSize: number
  indexedAt: number
}

interface IndexResult extends IndexInfo {
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
  const { t, i18n } = useTranslation('common')
  const [indexInfo, setIndexInfo] = useState<IndexInfo | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentMessage, setCurrentMessage] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [hasIndexed, setHasIndexed] = useState(false) // 标记是否已经自动索引过
  const [loading, setLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false) // 在compact模式下控制是否显示详细信息

  const formatDate = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return t('timeRelative.justNow')
      if (diffMins < 60) return t('timeRelative.minutesAgo', { count: diffMins })

      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return t('timeRelative.hoursAgo', { count: diffHours })

      const diffDays = Math.floor(diffHours / 24)
      if (diffDays < 30) return t('timeRelative.daysAgo', { count: diffDays })

      const locale = i18n.language === 'zh-CN' ? 'zh-CN' : undefined
      return date.toLocaleDateString(locale)
    },
    [t, i18n.language]
  )

  // 加载索引信息
  const loadIndexInfo = async () => {
    if (!projectPath) {
      setIndexInfo(null)
      return
    }

    try {
      if (mode === 'full') {
        setLoading(true)
      }
      const info = await window.api.codebase.getIndex(projectPath)
      setIndexInfo(info)
      return info
    } catch (error) {
      console.error('Failed to load index info:', error)
      return null
    } finally {
      if (mode === 'full') {
        setLoading(false)
      }
    }
  }

  // 监听进度更新
  useEffect(() => {
    const unsubscribe = window.api.codebase.onIndexProgress((event) => {
      setProgress(event.progress)
      setCurrentMessage(event.file)
    })

    return () => unsubscribe()
  }, [])

  // 监听项目变化和自动索引
  useEffect(() => {
    if (!projectPath) {
      setIndexInfo(null)
      setHasIndexed(false)
      return
    }

    // 加载索引信息
    loadIndexInfo().then((info) => {
      // 如果启用自动索引且没有索引信息，则自动索引
      if (autoIndex && !info && !hasIndexed) {
        console.log('[CodebaseIndexStatus] Auto-indexing new project:', projectPath)
        handleIndex(true) // silent = true，不显示成功提示
        setHasIndexed(true)
      }
    })
  }, [projectPath])

  // 执行索引
  const handleIndex = async (silent = false) => {
    if (!projectPath || isIndexing) return

    setIsIndexing(true)
    setProgress(0)
    setCurrentMessage('')

    try {
      const result = (await window.api.codebase.index(projectPath)) as unknown as IndexResult

      // 智能显示提示
      if (!silent) {
        const hasIncrementalInfo =
          result.newFiles !== undefined ||
          result.modifiedFiles !== undefined ||
          result.unchangedFiles !== undefined

        if (hasIncrementalInfo) {
          const changedCount = (result.newFiles || 0) + (result.modifiedFiles || 0)

          if (changedCount === 0 && (result.unchangedFiles || 0) > 0) {
            toast.success(t('codebaseIndex.toast.upToDate', { count: result.totalFiles }))
          } else {
            const parts: string[] = []
            const joiner = t('codebaseIndex.toast.partsJoiner')
            if (result.newFiles)
              parts.push(t('codebaseIndex.toast.incrementalNew', { count: result.newFiles }))
            if (result.modifiedFiles)
              parts.push(
                t('codebaseIndex.toast.incrementalModified', { count: result.modifiedFiles })
              )
            if (result.deletedFiles)
              parts.push(
                t('codebaseIndex.toast.incrementalDeleted', { count: result.deletedFiles })
              )

            let summary = parts.join(joiner)
            if (result.unchangedFiles) {
              summary += t('codebaseIndex.toast.incrementalUnchangedSuffix', {
                count: result.unchangedFiles
              })
            }
            toast.success(t('codebaseIndex.toast.incrementalDone', { summary }))
          }
        } else {
          toast.success(t('codebaseIndex.toast.fullDone', { count: result.totalFiles }))
        }
      }

      await loadIndexInfo()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t('codebaseIndex.toast.failed', { message }))
      console.error('Indexing failed:', error)
    } finally {
      setIsIndexing(false)
      setProgress(0)
      setCurrentMessage('')
    }
  }

  // 删除索引
  const handleDeleteIndex = async () => {
    if (!projectPath) return

    setPopoverOpen(false)

    try {
      await window.api.codebase.deleteIndex(projectPath)
      toast.success(t('codebaseIndex.toast.deleted'))
      setIndexInfo(null)
      setHasIndexed(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t('codebaseIndex.toast.deleteFailed', { message }))
      console.error('Delete index failed:', error)
    }
  }

  // 格式化大小
  const formatSize = (bytes: number) => {
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(2)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(2)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }

  // Full模式：完整的Card面板
  if (mode === 'full') {
    if (!projectPath) {
      return (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <Database className="w-12 h-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {t('codebaseIndex.full.noProjectTitle')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('codebaseIndex.full.noProjectHint')}
              </p>
            </div>
          </div>
        </Card>
      )
    }

    return (
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{t('codebaseIndex.full.title')}</h2>
          </div>
          <div className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {t('codebaseIndex.full.badge')}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <Trans
              t={t}
              i18nKey="codebaseIndex.full.description"
              components={{ strong: <strong className="text-foreground" /> }}
            />
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : indexInfo ? (
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">项目名称</div>
                  <div className="text-sm font-medium">{indexInfo.projectName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">索引文件数</div>
                  <div className="text-sm font-medium">{indexInfo.totalFiles} 个文件</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">索引大小</div>
                  <div className="text-sm font-medium">{formatSize(indexInfo.totalSize)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">上次更新</div>
                  <div className="text-sm font-medium">{formatDate(indexInfo.indexedAt)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <FileSearch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('codebaseIndex.full.notIndexedYet')}
              </p>
            </div>
          )}

          {isIndexing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('codebaseIndex.full.progressLabel')}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {currentMessage && (
                <p className="text-xs text-muted-foreground truncate" title={currentMessage}>
                  {t('codebaseIndex.processing', { file: currentMessage })}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => handleIndex(false)}
              disabled={isIndexing || !projectPath}
              className="flex-1"
            >
              {isIndexing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('codebaseIndex.full.indexing')}
                </>
              ) : indexInfo ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('codebaseIndex.full.reindex')}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  {t('codebaseIndex.full.startIndex')}
                </>
              )}
            </Button>

            {indexInfo && (
              <Button
                variant="outline"
                onClick={handleDeleteIndex}
                disabled={isIndexing}
                size="icon"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>{t('codebaseIndex.full.footnote1')}</p>
            <p>{t('codebaseIndex.full.footnote2')}</p>
            <p>{t('codebaseIndex.full.footnote3')}</p>
            <p>{t('codebaseIndex.full.footnote4')}</p>
            <p>{t('codebaseIndex.full.footnote5')}</p>
          </div>
        </div>
      </Card>
    )
  }

  // Compact模式：状态栏按钮 + Popover
  if (!projectPath) {
    return null
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-5 gap-1.5 px-1.5 text-xs hover:bg-accent/50',
            isIndexing && 'text-blue-500',
            indexInfo && !isIndexing && 'text-green-500'
          )}
          title={
            isIndexing
              ? t('codebaseIndex.compact.indexingTitle', { percent: progress })
              : indexInfo
                ? t('codebaseIndex.compact.indexedTitle', { name: indexInfo.projectName })
                : t('codebaseIndex.compact.clickToIndex')
          }
        >
          {isIndexing ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span>{progress}%</span>
            </>
          ) : indexInfo ? (
            <>
              <Database className="size-3" />
              <Check className="size-2.5" />
            </>
          ) : (
            <Database className="size-3 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end" side="top" sideOffset={8}>
        <div className="space-y-4">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="size-4" />
              <h3 className="font-semibold">{t('codebaseIndex.compact.popoverTitle')}</h3>
            </div>
            {!isIndexing && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleIndex(false)}
                  title={t('codebaseIndex.compact.reindex')}
                >
                  <RefreshCw className="size-3" />
                </Button>
                {indexInfo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={handleDeleteIndex}
                    title={t('codebaseIndex.compact.deleteIndex')}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 索引进度 */}
          {isIndexing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground truncate">
                {currentMessage || t('codebaseIndex.compact.indexing')}
              </p>
            </div>
          )}

          {/* 索引信息 */}
          {!isIndexing && indexInfo ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">
                    {t('codebaseIndex.compact.project')}
                  </div>
                  <div className="font-medium truncate">{indexInfo.projectName}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">
                    {t('codebaseIndex.compact.fileCount')}
                  </div>
                  <div className="font-medium">{indexInfo.totalFiles}</div>
                </div>
                {indexInfo.totalChunks !== undefined && (
                  <div>
                    <div className="text-muted-foreground text-xs">
                      {t('codebaseIndex.compact.chunks')}
                    </div>
                    <div className="font-medium">{indexInfo.totalChunks}</div>
                  </div>
                )}
                <div>
                  <div className="text-muted-foreground text-xs">
                    {t('codebaseIndex.compact.size')}
                  </div>
                  <div className="font-medium">{formatSize(indexInfo.totalSize)}</div>
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground">
                <div>
                  {t('codebaseIndex.compact.lastUpdatedLine', {
                    time: formatDate(indexInfo.indexedAt)
                  })}
                </div>
              </div>

              {/* 详细信息切换 */}
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-between"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <span>
                    {showDetails
                      ? t('codebaseIndex.compact.hideTechDetails')
                      : t('codebaseIndex.compact.showTechDetails')}
                  </span>
                  <ChevronDown
                    className={cn('size-3 transition-transform', showDetails && 'rotate-180')}
                  />
                </Button>

                {showDetails && (
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 mt-2 border-t">
                    <p>{t('codebaseIndex.compact.detail1')}</p>
                    <p>{t('codebaseIndex.compact.detail2')}</p>
                    <p>{t('codebaseIndex.compact.detail3')}</p>
                    <p>{t('codebaseIndex.compact.detail4')}</p>
                    <p>{t('codebaseIndex.compact.detail5')}</p>
                  </div>
                )}
              </div>
            </div>
          ) : !isIndexing ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Database className="size-8 mx-auto mb-2 opacity-50" />
              <p>{t('codebaseIndex.compact.notIndexed')}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => handleIndex(false)}
              >
                <Database className="size-3 mr-1.5" />
                {t('codebaseIndex.full.startIndex')}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
