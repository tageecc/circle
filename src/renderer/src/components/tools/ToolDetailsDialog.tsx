import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import type { Tool } from './types'

interface ToolDetailsDialogProps {
  tool: Tool | null
  onClose: () => void
}

export function ToolDetailsDialog({ tool, onClose }: ToolDetailsDialogProps) {
  return (
    <Dialog open={!!tool} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>工具详情</DialogTitle>
        </DialogHeader>
        {tool && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">基本信息</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-sm font-medium min-w-20">名称:</span>
                  <span className="text-sm font-mono">{tool.name}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-sm font-medium min-w-20">描述:</span>
                  <span className="text-sm text-muted-foreground">{tool.description || '无'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">使用统计</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold">{tool.usageStats.totalCalls}</div>
                  <div className="text-xs text-muted-foreground">总调用次数</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-green-500">
                    {tool.usageStats.successCalls}
                  </div>
                  <div className="text-xs text-muted-foreground">成功次数</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold text-red-500">
                    {tool.usageStats.failedCalls}
                  </div>
                  <div className="text-xs text-muted-foreground">失败次数</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-2xl font-bold">{tool.usageStats.avgExecutionTime}ms</div>
                  <div className="text-xs text-muted-foreground">平均耗时</div>
                </div>
              </div>
            </div>

            {tool.parameters && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">参数定义</h3>
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
