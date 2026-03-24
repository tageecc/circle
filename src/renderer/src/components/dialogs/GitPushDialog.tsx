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
import { Label } from '../ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { toast } from 'sonner'

interface GitPushDialogProps {
  open: boolean
  workspaceRoot: string
  currentBranch: string
  onClose: () => void
  onSuccess: () => void
}

export function GitPushDialog({
  open,
  workspaceRoot,
  currentBranch,
  onClose,
  onSuccess
}: GitPushDialogProps) {
  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([])
  const [selectedRemote, setSelectedRemote] = useState('origin')
  const [setUpstream, setSetUpstream] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && workspaceRoot) {
      loadRemotes()
    } else {
      setError('')
    }
  }, [open, workspaceRoot])

  const loadRemotes = async () => {
    try {
      const remoteList = await window.api.git.getRemotes(workspaceRoot)
      setRemotes(remoteList)

      if (remoteList.length > 0 && !remoteList.find((r) => r.name === selectedRemote)) {
        setSelectedRemote(remoteList[0].name)
      }
    } catch (error: any) {
      console.error('Failed to load remotes:', error)
      setError('Failed to load remotes')
    }
  }

  const handlePush = async () => {
    if (!selectedRemote) {
      setError('Please select a remote')
      return
    }

    setLoading(true)
    setError('')

    try {
      await window.api.git.push(workspaceRoot, selectedRemote, currentBranch, setUpstream)

      // 显示成功提示
      toast.success('推送成功', {
        description: `已推送到 ${selectedRemote}/${currentBranch}`
      })

      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to push:', error)
      setError(error.message || 'Failed to push changes')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setError('')
    setSetUpstream(false)
    onClose()
  }

  const canPush = selectedRemote && !loading && remotes.length > 0

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Push to Remote</DialogTitle>
          <DialogDescription>
            Push changes from <strong>{currentBranch}</strong> to remote repository
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Remote Selection */}
          <div className="space-y-2">
            <Label htmlFor="remote">Remote</Label>
            {remotes.length > 0 ? (
              <Select value={selectedRemote} onValueChange={setSelectedRemote} disabled={loading}>
                <SelectTrigger id="remote">
                  <SelectValue placeholder="Select remote" />
                </SelectTrigger>
                <SelectContent>
                  {remotes.map((remote) => (
                    <SelectItem key={remote.name} value={remote.name}>
                      <div className="flex flex-col">
                        <span className="font-medium">{remote.name}</span>
                        <span className="text-xs text-muted-foreground">{remote.url}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                No remotes configured
              </div>
            )}
          </div>

          {/* Set Upstream Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="set-upstream"
              checked={setUpstream}
              onCheckedChange={(checked) => setSetUpstream(checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor="set-upstream" className="cursor-pointer text-sm font-normal">
              Set upstream (--set-upstream)
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
            Cancel
          </Button>
          <Button onClick={handlePush} disabled={!canPush}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
