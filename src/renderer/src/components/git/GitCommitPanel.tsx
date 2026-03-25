import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import { toast } from 'sonner'
import {
  GitCommit,
  Upload,
  Loader2,
  FileIcon,
  FilePlus,
  FileEdit,
  FileX,
  CheckCircle2,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  conflicted: string[]
}

interface GitCommitPanelProps {
  workspaceRoot: string
  onFileClick?: (filePath: string) => void
  onSuccess?: () => void
  onRefresh?: () => void
}

interface FileItem {
  path: string
  status: 'staged' | 'modified' | 'untracked' | 'conflicted'
}

export function GitCommitPanel({
  workspaceRoot,
  onFileClick,
  onSuccess,
  onRefresh
}: GitCommitPanelProps) {
  const { t } = useTranslation(['git', 'common'])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const [expandedSections, setExpandedSections] = useState({
    staged: true,
    unstaged: true,
    untracked: true
  })

  useEffect(() => {
    loadStatus()
  }, [workspaceRoot])

  const loadStatus = async () => {
    setLoading(true)
    try {
      const gitStatus = await window.api.git.getStatus(workspaceRoot)
      setStatus(gitStatus)

      const allFiles = [...gitStatus.staged, ...gitStatus.modified, ...gitStatus.untracked]
      setSelectedFiles(new Set(allFiles))
      onRefresh?.()
    } catch (error) {
      console.error('Failed to load git status:', error)
      toast.error(t('git:status.loading'), {
        description: error instanceof Error ? error.message : t('common:message.unknownError')
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleFile = (file: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(file)) {
      newSelected.delete(file)
    } else {
      newSelected.add(file)
    }
    setSelectedFiles(newSelected)
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const selectAllInSection = (files: string[]) => {
    const newSelected = new Set(selectedFiles)
    const allSelected = files.every((f) => selectedFiles.has(f))

    if (allSelected) {
      files.forEach((f) => newSelected.delete(f))
    } else {
      files.forEach((f) => newSelected.add(f))
    }
    setSelectedFiles(newSelected)
  }

  const handleStageFile = async (file: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await window.api.git.stageFiles(workspaceRoot, [file])
      await loadStatus()
      toast.success(t('stage.success'))
    } catch (error) {
      toast.error(t('stage.failed'), {
        description: error instanceof Error ? error.message : t('common:message.unknownError')
      })
    }
  }

  const handleUnstageFile = async (file: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await window.api.git.unstageFiles(workspaceRoot, [file])
      await loadStatus()
      toast.success(t('stage.unstageSuccess'))
    } catch (error) {
      toast.error(t('stage.unstageFailed'), {
        description: error instanceof Error ? error.message : t('common:message.unknownError')
      })
    }
  }

  const handleCommit = async (andPush: boolean = false) => {
    if (!message.trim()) {
      toast.error(t('commit.emptyMessage'))
      return
    }

    if (selectedFiles.size === 0) {
      toast.error(t('commit.noFiles'))
      return
    }

    setCommitting(true)
    try {
      await window.api.git.stageFiles(workspaceRoot, Array.from(selectedFiles))
      await window.api.git.commit(workspaceRoot, message.trim())

      toast.success(t('commit.success'), {
        description: t('commit.filesCommitted', { count: selectedFiles.size })
      })

      if (andPush) {
        try {
          await window.api.git.push(workspaceRoot, 'origin')
          toast.success(t('push.success'))
        } catch (error) {
          toast.error(t('push.failed'), {
            description: error instanceof Error ? error.message : t('common:message.unknownError')
          })
        }
      }

      setMessage('')
      setSelectedFiles(new Set())
      onSuccess?.()
      await loadStatus()
    } catch (error) {
      toast.error(t('commit.failed'), {
        description: error instanceof Error ? error.message : t('common:message.unknownError')
      })
    } finally {
      setCommitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-4 text-center">
        <p className="text-sm text-muted-foreground">{t('status.noStatus')}</p>
        <Button size="sm" variant="outline" onClick={loadStatus} className="mt-2">
          {t('common:button.retry')}
        </Button>
      </div>
    )
  }

  const stagedFiles: FileItem[] = status.staged.map((f) => ({ path: f, status: 'staged' }))
  const unstagedFiles: FileItem[] = [
    ...status.modified.map((f) => ({ path: f, status: 'modified' as const })),
    ...status.conflicted.map((f) => ({ path: f, status: 'conflicted' as const }))
  ]
  const untrackedFiles: FileItem[] = status.untracked.map((f) => ({ path: f, status: 'untracked' }))

  const allFiles = [...stagedFiles, ...unstagedFiles, ...untrackedFiles]
  const hasChanges = allFiles.length > 0
  const canCommit = message.trim() && selectedFiles.size > 0 && !committing

  const getFileIcon = (status: FileItem['status']) => {
    switch (status) {
      case 'untracked':
        return <FilePlus className="size-3.5 text-green-600 dark:text-green-500" />
      case 'modified':
        return <FileEdit className="size-3.5 text-blue-600 dark:text-blue-500" />
      case 'staged':
        return <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-500" />
      case 'conflicted':
        return <FileX className="size-3.5 text-red-600 dark:text-red-500" />
      default:
        return <FileIcon className="size-3.5 text-muted-foreground" />
    }
  }

  const renderFileSection = (
    title: string,
    files: FileItem[],
    sectionKey: keyof typeof expandedSections
  ) => {
    if (files.length === 0) return null

    const expanded = expandedSections[sectionKey]
    const allFilePaths = files.map((f) => f.path)
    const allSelected = allFilePaths.every((f) => selectedFiles.has(f))
    const someSelected = allFilePaths.some((f) => selectedFiles.has(f))

    return (
      <div className="border-b border-border/30 last:border-0">
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30 cursor-pointer"
          onClick={() => toggleSection(sectionKey)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <Checkbox
            checked={allSelected}
            ref={(el) => {
              if (el) {
                const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null
                if (input) input.indeterminate = someSelected && !allSelected
              }
            }}
            onCheckedChange={() => selectAllInSection(allFilePaths)}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto"
          />
          <span className="flex-1 text-xs font-medium text-foreground/90">{title}</span>
          <span className="text-xs text-muted-foreground">({files.length})</span>
        </div>

        {expanded && (
          <div className="space-y-0.5 pb-1">
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/30 cursor-pointer group"
                onClick={() => onFileClick?.(file.path)}
              >
                <Checkbox
                  checked={selectedFiles.has(file.path)}
                  onCheckedChange={() => toggleFile(file.path)}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-5"
                />
                {getFileIcon(file.status)}
                <span className="flex-1 truncate text-xs font-mono text-foreground/80">
                  {file.path.split('/').pop()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs opacity-0 group-hover:opacity-100"
                  onClick={
                    file.status === 'staged'
                      ? (e) => handleUnstageFile(file.path, e)
                      : (e) => handleStageFile(file.path, e)
                  }
                >
                  {file.status === 'staged' ? '−' : '+'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <Textarea
            placeholder={t('panel.commitPlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={committing}
            className="min-h-[80px] resize-none text-xs"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canCommit) {
                handleCommit()
              }
            }}
          />

          <div className="flex gap-1.5">
            <Button
              onClick={() => handleCommit(false)}
              disabled={!canCommit}
              className="flex-1 h-7 text-xs"
              size="sm"
            >
              {committing && <Loader2 className="mr-1.5 size-3 animate-spin" />}
              <GitCommit className="mr-1.5 size-3" />
              {t('panel.commit')}
            </Button>
            <Button
              onClick={() => handleCommit(true)}
              disabled={!canCommit}
              variant="secondary"
              className="flex-1 h-7 text-xs"
              size="sm"
            >
              <Upload className="mr-1.5 size-3" />
              {t('panel.push')}
            </Button>
          </div>
        </div>

        <Separator />

        {!hasChanges ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-medium text-muted-foreground">{t('panel.noChanges')}</p>
            <p className="text-[10px] text-muted-foreground/70">{t('panel.workingTreeClean')}</p>
          </div>
        ) : (
          <div className="pb-2">
            {renderFileSection(t('panel.sectionStaged'), stagedFiles, 'staged')}
            {renderFileSection(t('panel.sectionChanges'), unstagedFiles, 'unstaged')}
            {renderFileSection(t('panel.sectionUntracked'), untrackedFiles, 'untracked')}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
