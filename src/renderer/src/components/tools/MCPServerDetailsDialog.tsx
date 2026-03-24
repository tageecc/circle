import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Badge } from '../ui/badge'
import { Loader2 } from 'lucide-react'
import type { MCPServer } from './types'

interface MCPServerDetailsDialogProps {
  server: MCPServer | null
  onClose: () => void
}

export function MCPServerDetailsDialog({ server, onClose }: MCPServerDetailsDialogProps) {
  return (
    <Dialog open={!!server} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>MCP Server 详情</DialogTitle>
        </DialogHeader>
        {server && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">基本信息</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-sm font-medium min-w-20">名称:</span>
                  <span className="text-sm">{server.name}</span>
                </div>
                {server.description && (
                  <div className="flex gap-2">
                    <span className="text-sm font-medium min-w-20">描述:</span>
                    <span className="text-sm text-muted-foreground">{server.description}</span>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium min-w-20">状态:</span>
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
                    <span className="text-sm">
                      {server.status === 'connected'
                        ? '已连接'
                        : server.status === 'loading'
                          ? '连接中'
                          : server.status === 'error'
                            ? '错误'
                            : '未连接'}
                    </span>
                  </div>
                </div>
                {server.status === 'error' && server.error && (
                  <div className="flex gap-2">
                    <span className="text-sm font-medium min-w-20">错误:</span>
                    <span className="text-sm text-red-500">{server.error}</span>
                  </div>
                )}
              </div>
            </div>

            {server.tools.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  可用工具 ({server.tools.length})
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
              <h3 className="text-sm font-medium text-muted-foreground mb-2">配置</h3>
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
