import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setError(t('git.remote_name_required'))
      return
    }
    if (!remoteUrl.trim()) {
      setError(t('git.remote_url_required'))
      return
    }

    // URL格式验证
    const urlPattern = /^(https?:\/\/|git@)/
    if (!urlPattern.test(remoteUrl.trim())) {
      setError(t('git.remote_url_invalid'))
      return
    }

    try {
      setIsAdding(true)
      setError('')
      await onConfirm(remoteName.trim(), remoteUrl.trim())
      resetForm()
      onClose()
    } catch (err: any) {
      setError(err.message || t('git.add_remote_failed'))
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
              <DialogTitle>{t('git.add_remote_title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('git.add_remote_description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="remote-name">{t('git.remote_name_label')}</Label>
            <Input
              id="remote-name"
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              placeholder="origin"
              disabled={isAdding}
            />
            <p className="text-xs text-muted-foreground">{t('git.remote_name_hint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remote-url">{t('git.remote_url_label')}</Label>
            <Input
              id="remote-url"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/username/repo.git"
              disabled={isAdding}
            />
            <p className="text-xs text-muted-foreground">{t('git.remote_url_format_hint')}</p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">💡 {t('git.add_remote_tips_title')}</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>{t('git.add_remote_tip_https')}</li>
              <li>{t('git.add_remote_tip_ssh')}</li>
              <li>{t('git.add_remote_tip_push')}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isAdding}>
            {isAdding && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('git.add_remote_submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
