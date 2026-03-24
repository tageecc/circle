import { FileTab, MarkdownMode, GitStatus } from '../../types'
import { File, Code, Columns, Eye, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

// Git状态颜色映射（组件外部，只创建一次）
const getGitStatusColor = (gitStatus: GitStatus | undefined | null): string => {
  if (!gitStatus) return ''

  switch (gitStatus) {
    case 'modified':
      return 'text-yellow-600 dark:text-yellow-500'
    case 'untracked':
      return 'text-green-600 dark:text-green-500'
    case 'staged':
      return 'text-green-600 dark:text-green-500'
    case 'conflicted':
      return 'text-red-600 dark:text-red-500'
    default:
      return ''
  }
}

// Git状态徽章映射（组件外部，只创建一次）
const getGitStatusBadge = (gitStatus: GitStatus | undefined | null): string | null => {
  if (!gitStatus) return null

  switch (gitStatus) {
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

interface TabBarProps {
  openFiles: FileTab[]
  activeFile: string | null
  autoSave: boolean
  isMarkdownFile: boolean
  markdownMode?: MarkdownMode
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseToRight: (path: string) => void
  onCloseAll: () => void
  onMarkdownModeChange?: (mode: MarkdownMode) => void
}

export function TabBar({
  openFiles,
  activeFile,
  autoSave,
  isMarkdownFile,
  markdownMode,
  onTabClick,
  onTabClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onMarkdownModeChange
}: TabBarProps) {
  return (
    <div className="flex min-h-[42px] items-center justify-between border-b border-border/30 bg-background shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
      <div className="tab-scroll flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex">
          {openFiles.map((file, index) => {
            // 优先显示错误状态（红色），其次是Git状态
            const statusColor = file.hasErrors
              ? 'text-red-600 dark:text-red-500'
              : getGitStatusColor(file.gitStatus)
            const gitBadge = getGitStatusBadge(file.gitStatus)

            return (
              <ContextMenu key={file.path}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => onTabClick(file.path)}
                    className={cn(
                      'group relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm transition-all',
                      activeFile === file.path
                        ? 'bg-background text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      file.isDeleted && 'text-destructive',
                      !file.isDeleted && statusColor
                    )}
                  >
                    <File className="size-3 shrink-0" />
                    <span className={`whitespace-nowrap ${file.isDeleted ? 'line-through' : ''}`}>
                      {file.name}
                      {file.isDeleted && ' (已删除)'}
                    </span>

                    {/* Git状态徽章 (M/U/A/C) */}
                    {!file.isDeleted && gitBadge && (
                      <span className={cn('shrink-0 text-xs font-semibold', statusColor)}>
                        {gitBadge}
                      </span>
                    )}

                    {/* 状态指示器：错误 > 未保存 */}
                    {!file.isDeleted && (
                      <>
                        {file.hasErrors && (
                          <Circle className="size-2 shrink-0 fill-red-600 text-red-600 dark:fill-red-500 dark:text-red-500" />
                        )}
                        {!file.hasErrors && !autoSave && file.isDirty && (
                          <Circle className="size-2 shrink-0 fill-primary text-primary" />
                        )}
                      </>
                    )}

                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        onTabClose(file.path)
                      }}
                      className="ml-1 shrink-0 cursor-pointer opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      ×
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onTabClose(file.path)}>关闭</ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onCloseOthers(file.path)}
                    disabled={openFiles.length === 1}
                  >
                    关闭其他
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onCloseToRight(file.path)}
                    disabled={index === openFiles.length - 1}
                  >
                    关闭右侧
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={onCloseAll}>关闭所有</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      </div>

      {isMarkdownFile && markdownMode && onMarkdownModeChange && (
        <div className="flex items-center gap-0.5 px-2">
          <Button
            variant={markdownMode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onMarkdownModeChange('edit')}
            title="仅编辑"
          >
            <Code className="size-4" />
          </Button>
          <Button
            variant={markdownMode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onMarkdownModeChange('split')}
            title="分屏"
          >
            <Columns className="size-4" />
          </Button>
          <Button
            variant={markdownMode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onMarkdownModeChange('preview')}
            title="仅预览"
          >
            <Eye className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
