import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import type { MCPServer } from './types'

interface DeleteMCPServerDialogProps {
  server: MCPServer | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteMCPServerDialog({ server, onClose, onConfirm }: DeleteMCPServerDialogProps) {
  const { t } = useTranslation('tools')
  const { t: tc } = useTranslation('common')

  return (
    <Dialog open={!!server} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('mcpDeleteDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('mcp.deleteConfirm', { name: server?.name ?? '' })}
            <br />
            <span className="text-red-500">{t('mcpDeleteDialog.toolsRemovedWarning')}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {tc('button.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {tc('button.delete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
