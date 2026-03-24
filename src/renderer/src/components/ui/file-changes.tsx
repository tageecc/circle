import { useState } from 'react'
import { Button } from './button'
import { ChevronDown, ChevronUp, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FileChange {
  path: string
  absolutePath: string
  linesAdded: number
  linesRemoved: number
  toolCallId: string
  /** 本会话内首次修改前快照；用于 Undo All 写回 */
  baselineSnapshot?: string | null
  /** 本会话新建文件（撤销时应删除） */
  fileCreatedBySession?: boolean
}

interface FileChangesReviewProps {
  files: FileChange[]
  onOpenFile?: (filePath: string) => void
}

// 文件修改清单组件 - 显示在对话末尾
export function FileChangesReview({ files, onOpenFile }: FileChangesReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (files.length === 0) return null

  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    const iconMap: Record<string, string> = {
      tsx: '⚛️',
      ts: '🔷',
      jsx: '⚛️',
      js: '🟨',
      css: '🎨',
      md: '📝',
      json: '📋'
    }
    return iconMap[ext || ''] || '📄'
  }

  const truncateFileName = (path: string, maxLength = 30) => {
    if (path.length <= maxLength) return path
    const fileName = path.split('/').pop() || path
    if (fileName.length <= maxLength) return fileName
    return fileName.slice(0, maxLength - 3) + '...'
  }

  return (
    <div className="my-3 rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-foreground">
            {files.length} File{files.length > 1 ? 's' : ''} Edited
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Review</span>
          {isExpanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* File List */}
      {isExpanded && (
        <div className="border-t border-border/60 bg-background/50">
          {files.map((file, index) => (
            <div
              key={file.toolCallId + index}
              className={cn(
                'flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer',
                index > 0 && 'border-t border-border/40'
              )}
              onClick={() => onOpenFile?.(file.absolutePath)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base">{getFileIcon(file.path)}</span>
                <span className="text-sm font-mono text-foreground truncate" title={file.path}>
                  {truncateFileName(file.path)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono ml-2 shrink-0">
                {file.linesAdded > 0 && (
                  <span className="text-green-600 dark:text-green-500">+{file.linesAdded}</span>
                )}
                {file.linesRemoved > 0 && (
                  <span className="text-red-600 dark:text-red-500">-{file.linesRemoved}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface FileChangesBarProps {
  fileCount: number
  onKeepAll: () => void
  onUndoAll: () => void
  onDismiss: () => void
}

// 批量操作栏 - 显示在输入框上方
export function FileChangesBar({
  fileCount,
  onKeepAll,
  onUndoAll,
  onDismiss
}: FileChangesBarProps) {
  if (fileCount === 0) return null

  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center gap-3">
        <ChevronDown className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {fileCount} File{fileCount > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onUndoAll}>
          Undo All
        </Button>
        <Button variant="default" size="sm" className="h-8 text-xs" onClick={onKeepAll}>
          Keep All
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onDismiss}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
