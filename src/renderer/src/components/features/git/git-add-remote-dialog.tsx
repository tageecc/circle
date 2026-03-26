import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, GitBranch } from 'lucide-react'

interface GitAddRemoteDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (remoteName: string, remoteUrl: string) => Promise<void>
}

const DEFAULT_REMOTE_NAME = 'origin'

export function GitAddRemoteDialog({ open, onClose, onConfirm }: GitAddRemoteDialogProps) {
  const [remoteName, setRemoteName] = useState(DEFAULT_REMOTE_NAME)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setRemoteName(DEFAULT_REMOTE_NAME)
    setRemoteUrl('')
    setError('')
  }

  const handleConfirm = async () => {
    // 验证输入
    if (!remoteName.trim()) {
      setError('请输入远程仓库名称')
      return
    }
    if (!remoteUrl.trim()) {
      setError('请输入远程仓库 URL')
      return
    }

    // URL格式验证
    const urlPattern = /^(https?:\/\/|git@)/
    if (!urlPattern.test(remoteUrl.trim())) {
      setError('请输入有效的 Git 仓库 URL（支持 HTTPS 或 SSH）')
      return
    }

    try {
      setIsAdding(true)
      setError('')
      await onConfirm(remoteName.trim(), remoteUrl.trim())
      resetForm()
      onClose()
    } catch (err: any) {
      setError(err.message || '添加远程仓库失败')
    } finally {
      setIsAdding(false)
    }
  }

  const handleClose = () => {
    if (!isAdding) {
      resetForm()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <GitBranch className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle>添加远程仓库</DialogTitle>
              <DialogDescription className="mt-1">
                配置远程仓库地址以便推送代码
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="remote-name">远程仓库名称</Label>
            <Input
              id="remote-name"
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              placeholder="origin"
              disabled={isAdding}
            />
            <p className="text-xs text-muted-foreground">通常使用 "origin" 作为默认名称</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remote-url">远程仓库 URL</Label>
            <Input
              id="remote-url"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/username/repo.git"
              disabled={isAdding}
            />
            <p className="text-xs text-muted-foreground">
              支持 HTTPS (https://...) 或 SSH (git@...) 格式
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">💡 提示</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>HTTPS URL 示例: https://github.com/username/repo.git</li>
              <li>SSH URL 示例: git@github.com:username/repo.git</li>
              <li>添加后即可使用 Push 功能推送代码</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isAdding}>
            {isAdding && <Loader2 className="mr-2 size-4 animate-spin" />}
            添加远程仓库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
