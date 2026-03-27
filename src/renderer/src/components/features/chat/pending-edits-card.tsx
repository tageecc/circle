import { useState } from 'react'
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getFileIcon } from '@/lib/file-icons'
import type { PendingFileEdit } from '@/types/ide'
import { useTranslation } from 'react-i18next'

interface PendingEditsCardProps {
  pendingEdits: PendingFileEdit[]
  onAcceptAll: () => void
  onRejectAll: () => void
  onAcceptFile?: (absolutePath: string) => void
  onRejectFile?: (absolutePath: string) => void
  onOpenFile?: (absolutePath: string) => void
}

/**
 * 待处理文件变更卡片
 * 在会话结束后展示，收集所有待处理的文件变更
 */
export function PendingEditsCard({
  pendingEdits,
  onAcceptAll,
  onRejectAll,
  onAcceptFile,
  onRejectFile,
  onOpenFile
}: PendingEditsCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)

  if (pendingEdits.length === 0) {
    return null
  }

  // 计算每个文件的变更统计（简单的行级比较）
  const getFileStats = (edit: PendingFileEdit) => {
    // 删除文件：显示删除所有行
    if (edit.toolName === 'delete_file') {
      const oldLines = edit.oldContent ? edit.oldContent.split('\n').length : 0
      return { added: 0, deleted: oldLines }
    }

    // 新建文件：显示新增所有行
    if (!edit.oldContent) {
      const newLines = edit.newContent ? edit.newContent.split('\n').length : 0
      return { added: newLines, deleted: 0 }
    }

    // 编辑或清空文件：计算差异
    const oldLines = edit.oldContent.split('\n')
    const newLines = edit.newContent ? edit.newContent.split('\n') : ['']

    const lineDiff = newLines.length - oldLines.length

    if (lineDiff > 0) {
      return { added: lineDiff, deleted: 0 }
    } else if (lineDiff < 0) {
      return { added: 0, deleted: Math.abs(lineDiff) }
    } else {
      const hasChanges = oldLines.some((line, i) => line !== newLines[i])
      return hasChanges ? { added: 1, deleted: 1 } : { added: 0, deleted: 0 }
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
        >
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span>{t('chat.pending_files_count', { count: pendingEdits.length })}</span>
        </button>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={onRejectAll}
            className="h-auto px-0 py-0 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            {t('chat.pending_undo_all')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onAcceptAll}
            className="h-auto px-0 py-0 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            {t('chat.pending_keep_all')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenFile?.(pendingEdits[0].absolutePath)}
            className="h-auto px-0 py-0 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            {t('chat.pending_review')}
          </Button>
        </div>
      </div>

      {/* 文件列表 */}
      {isExpanded && (
        <div className="px-4 py-2">
          {pendingEdits.map((edit) => {
            const fileName = edit.absolutePath.split('/').pop() || edit.absolutePath
            const stats = getFileStats(edit)
            const fileIcon = getFileIcon(fileName)
            const FileIconComponent = fileIcon.icon

            return (
              <div key={edit.absolutePath} className="flex items-center gap-3 py-2 group relative">
                <div
                  className={cn(
                    'flex items-center gap-3 flex-1 min-w-0',
                    onOpenFile && 'cursor-pointer hover:opacity-80 transition-opacity'
                  )}
                  onClick={() => onOpenFile?.(edit.absolutePath)}
                >
                  {/* 文件类型图标 */}
                  <FileIconComponent className={cn('size-4 shrink-0', fileIcon.color)} />

                  {/* 文件名 */}
                  <span className="text-sm text-foreground font-medium truncate">{fileName}</span>

                  {/* 变更统计 */}
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    {stats.added > 0 && (
                      <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
                    )}
                    {stats.deleted > 0 && (
                      <span className="text-red-600 dark:text-red-400">-{stats.deleted}</span>
                    )}
                  </div>
                </div>

                {/* Hover 时显示的操作按钮 */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRejectFile?.(edit.absolutePath)
                    }}
                    title={t('chat.reject_file')}
                  >
                    <X className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAcceptFile?.(edit.absolutePath)
                    }}
                    title={t('chat.accept_file')}
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
