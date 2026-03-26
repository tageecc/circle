import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/sonner'

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
  const [branchName, setBranchName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateBranchName = (name: string): string | null => {
    if (!name.trim()) return null
    if (name.includes('..') || name.startsWith('.') || name.endsWith('.')) {
      return '分支名格式无效'
    }
    if (/[\s~^:?*\[\\]/.test(name)) {
      return '分支名包含无效字符'
    }
    return null
  }

  const handleCreate = async () => {
    const err = validateBranchName(branchName)
    if (err) {
      setError(err)
      return
    }

    setLoading(true)
    setError('')

    try {
      // 默认创建并切换
      await window.api.git.createBranch(workspaceRoot, branchName.trim(), true)
      toast.success(`已创建并切换到 ${branchName.trim()}`)
      onSuccess()
      handleClose()
    } catch (error: any) {
      setError(error.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setBranchName('')
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>New Branch{currentBranch ? ` from '${currentBranch}'` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            placeholder="feature/my-new-feature"
            value={branchName}
            onChange={(e) => {
              setBranchName(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && branchName.trim() && handleCreate()}
            disabled={loading}
            className={error ? 'border-destructive' : ''}
            autoFocus
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!branchName.trim() || loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
