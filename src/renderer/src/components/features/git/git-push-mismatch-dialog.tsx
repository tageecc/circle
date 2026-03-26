import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, GitBranch, ArrowRight } from 'lucide-react'

interface GitPushMismatchDialogProps {
  open: boolean
  currentBranch: string
  remote: string
  trackedBranch: string
  onClose: () => void
  onPushToTracked: () => Promise<boolean>
  onPushAndSetTracking: () => Promise<boolean>
}

/**
 * Push 分支名不匹配时的选择对话框
 * 纯 UI 组件，业务逻辑由外部传入
 */
export function GitPushMismatchDialog({
  open,
  currentBranch,
  remote,
  trackedBranch,
  onClose,
  onPushToTracked,
  onPushAndSetTracking
}: GitPushMismatchDialogProps) {
  const [loading, setLoading] = useState<'tracked' | 'new' | null>(null)

  const handlePushToTracked = async () => {
    setLoading('tracked')
    try {
      const success = await onPushToTracked()
      if (success) onClose()
    } finally {
      setLoading(null)
    }
  }

  const handlePushAndSetTracking = async () => {
    setLoading('new')
    try {
      const success = await onPushAndSetTracking()
      if (success) onClose()
    } finally {
      setLoading(null)
    }
  }

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Push Commits</DialogTitle>
          <DialogDescription>本地分支名称与追踪的远程分支名称不匹配</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="size-4" />
            <span>本地分支:</span>
            <span className="font-medium text-foreground">{currentBranch}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="size-4" />
            <span>追踪分支:</span>
            <span className="font-medium text-foreground">
              {remote}/{trackedBranch}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={handlePushToTracked}
            disabled={loading !== null}
          >
            {loading === 'tracked' && <Loader2 className="mr-2 size-4 animate-spin" />}
            <div className="text-left">
              <div className="font-medium">推送到追踪分支</div>
              <div className="text-xs text-muted-foreground">
                推送到 {remote}/{trackedBranch}
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={handlePushAndSetTracking}
            disabled={loading !== null}
          >
            {loading === 'new' && <Loader2 className="mr-2 size-4 animate-spin" />}
            <div className="text-left">
              <div className="font-medium">推送并设置新追踪</div>
              <div className="text-xs text-muted-foreground">
                推送到 {remote}/{currentBranch} 并更新追踪
              </div>
            </div>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading !== null}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
