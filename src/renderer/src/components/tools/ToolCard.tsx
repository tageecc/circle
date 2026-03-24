import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Server, Code, Eye, Trash2 } from 'lucide-react'
import type { Tool } from './types'

interface ToolCardProps {
  tool: Tool
  onViewDetails: () => void
  onDelete?: () => void
}

export function ToolCard({ tool, onViewDetails, onDelete }: ToolCardProps) {
  const sourceIcon = {
    mcp: <Server className="size-4 text-blue-500" />,
    custom: <Code className="size-4 text-purple-500" />
  }[tool.source]

  const sourceLabel = {
    mcp: `MCP - ${tool.mcpServerName}`,
    custom: '自定义工具'
  }[tool.source]

  return (
    <Card className="border-border/30 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {sourceIcon}
              <CardTitle className="text-base font-mono truncate">{tool.name}</CardTitle>
            </div>
            <CardDescription className="line-clamp-2 text-xs">{tool.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 text-xs">
              {sourceLabel}
            </Badge>
            {tool.usageStats.totalCalls > 0 && (
              <Badge variant="secondary" className="h-5 text-xs">
                {tool.usageStats.totalCalls} 次
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 hover:bg-accent"
              onClick={onViewDetails}
            >
              <Eye className="size-4" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
