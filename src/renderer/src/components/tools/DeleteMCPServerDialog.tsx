import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import type { MCPServer } from './types'

interface DeleteMCPServerDialogProps {
  server: MCPServer | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteMCPServerDialog({ server, onClose, onConfirm }: DeleteMCPServerDialogProps) {
  return (
    <Dialog open={!!server} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除 MCP Server "{server?.name}" 吗？
            <br />
            <span className="text-red-500">此操作将同时删除该服务器导入的所有工具。</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            删除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
