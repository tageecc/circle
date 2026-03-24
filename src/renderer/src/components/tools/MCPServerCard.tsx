import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { Server, Eye, Trash2, Loader2 } from 'lucide-react'
import type { MCPServer } from './types'

interface MCPServerCardProps {
  server: MCPServer
  onViewDetails: () => void
  onDelete: () => void
}

function ToolsList({ tools, serverId }: { tools: string[]; serverId: string }) {
  if (tools.length === 0) return null

  const displayTools = tools.slice(0, 3)
  const remainingCount = tools.length - 3

  return (
    <div className="flex flex-wrap gap-1">
      {displayTools.map((tool, idx) => (
        <TooltipProvider key={`${serverId}-${tool}-${idx}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block max-w-full overflow-hidden">
                <Badge
                  variant="secondary"
                  className="text-xs font-mono cursor-help overflow-hidden text-ellipsis whitespace-nowrap max-w-full inline-block"
                >
                  {tool}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-mono break-all">{tool}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {remainingCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs font-mono cursor-help shrink-0">
                +{remainingCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <div className="flex flex-wrap gap-1">
                {tools.map((tool, idx) => (
                  <Badge
                    key={`${serverId}-all-${tool}-${idx}`}
                    variant="outline"
                    className="text-xs font-mono break-all"
                  >
                    {tool}
                  </Badge>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

function StatusIndicator({ status, error }: { status: MCPServer['status']; error?: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {status === 'loading' ? (
              <Loader2 className="size-3 animate-spin text-blue-500" />
            ) : status === 'connected' ? (
              <div className="relative">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <div className="absolute inset-0 size-2 rounded-full bg-green-500 animate-ping" />
              </div>
            ) : status === 'error' ? (
              <div className="size-2 rounded-full bg-red-500" />
            ) : (
              <div className="size-2 rounded-full bg-gray-400" />
            )}
            <span className="text-xs text-muted-foreground">
              {status === 'connected'
                ? '已连接'
                : status === 'loading'
                  ? '连接中'
                  : status === 'error'
                    ? '错误'
                    : '未连接'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {status === 'error' && error ? (
            <p className="max-w-xs text-xs">{error}</p>
          ) : (
            <p className="max-w-xs text-xs">
              {status === 'connected'
                ? '服务器已连接'
                : status === 'loading'
                  ? '正在连接服务器'
                  : status === 'error'
                    ? '连接出错'
                    : '服务器未连接'}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function MCPServerCard({ server, onViewDetails, onDelete }: MCPServerCardProps) {
  return (
    <Card className="border-border/30 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start gap-2.5">
          <Server className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">{server.name}</CardTitle>
            {server.description && (
              <CardDescription className="line-clamp-2 text-xs mt-1.5">
                {server.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {server.tools && server.tools.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {server.tools.length} 个工具
            </span>
            <ToolsList tools={server.tools} serverId={server.id} />
          </div>
        )}
        <div className="flex items-center gap-2 pt-3 border-t border-border/30">
          <StatusIndicator status={server.status} error={server.error} />
          <div className="flex gap-1 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={(e) => {
                e.stopPropagation()
                onViewDetails()
              }}
            >
              <Eye className="size-3.5" />
              查看
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
