import { ScrollArea } from '../ui/scroll-area'
import { Badge } from '../ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '../ui/context-menu'
import { ProviderSelect } from '../select/ProviderSelect'
import { ModelSelect } from '../select/ModelSelect'
import { Bot, Cloud, Code, Database, Sparkles, Plus, Trash2, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface Agent {
  id: string
  name: string
  description: string
  model: string
  provider: string
  icon: React.ComponentType<{ className?: string }>
  tools: number
  avatar?: string // 头像：可以是 Base64 数据或 URL
  isSystem?: boolean // 是否为系统 Agent
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Cloud,
  Code,
  Database,
  Bot
}

interface AgentListProps {
  selectedAgent?: string
  onAgentSelect?: (agentId: string) => void
}

export function AgentList({ selectedAgent, onAgentSelect }: AgentListProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model: 'alibaba-cn/qwen3-max',
    provider: 'Alibaba',
    instructions: '',
    temperature: 7,
    maxTokens: 2048
  })

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
      const data = await window.api.agents.getAll()

      // 加载每个 agent 的头像
      const mappedAgents: Agent[] = await Promise.all(
        data.map(async (agent: any) => {
          let avatarData: string | undefined

          // 如果 metadata.avatar 存在
          if (agent.metadata?.avatar) {
            // 判断是 URL 还是文件名
            if (
              agent.metadata.avatar.startsWith('http://') ||
              agent.metadata.avatar.startsWith('https://')
            ) {
              // 是 URL，直接使用
              avatarData = agent.metadata.avatar
            } else {
              // 是文件名，加载为 Base64
              try {
                avatarData = await window.api.avatar.readAsBase64(agent.metadata.avatar)
              } catch (error) {
                console.error('Failed to load avatar for agent:', agent.id, error)
              }
            }
          }

          return {
            id: agent.id,
            name: agent.name,
            description: agent.description || '',
            model: agent.model,
            provider: agent.provider,
            icon: iconMap[agent.metadata?.icon] || Bot,
            tools: Array.isArray(agent.tools) ? agent.tools.length : 0,
            avatar: avatarData,
            isSystem: agent.metadata?.isSystem || false
          }
        })
      )

      setAgents(mappedAgents)
    } catch (error) {
      console.error('Failed to load agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      // 导入 provider logo 工具函数
      const { getProviderLogo } = await import('@/lib/provider-logos')

      // 获取提供商的 logo URL 作为默认头像
      const providerLogoUrl = getProviderLogo(formData.provider)

      await window.api.agents.create({
        name: formData.name,
        description: formData.description,
        model: formData.model,
        provider: formData.provider,
        instructions: formData.instructions,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        tools: [],
        metadata: {
          icon: 'Bot',
          avatar: providerLogoUrl // 默认使用提供商的 logo URL
        }
      })
      setCreateDialogOpen(false)
      setFormData({
        name: '',
        description: '',
        model: 'alibaba-cn/qwen3-max',
        provider: 'Alibaba',
        instructions: '',
        temperature: 7,
        maxTokens: 2048
      })
      loadAgents()
    } catch (error) {
      console.error('Failed to create agent:', error)
      alert('创建失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const handleDelete = async () => {
    if (!deletingAgent) return

    try {
      await window.api.agents.delete(deletingAgent.id)
      setDeleteDialogOpen(false)
      setDeletingAgent(null)
      loadAgents()
    } catch (error) {
      console.error('Failed to delete agent:', error)
      alert('删除失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading agents...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col border-r border-sidebar-border/50 bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border/50 px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-tight">Agents</h2>
          <Badge variant="secondary" className="h-5 px-2 text-xs">
            {agents.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
          className="h-8 gap-1.5 hover:bg-sidebar-accent"
          variant="ghost"
        >
          <Plus className="size-4" />
          新建
        </Button>
      </div>

      {/* Agent List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-3">
          {agents.map((agent) => {
            const Icon = agent.icon
            return (
              <ContextMenu key={agent.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      'group cursor-pointer rounded-md p-3 transition-all hover:bg-sidebar-accent',
                      selectedAgent === agent.id && 'bg-sidebar-accent shadow-sm'
                    )}
                    onClick={() => onAgentSelect?.(agent.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-11 shadow-sm">
                        {agent.avatar ? <AvatarImage src={agent.avatar} alt={agent.name} /> : null}
                        <AvatarFallback className="bg-primary/10 border border-primary/20">
                          <Icon className="size-5 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold leading-none">{agent.name}</h3>
                          {agent.isSystem && (
                            <Badge variant="default" className="h-4 text-[10px] px-1.5">
                              系统
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <Badge
                            variant="outline"
                            className="h-5 text-[10px] border-primary/20 text-primary"
                          >
                            <Sparkles className="mr-1 size-2.5" />
                            {agent.provider}
                          </Badge>
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {agent.tools} tools
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  {!agent.isSystem && (
                    <ContextMenuItem onClick={() => onAgentSelect?.(agent.id)}>
                      <Edit className="mr-2 size-4" />
                      编辑
                    </ContextMenuItem>
                  )}
                  {!agent.isSystem && (
                    <ContextMenuItem
                      onClick={() => {
                        setDeletingAgent(agent)
                        setDeleteDialogOpen(true)
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      删除
                    </ContextMenuItem>
                  )}
                  {agent.isSystem && (
                    <ContextMenuItem disabled>系统 Agent 无法编辑或删除</ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      </ScrollArea>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建 Agent</DialogTitle>
            <DialogDescription>创建一个新的 AI Agent</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">名称 *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如: Weather Agent"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">描述</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简短描述这个 Agent 的功能"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">提供商 *</label>
              <ProviderSelect
                value={formData.provider}
                onChange={(value) => setFormData({ ...formData, provider: value })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">模型 *</label>
              <ModelSelect
                provider={formData.provider}
                value={formData.model}
                onChange={(value) => setFormData({ ...formData, model: value })}
              />
              <p className="text-xs text-muted-foreground">或手动输入:</p>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="自定义模型名称..."
                className="h-8"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">系统提示词 *</label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="You are a helpful AI assistant..."
                className="min-h-32"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">温度 (0-10)</label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData({ ...formData, temperature: parseInt(e.target.value) || 7 })
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">最大 Tokens</label>
                <Input
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) =>
                    setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 2048 })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || !formData.model}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 Agent "{deletingAgent?.name}" 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
