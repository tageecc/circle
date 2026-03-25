import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Badge } from '../ui/badge'
import { Loader2 } from 'lucide-react'
import type { MCPServer } from './types'

interface MCPServerDetailsDialogProps {
  server: MCPServer | null
  onClose: () => void
}

function statusLabelFor(server: MCPServer, t: (key: string) => string) {
  if (server.status === 'connected') return t('mcp.status.connected')
  if (server.status === 'loading') return t('mcp.status.connecting')
  if (server.status === 'error') return t('mcp.status.error')
  return t('mcp.status.disconnected')
}

export function MCPServerDetailsDialog({ server, onClose }: MCPServerDetailsDialogProps) {
  const { t } = useTranslation('tools')

  return (
    <Dialog open={!!server} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('mcpDetailsDialog.title')}</DialogTitle>
        </DialogHeader>
        {server && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {t('mcpDetailsDialog.basicInfo')}
              </h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-sm font-medium min-w-20">
                    {t('mcpDetailsDialog.name')}:
                  </span>
                  <span className="text-sm">{server.name}</span>
                </div>
                {server.description && (
                  <div className="flex gap-2">
                    <span className="text-sm font-medium min-w-20">
                      {t('mcpDetailsDialog.description')}:
                    </span>
                    <span className="text-sm text-muted-foreground">{server.description}</span>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium min-w-20">
                    {t('mcpDetailsDialog.status')}:
                  </span>
                  <div className="flex items-center gap-2">
                    {server.status === 'loading' ? (
                      <Loader2 className="size-3 animate-spin text-blue-500" />
                    ) : server.status === 'connected' ? (
                      <div className="relative">
                        <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                        <div className="absolute inset-0 size-2 rounded-full bg-green-500 animate-ping" />
                      </div>
                    ) : server.status === 'error' ? (
                      <div className="size-2 rounded-full bg-red-500" />
                    ) : (
                      <div className="size-2 rounded-full bg-gray-400" />
                    )}
                    <span className="text-sm">{statusLabelFor(server, t)}</span>
                  </div>
                </div>
                {server.status === 'error' && server.error && (
                  <div className="flex gap-2">
                    <span className="text-sm font-medium min-w-20">
                      {t('mcpDetailsDialog.error')}:
                    </span>
                    <span className="text-sm text-red-500">{server.error}</span>
                  </div>
                )}
              </div>
            </div>

            {server.tools.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('mcpDetailsDialog.availableTools', { count: server.tools.length })}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {server.tools.map((tool) => (
                    <Badge key={tool} variant="outline" className="font-mono">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {t('mcpDetailsDialog.config')}
              </h3>
              <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
                {JSON.stringify(server.config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
