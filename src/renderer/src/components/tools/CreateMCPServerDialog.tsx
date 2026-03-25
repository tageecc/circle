import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Plus } from 'lucide-react'

interface CreateMCPServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: {
    name: string
    description: string
    config: string
  }
  onFormDataChange: (data: { name: string; description: string; config: string }) => void
  onSubmit: () => void
}

export function CreateMCPServerDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit
}: CreateMCPServerDialogProps) {
  const { t } = useTranslation('tools')
  const { t: tc } = useTranslation('common')

  const handleConfigChange = (config: string) => {
    const updates: Partial<typeof formData> = { config }

    if (!formData.name.trim() || !formData.description.trim()) {
      try {
        const parsed = JSON.parse(config)
        const mcpServers = parsed.mcpServers || {}
        const serverKeys = Object.keys(mcpServers)

        if (serverKeys.length > 0) {
          const firstKey = serverKeys[0]
          const serverConfig = mcpServers[firstKey]

          if (!formData.name.trim()) {
            updates.name = firstKey
          }

          if (!formData.description.trim() && serverConfig.description) {
            updates.description = serverConfig.description
          }
        }
      } catch {
        // JSON parse failed; only config is updated
      }
    }

    onFormDataChange({ ...formData, ...updates })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('mcpCreateDialog.title')}</DialogTitle>
          <DialogDescription>{t('mcpCreateDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="mcp-config">{t('mcpCreateDialog.configJsonLabel')}</Label>
            <Textarea
              id="mcp-config"
              placeholder={t('mcpCreateDialog.configPlaceholder')}
              value={formData.config}
              onChange={(e) => handleConfigChange(e.target.value)}
              className="font-mono text-sm h-48 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('mcpCreateDialog.configHint')}</p>
          </div>

          <div>
            <Label htmlFor="mcp-name">{t('mcpCreateDialog.nameLabel')}</Label>
            <Input
              id="mcp-name"
              className="mt-2"
              placeholder={t('mcpCreateDialog.namePlaceholder')}
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="mcp-description">{t('mcpCreateDialog.descriptionOptional')}</Label>
            <Input
              id="mcp-description"
              className="mt-2"
              placeholder={t('mcpCreateDialog.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('button.cancel')}
          </Button>
          <Button onClick={onSubmit}>
            <Plus className="size-4 mr-2" />
            {tc('button.add')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
