import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { FolderOpen, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface CloneRepositoryDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (projectPath: string) => void
}

export function CloneRepositoryDialog({ open, onClose, onSuccess }: CloneRepositoryDialogProps) {
  const { t } = useTranslation('project')
  const { t: tc } = useTranslation('common')
  const [repoUrl, setRepoUrl] = useState('')
  const [targetDir, setTargetDir] = useState('')
  const [repoName, setRepoName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cloneProgress, setCloneProgress] = useState('')

  useEffect(() => {
    if (!open) return

    const cleanup = window.api.git.onCloneProgress((message) => {
      setCloneProgress(message)
    })

    return cleanup
  }, [open])

  useEffect(() => {
    if (repoUrl) {
      extractRepoName(repoUrl)
    } else {
      setRepoName('')
      setError('')
    }
  }, [repoUrl])

  const extractRepoName = async (url: string) => {
    const name = await window.api.git.extractRepoName(url)
    setRepoName(name)
  }

  const handleSelectDirectory = async () => {
    const dir = await window.api.git.selectTargetDirectory()
    if (dir) {
      setTargetDir(dir)
    }
  }

  const handleClone = async () => {
    if (!repoUrl || !targetDir || !repoName || loading) {
      return
    }

    setLoading(true)
    setError('')
    setCloneProgress(t('cloneRepositoryDialog.progressPreparing'))

    try {
      const fullPath = `${targetDir}/${repoName}`
      const clonedPath = await window.api.git.cloneRepository(repoUrl, fullPath)

      setCloneProgress(t('cloneRepositoryDialog.progressDone'))

      setTimeout(() => {
        onSuccess(clonedPath)
        handleClose()
      }, 500)
    } catch (error: any) {
      setError(error.message || t('cloneRepositoryDialog.cloneFailed'))
      setCloneProgress('')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return

    setRepoUrl('')
    setTargetDir('')
    setRepoName('')
    setError('')
    setCloneProgress('')
    onClose()
  }

  const canClone = repoUrl && targetDir && repoName && !loading

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{t('cloneRepositoryDialog.title')}</DialogTitle>
          <DialogDescription>{t('cloneRepositoryDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Repository URL */}
          <div className="space-y-2">
            <Label htmlFor="repo-url">{t('cloneRepositoryDialog.repositoryUrl')}</Label>
            <Input
              id="repo-url"
              placeholder={t('cloneRepositoryDialog.urlPlaceholder')}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={loading}
              className={error && repoUrl ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">{t('cloneRepositoryDialog.urlHint')}</p>
          </div>

          {/* Target Directory */}
          <div className="space-y-2">
            <Label htmlFor="target-dir">{t('cloneRepositoryDialog.parentDirectory')}</Label>
            <div className="flex gap-2">
              <Input
                id="target-dir"
                placeholder={t('cloneRepositoryDialog.parentDirectoryPlaceholder')}
                value={targetDir}
                readOnly
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSelectDirectory}
                disabled={loading}
              >
                <FolderOpen className="size-4" />
              </Button>
            </div>
          </div>

          {/* Repository Name */}
          <div className="space-y-2">
            <Label htmlFor="repo-name">{t('cloneRepositoryDialog.repositoryName')}</Label>
            <Input
              id="repo-name"
              placeholder={t('cloneRepositoryDialog.repositoryNamePlaceholder')}
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              disabled={loading}
            />
            {targetDir && repoName && (
              <p className="text-xs text-muted-foreground">
                {t('cloneRepositoryDialog.willCloneTo', { path: `${targetDir}/${repoName}` })}
              </p>
            )}
          </div>

          {/* Progress Message */}
          {cloneProgress && (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <Loader2 className="size-4 animate-spin" />
              <span>{cloneProgress}</span>
            </div>
          )}

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
            {tc('button.cancel')}
          </Button>
          <Button onClick={handleClone} disabled={!canClone}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('cloneRepositoryDialog.cloneButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
