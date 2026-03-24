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
        // JSON 解析失败，只更新 config
      }
    }

    onFormDataChange({ ...formData, ...updates })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加 MCP Server</DialogTitle>
          <DialogDescription>配置 MCP Server 以导入工具</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="mcp-config">配置 JSON</Label>
            <Textarea
              id="mcp-config"
              placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]\n    }\n  }\n}`}
              value={formData.config}
              onChange={(e) => handleConfigChange(e.target.value)}
              className="font-mono text-sm h-48 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              粘贴 MCP Server 配置，名称和描述将自动填充
            </p>
          </div>

          <div>
            <Label htmlFor="mcp-name">名称</Label>
            <Input
              id="mcp-name"
              className="mt-2"
              placeholder="例如: filesystem"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="mcp-description">描述（可选）</Label>
            <Input
              id="mcp-description"
              className="mt-2"
              placeholder="简要描述此 MCP Server"
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit}>
            <Plus className="size-4 mr-2" />
            添加
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
