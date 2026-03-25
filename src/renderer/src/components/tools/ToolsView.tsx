import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Server, Code, Search, Plus } from 'lucide-react'
import { EmptyState } from '../shared/EmptyState'
import { toast } from 'sonner'
import type { Tool, MCPServer } from './types'
import { ToolCard } from './ToolCard'
import { MCPServerCard } from './MCPServerCard'
import { ToolDetailsDialog } from './ToolDetailsDialog'
import { MCPServerDetailsDialog } from './MCPServerDetailsDialog'
import { CreateMCPServerDialog } from './CreateMCPServerDialog'
import { CreateCustomToolDialog } from './CreateCustomToolDialog'
import { DeleteMCPServerDialog } from './DeleteMCPServerDialog'

export function ToolsView() {
  const { t } = useTranslation('tools')
  const [activeTab, setActiveTab] = useState('mcp')
  const [searchQuery, setSearchQuery] = useState('')
  const [tools, setTools] = useState<Tool[]>([])
  const [mcpServers, setMCPServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)

  // MCP Server 相关
  const [createMCPDialogOpen, setCreateMCPDialogOpen] = useState(false)
  const [mcpServerToDelete, setMCPServerToDelete] = useState<MCPServer | null>(null)
  const [mcpFormData, setMCPFormData] = useState({
    name: '',
    description: '',
    config: ''
  })

  // Custom Tool 相关
  const [createCustomToolOpen, setCreateCustomToolOpen] = useState(false)
  const defaultFormData = useMemo(
    () => ({
      name: '',
      description: '',
      category: 'Utility',
      parameters: `{
  "type": "object",
  "properties": {
    "input": {
      "type": "string",
      "description": "${t('customTool.sampleParamDescription')}"
    }
  },
  "required": ["input"]
}`,
      code: `// 参数通过 params 对象传入
const { input } = params

// 执行你的逻辑
const result = input.toUpperCase()

// 返回结果
return result`
    }),
    [t]
  )
  const [customToolFormData, setCustomToolFormData] = useState(defaultFormData)

  // Tool 详情
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [selectedMCPServer, setSelectedMCPServer] = useState<MCPServer | null>(null)

  useEffect(() => {
    loadData()

    // 定时刷新 MCP Server 状态
    const interval = setInterval(() => {
      loadData(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      const [allTools, servers] = await Promise.all([
        window.api.tools.getAll(),
        window.api.mcp.getAll()
      ])

      setTools(allTools)
      setMCPServers(servers)
    } catch (error) {
      console.error('Failed to load data:', error)
      if (!silent) {
        toast.error(t('toast.loadFailed'))
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // MCP Server 操作
  const handleCreateMCPServer = async () => {
    try {
      if (!mcpFormData.name.trim()) {
        toast.error(t('toast.enterMcpName'))
        return
      }

      let configJson
      try {
        const parsed = JSON.parse(mcpFormData.config)
        const firstKey = Object.keys(parsed.mcpServers || {})[0]
        if (!firstKey) {
          toast.error(t('toast.jsonMissingMcpServers'))
          return
        }
        configJson = parsed.mcpServers[firstKey]
      } catch {
        toast.error(t('toast.jsonInvalid'))
        return
      }

      const serverName = mcpFormData.name

      await window.api.mcp.create({
        name: serverName,
        description: mcpFormData.description,
        config: configJson
      })

      toast.success(t('toast.mcpCreateSuccess'))
      setCreateMCPDialogOpen(false)
      setMCPFormData({ name: '', description: '', config: '' })

      // 等待连接并自动导入工具
      const maxRetries = 10
      let retries = 0

      const checkAndImport = async () => {
        const servers = await window.api.mcp.getAll()
        const newServer = servers.find((s) => s.name === serverName)

        if (newServer && newServer.status === 'connected') {
          try {
            await window.api.tools.importFromMCP(newServer.id)
            await loadData()
          } catch (error) {
            console.error('Failed to import tools:', error)
            toast.error(t('toast.importToolsFailed'))
          }
        } else if (retries < maxRetries) {
          retries++
          setTimeout(checkAndImport, 500)
        } else {
          await loadData()
        }
      }

      setTimeout(checkAndImport, 500)
    } catch (error: any) {
      console.error('Failed to create MCP server:', error)
      toast.error(error.message || t('toast.createFailed'))
    }
  }

  const handleDeleteMCPServer = async () => {
    if (!mcpServerToDelete) return

    try {
      await window.api.mcp.delete(mcpServerToDelete.id)
      toast.success(t('toast.mcpDeleted'))
      setMCPServerToDelete(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete MCP server:', error)
      toast.error(t('toast.deleteFailed'))
    }
  }

  // Custom Tool 操作
  const handleCreateCustomTool = async () => {
    try {
      if (!customToolFormData.name.trim()) {
        toast.error(t('toast.enterToolName'))
        return
      }

      if (!customToolFormData.code.trim()) {
        toast.error(t('toast.enterToolCode'))
        return
      }

      let parameters
      try {
        parameters = JSON.parse(customToolFormData.parameters)
      } catch {
        toast.error(t('toast.parametersJsonInvalid'))
        return
      }

      await window.api.tools.createCustom({
        name: customToolFormData.name,
        description: customToolFormData.description,
        category: customToolFormData.category || 'Utility',
        parameters,
        code: customToolFormData.code
      })

      toast.success(t('toast.customToolCreateSuccess'))
      setCreateCustomToolOpen(false)
      setCustomToolFormData(defaultFormData)
      loadData()
    } catch (error: any) {
      console.error('Failed to create custom tool:', error)
      toast.error(error.message || t('toast.createFailed'))
    }
  }

  const handleDeleteTool = async (toolId: string) => {
    try {
      await window.api.tools.delete(toolId)
      toast.success(t('toast.toolDeleted'))
      loadData()
    } catch (error) {
      console.error('Failed to delete tool:', error)
      toast.error(t('toast.deleteFailed'))
    }
  }

  // 过滤工具
  const filteredTools = tools.filter((tool) => {
    // Tab 过滤
    if (activeTab !== 'all' && tool.source !== activeTab) {
      return false
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query) ||
        tool.mcpServerName?.toLowerCase().includes(query)
      )
    }

    return true
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{t('view.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border/30 bg-card px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('view.pageTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t('view.pageSubtitle')}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('view.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="mcp" className="gap-2">
              <Server className="size-4" />
              {t('view.tabMcp', { count: mcpServers.length })}
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Code className="size-4" />
              {t('view.tabCustom', {
                count: tools.filter((tool) => tool.source === 'custom').length
              })}
            </TabsTrigger>
          </TabsList>

          {/* MCP Server Tab */}
          <TabsContent value="mcp" className="flex-1 overflow-y-auto m-0">
            <Card className="border-border/30 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{t('view.mcpServersTitle')}</CardTitle>
                    <CardDescription className="mt-1">
                      {t('view.mcpServersDescription')}
                    </CardDescription>
                  </div>
                  <Button onClick={() => setCreateMCPDialogOpen(true)} className="gap-2">
                    <Plus className="size-4" />
                    {t('view.addMcpServer')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {mcpServers.length === 0 ? (
                  <EmptyState
                    icon={Server}
                    title={t('view.emptyMcpTitle')}
                    description={t('view.emptyMcpDescription')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {mcpServers.map((server) => (
                      <MCPServerCard
                        key={server.id}
                        server={server}
                        onViewDetails={() => setSelectedMCPServer(server)}
                        onDelete={() => setMCPServerToDelete(server)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom Tools Tab */}
          <TabsContent value="custom" className="flex-1 overflow-y-auto m-0">
            <Card className="border-border/30 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{t('view.customToolsTitle')}</CardTitle>
                    <CardDescription className="mt-1">
                      {t('view.customToolsDescription')}
                    </CardDescription>
                  </div>
                  <Button onClick={() => setCreateCustomToolOpen(true)} className="gap-2">
                    <Plus className="size-4" />
                    {t('view.newCustomTool')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredTools.length === 0 ? (
                  <EmptyState
                    icon={Code}
                    title={t('view.emptyCustomTitle')}
                    description={t('view.emptyCustomDescription')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onViewDetails={() => setSelectedTool(tool)}
                        onDelete={() => handleDeleteTool(tool.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CreateMCPServerDialog
        open={createMCPDialogOpen}
        onOpenChange={setCreateMCPDialogOpen}
        formData={mcpFormData}
        onFormDataChange={setMCPFormData}
        onSubmit={handleCreateMCPServer}
      />

      <CreateCustomToolDialog
        open={createCustomToolOpen}
        onOpenChange={(open) => {
          setCreateCustomToolOpen(open)
          if (!open) {
            // 关闭时重置表单
            setTimeout(() => setCustomToolFormData(defaultFormData), 300)
          }
        }}
        formData={customToolFormData}
        onFormDataChange={setCustomToolFormData}
        onSubmit={handleCreateCustomTool}
      />

      <ToolDetailsDialog tool={selectedTool} onClose={() => setSelectedTool(null)} />

      <MCPServerDetailsDialog
        server={selectedMCPServer}
        onClose={() => setSelectedMCPServer(null)}
      />

      <DeleteMCPServerDialog
        server={mcpServerToDelete}
        onClose={() => setMCPServerToDelete(null)}
        onConfirm={handleDeleteMCPServer}
      />
    </div>
  )
}
