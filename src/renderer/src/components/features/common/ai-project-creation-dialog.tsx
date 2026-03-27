import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, CheckCircle2, FolderOpen, Sparkles } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

interface AIProjectCreationDialogProps {
  open: boolean
  userPrompt: string
  onClose: () => void
  onProjectCreated?: (projectPath: string) => void
}

type CreationStage = 'selecting_folder' | 'creating' | 'completed' | 'error'

export function AIProjectCreationDialog({
  open,
  userPrompt,
  onClose,
  onProjectCreated
}: AIProjectCreationDialogProps) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<CreationStage>('selecting_folder')
  const [projectPath, setProjectPath] = useState<string>('')
  const [aiResponse, setAiResponse] = useState<string>('')
  const [error, setError] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setStage('selecting_folder')
      setProjectPath('')
      setAiResponse('')
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [aiResponse])

  const handleSelectFolder = async () => {
    try {
      const result = await window.api.projectCreate.selectProjectFolder()

      if (result.canceled || !result.path) {
        onClose()
        return
      }

      setProjectPath(result.path)
      setStage('creating')

      setAiResponse(t('project_creation.stream_start'))

      const listener = (_: any, chunk: string) => {
        setAiResponse((prev) => prev + chunk)
      }

      window.electron.ipcRenderer.on('project-create:stream:chunk', listener)

      try {
        await window.api.projectCreate.createProject(userPrompt, result.path)
        setStage('completed')
        setAiResponse((prev) => prev + t('project_creation.stream_complete'))
      } catch (err: any) {
        setStage('error')
        setError(err.message || t('project_creation.error_create_failed'))
        setAiResponse(
          (prev) => prev + t('project_creation.stream_error_prefix') + (err.message || '')
        )
      } finally {
        window.electron.ipcRenderer.removeListener('project-create:stream:chunk', listener)
      }
    } catch (err: any) {
      setStage('error')
      setError(err.message || t('project_creation.error_select_folder_failed'))
    }
  }

  const handleComplete = () => {
    if (projectPath && onProjectCreated) {
      onProjectCreated(projectPath)
    }
    onClose()
  }

  const renderContent = () => {
    switch (stage) {
      case 'selecting_folder':
        return (
          <div className="space-y-6 py-6">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">{t('project_creation.your_request')}</p>
                  <p className="text-sm text-muted-foreground">{userPrompt}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('project_creation.intro_select_folder')}
              </p>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <FolderOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-primary">
                      {t('project_creation.tip_title')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('project_creation.tip_body')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSelectFolder} className="gap-2">
                <FolderOpen className="size-4" />
                {t('project_creation.select_folder')}
              </Button>
            </div>
          </div>
        )

      case 'creating':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
              <Loader2 className="size-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('project_creation.creating_heading')}</p>
                <p className="text-xs text-muted-foreground">{projectPath}</p>
              </div>
            </div>

            <ScrollArea className="h-[400px] rounded-lg border border-border/50 bg-muted/20 p-4">
              <div ref={scrollRef}>
                <Markdown>{aiResponse}</Markdown>
              </div>
            </ScrollArea>
          </div>
        )

      case 'completed':
        return (
          <div className="space-y-6 py-6">
            <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <CheckCircle2 className="size-6 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-600 dark:text-green-400">
                  {t('project_creation.success_heading')}
                </p>
                <p className="text-sm text-muted-foreground">{projectPath}</p>
              </div>
            </div>

            <ScrollArea className="h-[300px] rounded-lg border border-border/50 bg-muted/20 p-4">
              <Markdown>{aiResponse}</Markdown>
            </ScrollArea>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                {t('project_creation.open_later')}
              </Button>
              <Button onClick={handleComplete} className="gap-2">
                <CheckCircle2 className="size-4" />
                {t('project_creation.open')}
              </Button>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="space-y-6 py-6">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <p className="font-medium text-red-600 dark:text-red-400">
                {t('project_creation.failed_heading')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>

            {aiResponse && (
              <ScrollArea className="h-[300px] rounded-lg border border-border/50 bg-muted/20 p-4">
                <Markdown>{aiResponse}</Markdown>
              </ScrollArea>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                {t('project_creation.close')}
              </Button>
              <Button onClick={handleSelectFolder}>{t('project_creation.retry')}</Button>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {t('project_creation.ai_dialog_title')}
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
