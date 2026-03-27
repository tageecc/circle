import { useState, useCallback, DragEvent } from 'react'
import { FileTab, MarkdownMode, GitStatus, PendingFileEdit } from '@/types/ide'
import { File, Code, Columns, Eye, Circle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useTranslation } from 'react-i18next'

// Git状态颜色映射
const getGitStatusColor = (gitStatus?: GitStatus): string => {
  if (!gitStatus) return ''

  switch (gitStatus) {
    case 'modified':
      return 'text-yellow-600 dark:text-yellow-500'
    case 'untracked':
    case 'added':
    case 'staged':
      return 'text-green-600 dark:text-green-500'
    case 'conflicted':
    case 'deleted':
      return 'text-red-600 dark:text-red-500'
    default:
      return ''
  }
}

// Git状态徽章映射
const getGitStatusBadge = (gitStatus?: GitStatus): string | null => {
  if (!gitStatus) return null

  switch (gitStatus) {
    case 'modified':
      return 'M'
    case 'untracked':
      return 'U'
    case 'added':
      return 'A'
    case 'staged':
      return 'S'
    case 'conflicted':
      return 'C'
    case 'deleted':
      return 'D'
    default:
      return null
  }
}

// 获取 tab 的唯一标识
const getTabId = (file: FileTab) => {
  if (file.stashIndex !== undefined) {
    return `${file.path}:stash:${file.stashIndex}`
  }
  if (file.baseBranch && file.compareBranch) {
    return `${file.path}:compare:${file.baseBranch}:${file.compareBranch}`
  }
  if (file.commitHash) {
    return `${file.path}:commit:${file.commitHash}`
  }
  if (file.showConflict) {
    return `${file.path}:conflict`
  }
  return file.showDiff ? `${file.path}:diff` : file.path
}

interface TabBarProps {
  openFiles: FileTab[]
  activeFile: string | null
  autoSave: boolean
  isMarkdownFile: boolean
  markdownMode?: MarkdownMode
  pendingFileEdits?: PendingFileEdit[]
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseToRight: (path: string) => void
  onCloseAll: () => void
  onMarkdownModeChange?: (mode: MarkdownMode) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export function TabBar({
  openFiles,
  activeFile,
  autoSave,
  isMarkdownFile,
  markdownMode,
  pendingFileEdits,
  onTabClick,
  onTabClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onMarkdownModeChange,
  onReorder
}: TabBarProps) {
  const { t } = useTranslation()
  // Store - 精确订阅
  const showFileTree = useWorkspaceUIStore((state) => state.showFileTree)

  // 拖拽状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((e: DragEvent<HTMLButtonElement>, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // 使用自定义 MIME 类型，避免 Monaco 编辑器接收数据
    e.dataTransfer.setData('application/x-tab-reorder', String(index))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDropIndex(null)
  }, [])

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLButtonElement>, index: number) => {
      e.preventDefault()
      if (draggedIndex === null || draggedIndex === index) {
        setDropIndex(null)
        return
      }
      e.dataTransfer.dropEffect = 'move'
      setDropIndex(index)
    },
    [draggedIndex]
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLButtonElement>, toIndex: number) => {
      e.preventDefault()
      if (draggedIndex === null || draggedIndex === toIndex || !onReorder) {
        handleDragEnd()
        return
      }
      onReorder(draggedIndex, toIndex)
      handleDragEnd()
    },
    [draggedIndex, onReorder, handleDragEnd]
  )

  return (
    <div className="flex min-h-[42px] items-center justify-between border-b border-border/30 bg-background shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)] window-drag-region">
      <div className="scrollbar-thin-x flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden window-no-drag">
        <div className={cn('flex', !showFileTree && 'pl-20')}>
          {openFiles.map((file, index) => {
            const tabId = getTabId(file)
            const hasPendingEdit = pendingFileEdits?.some(
              (edit) => edit.absolutePath === file.path || edit.filePath === file.name
            )
            const statusColor = file.hasErrors
              ? 'text-red-600 dark:text-red-500'
              : getGitStatusColor(file.gitStatus)
            const gitBadge = getGitStatusBadge(file.gitStatus)
            const isDragging = draggedIndex === index
            const isDropTarget = dropIndex === index

            return (
              <ContextMenu key={tabId}>
                <ContextMenuTrigger asChild>
                  <button
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => setDropIndex(null)}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => onTabClick(tabId)}
                    className={cn(
                      'group relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm transition-all border-b-2',
                      activeFile === tabId
                        ? 'bg-background/80 text-foreground font-medium border-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent',
                      file.isDeleted && 'text-destructive',
                      !file.isDeleted && statusColor,
                      isDragging && 'opacity-50',
                      isDropTarget && 'border-l-2 border-l-primary'
                    )}
                  >
                    <File className="size-3 shrink-0" />
                    <span
                      className={cn(
                        'whitespace-nowrap',
                        file.isDeleted && 'line-through',
                        file.isPreview && 'italic opacity-90'
                      )}
                    >
                      {file.name}
                      {file.baseBranch && file.compareBranch
                        ? ' (Compare)'
                        : file.stashIndex !== undefined
                          ? ` (Stash #${file.stashIndex})`
                          : file.commitHash
                            ? ` (${file.commitHash.slice(0, 7)})`
                            : file.showConflict
                              ? ' (Merge)'
                              : file.showDiff && ' (Diff)'}
                      {file.isDeleted && t('editor.tab_deleted_suffix')}
                    </span>

                    {/* Git状态徽章 */}
                    {!file.isDeleted && gitBadge && (
                      <span className={cn('shrink-0 text-xs font-semibold', statusColor)}>
                        {gitBadge}
                      </span>
                    )}

                    {/* 状态指示器 */}
                    {!file.isDeleted && (
                      <>
                        {hasPendingEdit && (
                          <Pencil className="size-3 shrink-0 text-orange-600 dark:text-orange-400" />
                        )}
                        {!hasPendingEdit && file.hasErrors && (
                          <Circle className="size-2 shrink-0 fill-red-600 text-red-600 dark:fill-red-500 dark:text-red-500" />
                        )}
                        {!hasPendingEdit && !file.hasErrors && !autoSave && file.isDirty && (
                          <Circle className="size-2 shrink-0 fill-primary text-primary" />
                        )}
                      </>
                    )}

                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        onTabClose(tabId)
                      }}
                      className="ml-1 shrink-0 cursor-pointer opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      ×
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onTabClose(tabId)}>
                    {t('editor.close_tab')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onCloseOthers(tabId)}
                    disabled={openFiles.length === 1}
                  >
                    {t('editor.close_other_tabs')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onCloseToRight(tabId)}
                    disabled={index === openFiles.length - 1}
                  >
                    {t('editor.close_tabs_to_right')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={onCloseAll}>
                    {t('editor.close_all_tabs')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      </div>

      {isMarkdownFile && markdownMode && onMarkdownModeChange && (
        <div className="flex items-center gap-0.5 px-2 window-no-drag">
          <Button
            variant={markdownMode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onMarkdownModeChange('edit')}
            title={t('editor.markdown_edit_only')}
          >
            <Code className="size-4" />
          </Button>
          <Button
            variant={markdownMode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onMarkdownModeChange('split')}
            title={t('editor.markdown_split')}
          >
            <Columns className="size-4" />
          </Button>
          <Button
            variant={markdownMode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onMarkdownModeChange('preview')}
            title={t('editor.markdown_preview_only')}
          >
            <Eye className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
