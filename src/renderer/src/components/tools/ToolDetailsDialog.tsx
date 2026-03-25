import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import type { Tool } from './types'

interface ToolDetailsDialogProps {
  tool: Tool | null
  onClose: () => void
}

export function ToolDetailsDialog({ tool, onClose }: ToolDetailsDialogProps) {
  const { t } = useTranslation('tools')

  return (
    <Dialog open={!!tool} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('toolDetailsDialog.title')}</DialogTitle>
        </DialogHeader>
        {tool && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {t('toolDetailsDialog.basicInfo')}
              </h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-sm font-medium min-w-20">
                    {t('toolDetailsDialog.name')}:
                  </span>
                  <span className="text-sm font-mono">{tool.name}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-sm font-medium min-w-20">
                    {t('toolDetailsDialog.description')}:
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tool.description || t('toolDetailsDialog.none')}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {t('toolDetailsDialog.usageStats')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold">{tool.usageStats.totalCalls}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('toolDetailsDialog.totalCalls')}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-green-500">
                    {tool.usageStats.successCalls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('toolDetailsDialog.successCalls')}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-red-500">
                    {tool.usageStats.failedCalls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('toolDetailsDialog.failedCalls')}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold">{tool.usageStats.avgExecutionTime}ms</div>
                  <div className="text-xs text-muted-foreground">
                    {t('toolDetailsDialog.avgExecutionTime')}
                  </div>
                </div>
              </div>
            </div>

            {tool.parameters && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('toolDetailsDialog.parameters')}
                </h3>
                <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(tool.parameters, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
