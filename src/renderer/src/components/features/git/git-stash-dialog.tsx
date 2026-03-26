import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Archive } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/components/ui/sonner'

interface GitStashDialogProps {
  open: boolean
  workspaceRoot: string
  currentBranch: string
  onClose: () => void
  onSuccess: () => void
}

export function GitStashDialog({
  open,
  workspaceRoot,
  currentBranch,
  onClose,
  onSuccess
}: GitStashDialogProps) {
  const [message, setMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setMessage('')
      setIncludeUntracked(true)
      setError('')
    }
  }, [open])

  const handleStash = async () => {
    setLoading(true)
    setError('')

    try {
      await window.api.git.stash(workspaceRoot, message || undefined, includeUntracked)

      toast.success('Stash 创建成功', {
        description: message ? `"${message}"` : '已保存当前工作区更改'
      })

      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to stash:', error)
      setError(error.message || 'Failed to stash changes')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setMessage('')
    setIncludeUntracked(true)
    setError('')
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleStash()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="size-5" />
            Stash Changes
          </DialogTitle>
          <DialogDescription>
            临时保存{currentBranch ? <> <strong>{currentBranch}</strong> 分支上的</> : ''}本地更改
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stash Message */}
          <div className="space-y-2">
            <Label htmlFor="stash-message">消息（可选）</Label>
            <Input
              id="stash-message"
              placeholder="WIP: 正在开发的功能..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">添加描述信息方便后续识别</p>
          </div>

          {/* Include Untracked Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-untracked"
              checked={includeUntracked}
              onCheckedChange={(checked) => setIncludeUntracked(checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor="include-untracked" className="cursor-pointer text-sm font-normal">
              包含未跟踪的文件（新建的文件）
            </Label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleStash} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Stash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
