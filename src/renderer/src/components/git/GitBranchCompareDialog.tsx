import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface GitBranch {
  name: string
  current: boolean
  remote: boolean
}

interface GitBranchCompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceRoot: string
  filePath: string
  fileLabel?: string
}

export function GitBranchCompareDialog({
  open,
  onOpenChange,
  workspaceRoot,
  filePath,
  fileLabel
}: GitBranchCompareDialogProps) {
  const { t } = useTranslation('git')
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffText, setDiffText] = useState('')

  useEffect(() => {
    if (!open || !workspaceRoot) return
    let cancelled = false
    setBranchesLoading(true)
    window.api.git
      .getAllBranches(workspaceRoot)
      .then((list: GitBranch[]) => {
        if (cancelled) return
        const comparable = list.filter((b) => !b.current)
        setBranches(comparable)
        if (comparable.length > 0) {
          const first = comparable[0].name
          setSelectedBranch(first)
        } else {
          setSelectedBranch('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranches([])
          setSelectedBranch('')
        }
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceRoot])

  useEffect(() => {
    if (!open || !workspaceRoot || !filePath || !selectedBranch) {
      setDiffText('')
      return
    }
    let cancelled = false
    setDiffLoading(true)
    window.api.git
      .compareWithBranch(workspaceRoot, filePath, selectedBranch)
      .then((text: string) => {
        if (!cancelled) setDiffText(text || '')
      })
      .catch(() => {
        if (!cancelled) setDiffText('')
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceRoot, filePath, selectedBranch])

  const label = fileLabel || filePath.split('/').pop() || filePath

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">{t('branch.compareTitle', { label })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 border-b border-border px-6 py-4">
          <div className="space-y-2">
            <Label className="text-xs">{t('branch.select')}</Label>
            {branchesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('branch.loading')}
              </div>
            ) : branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('branch.noBranches')}</p>
            ) : (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('branch.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                      {b.remote ? t('branch.remoteTag') : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[min(50vh,420px)] px-4 py-3">
          {diffLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('diff.loading')}
            </div>
          ) : (
            <pre className="wrap-break-word whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {diffText.trim() ? diffText : t('branch.noDiff')}
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
