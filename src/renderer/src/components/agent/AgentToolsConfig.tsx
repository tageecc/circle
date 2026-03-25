import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import {
  Server,
  Plus,
  Search,
  Info,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Code,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface Tool {
  id: string
  name: string
  description: string
  source: 'mcp' | 'custom'
  mcpServerId?: string
  mcpServerName?: string
  status: string
  enabled: boolean
  parameters?: any
  usageStats: {
    totalCalls: number
    successCalls: number
    failedCalls: number
    lastUsedAt: string | null
    avgExecutionTime: number
  }
}

interface MCPServer {
  id: string
  name: string
  status: string
  description?: string
  tools: string[]
}

interface AgentToolsConfigProps {
  agentId: string
  editing: boolean
  selectedTools: string[]
  onToolsChange: (tools: string[]) => void
}

export function AgentToolsConfig({
  agentId,
  editing,
  selectedTools,
  onToolsChange
}: AgentToolsConfigProps) {
  const { t, i18n } = useTranslation('agent')
  const { t: tc } = useTranslation('common')
  const [allTools, setAllTools] = useState<Tool[]>([])
  const [mcpServers, setMCPServers] = useState<MCPServer[]>([])
  const [topTools, setTopTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [showTopTools, setShowTopTools] = useState(false)
  const [openServers, setOpenServers] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadData()
  }, [agentId])

  const loadData = async () => {
    try {
      setLoading(true)

      const [tools, servers, top] = await Promise.all([
        window.api.tools.getAll(agentId),
        window.api.mcp.getAll(),
        window.api.tools.getTop(10, agentId)
      ])

      setAllTools(tools)
      setMCPServers(servers)
      setTopTools(top)
    } catch (error) {
      console.error('Failed to load tools:', error)
    } finally {
      setLoading(false)
    }
  }

  // 按 MCP Server 分组工具
  const toolsByServer = useMemo(() => {
    const grouped: Record<string, { server: MCPServer | null; tools: Tool[] }> = {}

    // MCP 工具按 Server 分组
    for (const tool of allTools) {
      if (tool.source === 'mcp' && tool.mcpServerId) {
        if (!grouped[tool.mcpServerId]) {
          const server = mcpServers.find((s) => s.id === tool.mcpServerId)
          grouped[tool.mcpServerId] = {
            server: server || null,
            tools: []
          }
        }
        grouped[tool.mcpServerId].tools.push(tool)
      }
    }

    // 自定义工具
    const customTools = allTools.filter((t) => t.source === 'custom')
    if (customTools.length > 0) {
      grouped['custom'] = {
        server: null,
        tools: customTools
      }
    }

    return grouped
  }, [allTools, mcpServers])

  // 初始化时展开所有服务器
  useEffect(() => {
    if (Object.keys(toolsByServer).length > 0 && Object.keys(openServers).length === 0) {
      const initialOpen: Record<string, boolean> = {}
      Object.keys(toolsByServer).forEach((key) => {
        initialOpen[key] = true
      })
      setOpenServers(initialOpen)
    }
  }, [toolsByServer, openServers])

  // 搜索过滤
  const filteredToolsByServer = useMemo(() => {
    if (!searchQuery.trim()) return toolsByServer

    const query = searchQuery.toLowerCase()
    const filtered: typeof toolsByServer = {}

    for (const [key, group] of Object.entries(toolsByServer)) {
      const matchedTools = group.tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          tool.mcpServerName?.toLowerCase().includes(query)
      )

      if (matchedTools.length > 0) {
        filtered[key] = {
          ...group,
          tools: matchedTools
        }
      }
    }

    return filtered
  }, [toolsByServer, searchQuery])

  // 处理单个工具选择
  const handleToggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onToolsChange(selectedTools.filter((t) => t !== toolName))
    } else {
      onToolsChange([...selectedTools, toolName])
    }
  }

  // 处理服务器级别全选/取消
  const handleToggleServer = (serverId: string) => {
    const group = toolsByServer[serverId]
    if (!group) return

    const serverToolNames = group.tools.map((t) => t.name)
    const allSelected = serverToolNames.every((name) => selectedTools.includes(name))

    if (allSelected) {
      // 取消全选：移除这个服务器的所有工具
      onToolsChange(selectedTools.filter((name) => !serverToolNames.includes(name)))
    } else {
      // 全选：添加这个服务器的所有工具
      const newTools = [...selectedTools]
      for (const toolName of serverToolNames) {
        if (!newTools.includes(toolName)) {
          newTools.push(toolName)
        }
      }
      onToolsChange(newTools)
    }
  }

  // 快速添加 Top 10 工具
  const handleAddTopTools = () => {
    const topToolNames = topTools.map((t) => t.name)
    const newTools = [...new Set([...selectedTools, ...topToolNames])]
    onToolsChange(newTools)
    setShowTopTools(false)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{t('tools.loading')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const toggleServer = (serverId: string) => {
    setOpenServers((prev) => ({
      ...prev,
      [serverId]: !prev[serverId]
    }))
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">{t('tools.configTitle')}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('tools.selectedCount', { count: selectedTools.length })}
            </p>
          </div>

          {editing && topTools.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowTopTools(true)}>
              <TrendingUp className="size-4 mr-2" />
              {t('tools.quickPick')}
            </Button>
          )}
        </div>

        {/* 搜索框 */}
        {editing && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('tools.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}

        {/* Tools List */}
        <div className="space-y-2">
          {Object.keys(filteredToolsByServer).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
              <Server className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? t('tools.noMatch') : t('tools.noTools')}
              </p>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">{t('tools.gotoMcp')}</p>
              )}
            </div>
          ) : (
            Object.entries(filteredToolsByServer).map(([serverId, group]) => {
              const isCustom = serverId === 'custom'
              const serverName = isCustom
                ? t('tools.customTools')
                : group.server?.name || t('tools.unknownServer')

              const serverStatus = group.server?.status
              const isConnected = serverStatus === 'connected'

              const serverToolNames = group.tools.map((t) => t.name)
              const selectedCount = serverToolNames.filter((name) =>
                selectedTools.includes(name)
              ).length
              const isAllSelected =
                selectedCount === serverToolNames.length && serverToolNames.length > 0
              const isOpen = openServers[serverId] !== false

              return (
                <Collapsible
                  key={serverId}
                  open={isOpen}
                  onOpenChange={() => toggleServer(serverId)}
                  className={cn(
                    'rounded-lg border bg-card',
                    !isConnected && !isCustom && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* 展开/收起按钮 */}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    {/* Server Icon */}
                    <div className="shrink-0">
                      {isCustom ? (
                        <Code className="size-5 text-purple-500" />
                      ) : (
                        <Server className="size-5 text-blue-500" />
                      )}
                    </div>

                    {/* Server Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{serverName}</h4>

                        {/* Status */}
                        {!isCustom && (
                          <div className="flex items-center gap-1.5">
                            {serverStatus === 'loading' ? (
                              <Loader2 className="size-3 animate-spin text-blue-500" />
                            ) : isConnected ? (
                              <div className="relative">
                                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                                <div className="absolute inset-0 size-2 rounded-full bg-green-500 animate-ping" />
                              </div>
                            ) : serverStatus === 'error' ? (
                              <div className="size-2 rounded-full bg-red-500" />
                            ) : (
                              <div className="size-2 rounded-full bg-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('tools.selectedFraction', {
                          selected: selectedCount,
                          total: serverToolNames.length
                        })}
                      </p>
                    </div>

                    {/* 全选按钮 */}
                    {editing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!isConnected && !isCustom}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleServer(serverId)
                        }}
                      >
                        {isAllSelected ? t('tools.deselectAll') : t('tools.selectAll')}
                      </Button>
                    )}
                  </div>

                  {/* Tools List */}
                  <CollapsibleContent>
                    <div className="border-t px-3 py-3 space-y-1.5">
                      {group.tools.map((tool) => {
                        const isSelected = selectedTools.includes(tool.name)
                        const isDisabled = !editing || (!isConnected && !isCustom)

                        return (
                          <div
                            key={tool.id}
                            className={cn(
                              'relative flex items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-150',
                              isSelected
                                ? 'bg-primary/10 border-l-2 border-l-primary pl-2.5'
                                : 'border-l-2 border-l-transparent',
                              !isDisabled && 'cursor-pointer hover:bg-accent',
                              isDisabled && 'opacity-50'
                            )}
                            onClick={() => !isDisabled && handleToggleTool(tool.name)}
                          >
                            {editing && (
                              <Checkbox
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={() => handleToggleTool(tool.name)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}

                            <div className="flex-1 min-w-0">
                              <span
                                className={cn(
                                  'text-sm font-mono truncate block',
                                  isSelected && 'font-semibold text-foreground'
                                )}
                                title={tool.name}
                              >
                                {tool.name}
                              </span>
                            </div>

                            {/* 使用统计 */}
                            {tool.usageStats.totalCalls > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        'text-xs h-5 px-1.5 shrink-0',
                                        isSelected && 'bg-primary/20 text-primary'
                                      )}
                                    >
                                      {tool.usageStats.totalCalls}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <div className="space-y-1 text-xs">
                                      <p className="flex items-center">
                                        <CheckCircle2 className="size-3 mr-1.5 text-green-500" />
                                        {t('tools.statSuccess', {
                                          count: tool.usageStats.successCalls
                                        })}
                                      </p>
                                      <p className="flex items-center">
                                        <XCircle className="size-3 mr-1.5 text-red-500" />
                                        {t('tools.statFailed', {
                                          count: tool.usageStats.failedCalls
                                        })}
                                      </p>
                                      {tool.usageStats.avgExecutionTime > 0 && (
                                        <p className="flex items-center">
                                          <Clock className="size-3 mr-1.5 text-blue-500" />
                                          {t('tools.statAvg', {
                                            ms: tool.usageStats.avgExecutionTime
                                          })}
                                        </p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* 详情按钮 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0 hover:bg-accent"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTool(tool)
                              }}
                            >
                              <Info className="size-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          )}
        </div>
      </div>

      {/* Top 10 快选弹窗 */}
      <Dialog open={showTopTools} onOpenChange={setShowTopTools}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              {t('tools.top10Title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {topTools.map((tool, index) => (
              <div
                key={tool.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  #{index + 1}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium font-mono">{tool.name}</span>
                    <Badge variant="secondary">
                      {t('tools.callsCount', { count: tool.usageStats.totalCalls })}
                    </Badge>
                  </div>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowTopTools(false)}>
              {tc('button.cancel')}
            </Button>
            <Button onClick={handleAddTopTools}>
              <Plus className="size-4 mr-2" />
              {t('tools.addToAgent')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 工具详情弹窗 */}
      <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-5" />
              {t('tools.detailTitle')}
            </DialogTitle>
          </DialogHeader>

          {selectedTool && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('tools.sectionBasic')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-20">{t('tools.fieldName')}</span>
                    <span className="text-sm font-mono">{selectedTool.name}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-20">
                      {t('tools.fieldDescription')}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {selectedTool.description || t('tools.noDescription')}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium min-w-20">{t('tools.fieldSource')}</span>
                    <Badge variant="outline">
                      {selectedTool.source === 'mcp' &&
                        t('tools.sourceMcp', { server: selectedTool.mcpServerName ?? '' })}
                      {selectedTool.source === 'custom' && t('tools.sourceCustom')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 使用统计 */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('tools.sectionStats')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-2xl font-bold">{selectedTool.usageStats.totalCalls}</div>
                    <div className="text-xs text-muted-foreground">{t('tools.totalCalls')}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-2xl font-bold text-green-500">
                      {selectedTool.usageStats.successCalls}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('tools.successCalls')}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-2xl font-bold text-red-500">
                      {selectedTool.usageStats.failedCalls}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('tools.failedCalls')}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-2xl font-bold">
                      {selectedTool.usageStats.avgExecutionTime}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('tools.avgExecutionTime')}
                    </div>
                  </div>
                </div>

                {selectedTool.usageStats.lastUsedAt && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('tools.lastUsed', {
                      time: new Date(selectedTool.usageStats.lastUsedAt).toLocaleString(
                        i18n.language === 'zh-CN' ? 'zh-CN' : undefined
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 参数定义 */}
              {selectedTool.parameters && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    {t('tools.sectionParams')}
                  </h3>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedTool.parameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
