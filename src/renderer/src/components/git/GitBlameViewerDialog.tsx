import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface GitBlameLine {
  line: number
  commit: string
  author: string
  summary: string
}

interface GitBlameViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceRoot: string
  filePath: string
  fileLabel?: string
}

export function GitBlameViewerDialog({
  open,
  onOpenChange,
  workspaceRoot,
  filePath,
  fileLabel
}: GitBlameViewerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState<GitBlameLine[]>([])

  useEffect(() => {
    if (!open || !workspaceRoot || !filePath) return
    let cancelled = false
    setLoading(true)
    window.api.git
      .getBlame(workspaceRoot, filePath)
      .then((info: { lines: GitBlameLine[] }) => {
        if (!cancelled) setLines(info.lines || [])
      })
      .catch(() => {
        if (!cancelled) setLines([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceRoot, filePath])

  const label = fileLabel || filePath.split('/').pop() || filePath

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">Blame — {label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[min(65vh,560px)]">
          {loading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载 Blame…
            </div>
          ) : lines.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">无法获取该文件的 Blame 信息。</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="w-12 px-3 py-2 font-medium">行</th>
                  <th className="w-24 px-3 py-2 font-medium">提交</th>
                  <th className="w-28 px-3 py-2 font-medium">作者</th>
                  <th className="px-3 py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row) => (
                  <tr key={`${row.commit}-${row.line}`} className="border-b border-border/40">
                    <td className="px-3 py-1 font-mono text-muted-foreground">{row.line}</td>
                    <td className="truncate px-3 py-1 font-mono" title={row.commit}>
                      {row.commit.slice(0, 7)}
                    </td>
                    <td className="truncate px-3 py-1">{row.author}</td>
                    <td className="px-3 py-1">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
