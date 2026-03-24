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
import { FolderOpen, AlertCircle, Loader2 } from 'lucide-react'

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (projectPath: string) => void
}

export function NewProjectDialog({ open, onClose, onSuccess }: NewProjectDialogProps) {
  const [parentDir, setParentDir] = useState('')
  const [projectName, setProjectName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSelectDirectory = async () => {
    const dir = await window.api.git.selectTargetDirectory()
    if (dir) {
      setParentDir(dir)
    }
  }

  const handleCreate = async () => {
    if (!parentDir || !projectName || loading) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const projectPath = await window.api.git.createNewProject(parentDir, projectName)
      onSuccess(projectPath)
      handleClose()
    } catch (error: any) {
      setError(error.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return

    setParentDir('')
    setProjectName('')
    setError('')
    onClose()
  }

  const canCreate = parentDir && projectName && !loading

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a new project folder with a basic structure</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="my-awesome-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={loading}
              className={error && projectName ? 'border-destructive' : ''}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Enter a name for your new project</p>
          </div>

          {/* Parent Directory */}
          <div className="space-y-2">
            <Label htmlFor="parent-dir">Location</Label>
            <div className="flex gap-2">
              <Input
                id="parent-dir"
                placeholder="Select parent directory..."
                value={parentDir}
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
            {parentDir && projectName && (
              <p className="text-xs text-muted-foreground">
                Will create: {parentDir}/{projectName}
              </p>
            )}
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
          <Button onClick={handleCreate} disabled={!canCreate}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
