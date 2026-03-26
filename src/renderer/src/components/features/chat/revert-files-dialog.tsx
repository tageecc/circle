/**
 * Revert Files Dialog
 * 用于 Revert 按钮：恢复文件到某个消息的状态
 */

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileIcon, AlertTriangleIcon } from 'lucide-react'
import { toast } from '@/components/ui/sonner'

interface AffectedFile {
  path: string
  action: 'create' | 'edit' | 'delete'
  size: number
}

interface RevertFilesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messageId: number
  onConfirm: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i]
}

function getActionLabel(action: 'create' | 'edit' | 'delete'): string {
  switch (action) {
    case 'create':
      return '新建'
    case 'edit':
      return '修改'
    case 'delete':
      return '删除'
  }
}

function getActionIcon(action: 'create' | 'edit' | 'delete'): string {
  switch (action) {
    case 'create':
      return '➕'
    case 'edit':
      return '✏️'
    case 'delete':
      return '❌'
  }
}

export function RevertFilesDialog({
  open,
  onOpenChange,
  messageId,
  onConfirm
}: RevertFilesDialogProps) {
  const [files, setFiles] = useState<AffectedFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && messageId) {
      loadAffectedFiles()
    }
  }, [open, messageId])

  const loadAffectedFiles = async () => {
    try {
      setLoading(true)
      const affectedFiles = await window.api.message.getAffectedFiles(messageId)
      setFiles(affectedFiles)
    } catch (error) {
      console.error('Failed to load affected files:', error)
      toast.error('获取文件列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="size-5" />
            恢复文件到此消息的状态
          </DialogTitle>
          <DialogDescription className="text-sm">
            {loading ? (
              <span>正在加载文件列表...</span>
            ) : (
              <span>将恢复以下 {files.length} 个文件：</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] rounded-md border">
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-3">加载中...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                此消息没有文件变更
              </div>
            ) : (
              files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <span className="text-lg">{getActionIcon(file.action)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" title={file.path}>
                      {file.path}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getActionLabel(file.action)} · {formatBytes(file.size)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <AlertTriangleIcon className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-500/90 leading-relaxed">
            <div className="font-medium mb-1">警告</div>
            <ul className="space-y-1 text-xs">
              <li>• 这些文件的所有修改都会被覆盖（包括你的手动修改）</li>
              <li>• 此操作不会删除消息历史</li>
              <li>• 💡 建议：如果有未保存的重要修改，请先用 Git 提交</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading || files.length === 0}>
            确认恢复
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
