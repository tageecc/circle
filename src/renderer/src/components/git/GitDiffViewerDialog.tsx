import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface GitDiffViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  diffText: string
  loading?: boolean
}

export function GitDiffViewerDialog({
  open,
  onOpenChange,
  title,
  diffText,
  loading
}: GitDiffViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[min(65vh,560px)] px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载差异…
            </div>
          ) : (
            <pre className="wrap-break-word whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
              {diffText.trim() ? diffText : '（无差异内容）'}
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
