import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

export interface GitHistoryEntry {
  hash: string
  author: string
  date: string
  message: string
}

interface GitFileHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceRoot: string
  filePath: string
  fileLabel?: string
}

export function GitFileHistoryDialog({
  open,
  onOpenChange,
  workspaceRoot,
  filePath,
  fileLabel
}: GitFileHistoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<GitHistoryEntry[]>([])

  useEffect(() => {
    if (!open || !workspaceRoot || !filePath) return
    let cancelled = false
    setLoading(true)
    window.api.git
      .getFileHistory(workspaceRoot, filePath, 100)
      .then((rows: GitHistoryEntry[]) => {
        if (!cancelled) setEntries(rows)
      })
      .catch(() => {
        if (!cancelled) setEntries([])
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
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">提交历史 — {label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[min(60vh,480px)]">
          {loading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载历史…
            </div>
          ) : entries.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">该文件暂无提交记录。</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">提交</th>
                  <th className="px-4 py-2 font-medium">作者</th>
                  <th className="px-4 py-2 font-medium">日期</th>
                  <th className="px-4 py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.hash} className="border-b border-border/60 hover:bg-muted/30">
                    <td
                      className="max-w-[120px] truncate px-4 py-2 font-mono text-xs"
                      title={e.hash}
                    >
                      {e.hash.slice(0, 8)}
                    </td>
                    <td className="max-w-[100px] truncate px-4 py-2">{e.author}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {e.date}
                    </td>
                    <td className="px-4 py-2">{e.message}</td>
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
