import { useState } from 'react'
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
import { AlertCircle, Loader2 } from 'lucide-react'
import { Checkbox } from '../ui/checkbox'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface GitNewBranchDialogProps {
  open: boolean
  workspaceRoot: string
  currentBranch: string
  onClose: () => void
  onSuccess: () => void
}

export function GitNewBranchDialog({
  open,
  workspaceRoot,
  currentBranch,
  onClose,
  onSuccess
}: GitNewBranchDialogProps) {
  const { t } = useTranslation('git')
  const [branchName, setBranchName] = useState('')
  const [checkout, setCheckout] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateBranchName = (name: string): { valid: boolean; messageKey?: string } => {
    if (!name || name.trim() === '') {
      return { valid: false, messageKey: 'newBranch.validation.empty' }
    }

    if (name.includes('..') || name.startsWith('.') || name.endsWith('.')) {
      return { valid: false, messageKey: 'newBranch.validation.invalidFormat' }
    }

    if (/[\s~^:?*\[\\]/.test(name)) {
      return { valid: false, messageKey: 'newBranch.validation.invalidChars' }
    }

    return { valid: true }
  }

  const handleBranchNameChange = (name: string) => {
    setBranchName(name)
    const validation = validateBranchName(name)
    if (!validation.valid && name) {
      setError(validation.messageKey ? t(validation.messageKey) : '')
    } else {
      setError('')
    }
  }

  const handleCreate = async () => {
    const validation = validateBranchName(branchName)
    if (!validation.valid) {
      setError(validation.message || 'Invalid branch name')
      return
    }

    setLoading(true)
    setError('')

    try {
      await window.api.git.createBranch(workspaceRoot, branchName, checkout)

      // 显示成功提示
      toast.success(t('newBranch.success'), {
        description: checkout
          ? t('newBranch.createdCheckedOut', { name: branchName })
          : t('newBranch.createdOnly', { name: branchName })
      })

      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to create branch:', error)
      setError(error.message || 'Failed to create branch')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setBranchName('')
    setCheckout(true)
    setError('')
    onClose()
  }

  const canCreate = branchName.trim() && !error && !loading

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>New Branch</DialogTitle>
          <DialogDescription>
            Create a new branch from <strong>{currentBranch}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Branch Name */}
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name *</Label>
            <Input
              id="branch-name"
              placeholder="feature/my-new-feature"
              value={branchName}
              onChange={(e) => handleBranchNameChange(e.target.value)}
              disabled={loading}
              className={error && branchName ? 'border-destructive' : ''}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Use a descriptive name for your branch</p>
          </div>

          {/* Checkout Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="checkout-branch"
              checked={checkout}
              onCheckedChange={(checked) => setCheckout(checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor="checkout-branch" className="cursor-pointer text-sm font-normal">
              Checkout new branch after creation
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
            {t('dialog.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('newBranch.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
