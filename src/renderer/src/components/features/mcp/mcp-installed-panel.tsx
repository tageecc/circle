import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Power, RefreshCw, Key, Package, Plus, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useMCPStore } from '@/stores/mcp.store'
import { useFileStore, getTabId } from '@/stores/file.store'
import { cn } from '@/lib/utils'
import type { MCPServer, MCPTool } from '@/types/mcp'
import { parseConfigJson } from '@/utils/mcp-helpers'

export function MCPInstalledPanel() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [serverTools, setServerTools] = useState<Record<string, MCPTool[]>>({})
  const [needsAuthMap, setNeedsAuthMap] = useState<Record<string, boolean>>({})
  const [openAddDialog, setOpenAddDialog] = useState(false)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [configJson, setConfigJson] = useState('')
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const {
    loadInstalledServers,
    connectionStates,
    setConnectionStatus,
    initConnectionStates,
    removeConnectionStatus,
    batchAddServers
  } = useMCPStore()
  const { openFiles, addFile, setActiveFile, activeFile } = useFileStore()

  const loadServers = async () => {
    setLoading(true)
    try {
      const data = await window.api.mcp.getAllServers()
      setServers(data)

      // 使用 zustand 初始化连接状态
      await initConnectionStates(data.map((s) => s.id))

      // 加载所有工具
      try {
        const allTools = await window.api.mcp.listAllTools()
        const tools: Record<string, MCPTool[]> = {}
        allTools.forEach((tool: any) => {
          if (!tools[tool.serverId]) {
            tools[tool.serverId] = []
          }
          tools[tool.serverId].push({
            name: tool.name,
            description: tool.description
          })
        })
        setServerTools(tools)
      } catch (error) {
        console.error('加载工具失败:', error)
      }
    } catch (error) {
      console.error('加载 MCP 服务失败:', error)
      toast.error(t('mcp.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServers()
  }, [])

  const handleAuth = async (serverId: string, serverName: string) => {
    try {
      const success = await window.api.mcp.startAuth(serverId)

      if (success) {
        toast.success(t('mcp.auth_success', { name: serverName }))
        setNeedsAuthMap((prev) => ({ ...prev, [serverId]: false }))
        // 授权成功后自动连接
        await handleConnect(serverId)
      } else {
        toast.error(t('mcp.auth_failed_name', { name: serverName }))
      }
    } catch (error) {
      console.error('[MCP UI] Auth failed:', error)
      toast.error(
        t('mcp.auth_failed_message', {
          message: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  const handleConnect = async (serverId: string) => {
    setConnectionStatus(serverId, 'connecting')

    try {
      const server = servers.find((s) => s.id === serverId)
      if (!server) return

      const result = await window.api.mcp.connect(serverId, server.configJson)

      if (result.requiresAuth) {
        setNeedsAuthMap((prev) => ({ ...prev, [serverId]: true }))
        setConnectionStatus(serverId, 'disconnected')
        return
      }

      if (result.success) {
        setConnectionStatus(serverId, 'connected')
        // 重新加载工具列表
        const allTools = await window.api.mcp.listAllTools()
        const tools = allTools.filter((tool: any) => tool.serverId === serverId)
        setServerTools((prev) => ({
          ...prev,
          [serverId]: tools.map((t: any) => ({ name: t.name, description: t.description }))
        }))
        toast.success(t('mcp.connect_success'))
      } else {
        setConnectionStatus(serverId, 'error')
        toast.error(t('mcp.connect_failed'))
      }
    } catch (error: any) {
      setConnectionStatus(serverId, 'error')
      toast.error(t('mcp.connect_failed'))
    }
  }

  const handleDisconnect = async (serverId: string) => {
    // 设置为 connecting 状态以显示 loading
    setConnectionStatus(serverId, 'connecting')

    try {
      await window.api.mcp.disconnect(serverId)
      setConnectionStatus(serverId, 'disconnected')
      setServerTools((prev) => {
        const { [serverId]: _, ...rest } = prev
        return rest
      })
      toast.success(t('mcp.disconnect_success'))
    } catch (error) {
      setConnectionStatus(serverId, 'error')
      toast.error(t('mcp.disconnect_failed'))
    }
  }

  const handleDelete = async (serverId: string, serverName: string) => {
    try {
      await window.api.mcp.deleteServer(serverId)
      removeConnectionStatus(serverId) // 清理连接状态
      await loadServers()
      await loadInstalledServers()
      toast.success(t('mcp.delete_success_name', { name: serverName }))
    } catch (error) {
      toast.error(t('mcp.delete_failed'))
    }
  }

  // 统一的粘贴处理：只负责验证和显示，不执行添加操作
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text')
    const result = parseConfigJson(pastedText)
    if (result) {
      e.preventDefault()
      // 保持原格式，确保重新解析时能正确识别服务器名称
      setConfigJson(pastedText)
    }
  }

  const handleAddServer = async () => {
    if (!configJson.trim()) {
      toast.error(t('mcp.enter_config_json'))
      return
    }

    const parseResult = parseConfigJson(configJson)
    if (!parseResult) {
      toast.error(t('mcp.invalid_config_json'))
      return
    }

    // 多个服务器：批量添加
    if ('servers' in parseResult) {
      const { successCount, failCount } = await batchAddServers(parseResult.servers)
      if (successCount > 0) {
        toast.success(
          failCount > 0
            ? t('mcp.batch_add_partial', { success: successCount, fail: failCount })
            : t('mcp.batch_add_success', { count: successCount })
        )
        setOpenAddDialog(false)
        setConfigJson('')
        await loadServers()
      } else {
        toast.error(t('mcp.add_all_failed'))
      }
      return
    }

    // 单个服务器：直接添加
    const { config, serverName } = parseResult
    try {
      await window.api.mcp.addServer({ name: serverName, configJson: config })
      toast.success(t('mcp.server_added', { name: serverName }))
      setOpenAddDialog(false)
      setConfigJson('')
      await loadInstalledServers()
      await loadServers()
    } catch (error) {
      console.error('Failed to add MCP server:', error)
      toast.error(
        t('mcp.add_failed_message', {
          message: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server)
    setConfigJson(JSON.stringify(server.configJson, null, 2))
    setOpenEditDialog(true)
  }

  const handleUpdateServer = async () => {
    if (!editingServer || !configJson.trim()) {
      toast.error(t('mcp.config_empty'))
      return
    }

    const parseResult = parseConfigJson(configJson)
    if (!parseResult) {
      toast.error(t('mcp.invalid_config_json'))
      return
    }

    // 多个服务器：批量添加（而非更新）
    if ('servers' in parseResult) {
      const { successCount, failCount } = await batchAddServers(parseResult.servers)
      if (successCount > 0) {
        toast.success(
          failCount > 0
            ? t('mcp.batch_add_partial', { success: successCount, fail: failCount })
            : t('mcp.batch_add_success', { count: successCount })
        )
        setOpenEditDialog(false)
        setEditingServer(null)
        setConfigJson('')
        await loadServers()
      } else {
        toast.error(t('mcp.add_all_failed'))
      }
      return
    }

    // 单个服务器：更新当前服务器
    const { config, serverName } = parseResult
    try {
      await window.api.mcp.updateServer(editingServer.id, serverName, config)
      toast.success(t('mcp.server_updated', { name: serverName }))
      setOpenEditDialog(false)
      setEditingServer(null)
      setConfigJson('')
      await loadInstalledServers()
      loadServers()
    } catch (error) {
      console.error('Failed to update MCP server:', error)
      toast.error(
        t('mcp.update_failed_message', {
          message: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  const handleCardClick = (server: MCPServer) => {
    const tools = serverTools[server.id] || []
    const detailPath = `mcp://local/${server.id}`
    const existingFile = openFiles.find((file) => file.path === detailPath)

    if (existingFile) {
      const tabId = getTabId(existingFile)
      setActiveFile(tabId)
    } else {
      addFile({
        path: detailPath,
        name: server.name,
        content: '',
        language: 'markdown',
        isDirty: false,
        isPreview: false,
        encoding: 'utf-8',
        lineEnding: 'LF',
        isMCPDetail: true,
        mcpServerId: server.id,
        mcpUsageCount: tools.length
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Power className="size-12 mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium mb-2">{t('mcp.no_installed_services')}</h3>
        <p className="text-sm text-muted-foreground">{t('mcp.add_services_hint')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground uppercase tracking-wide">
            {t('mcp.installed_services_count', { count: servers.length })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-0.5 hover:bg-accent/50 cursor-pointer"
              onClick={() => setOpenAddDialog(true)}
            >
              <Plus className="size-3.5" />
              <span>{t('mcp.add_button')}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent/50"
              onClick={loadServers}
              disabled={loading}
              title={t('common.refresh')}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* Server List - 复用市场列表样式 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {servers.map((server) => {
          const status = connectionStates.get(server.id) || 'disconnected'
          const tools = serverTools[server.id] || []
          const needsAuth = needsAuthMap[server.id]
          const isStdio = !server.configJson.url
          const detailPath = `mcp://local/${server.id}`
          const isActive = openFiles.some(
            (file) => getTabId(file) === activeFile && file.path === detailPath
          )

          return (
            <div
              key={server.id}
              className={cn(
                'group rounded-lg border transition-all',
                isActive ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
              )}
            >
              <div
                className={cn(
                  'p-3 cursor-pointer transition-colors',
                  isActive ? 'bg-primary/5' : 'hover:bg-accent/30'
                )}
                onClick={() => handleCardClick(server)}
              >
                <div className="flex items-start gap-3">
                  {/* Icon - 使用默认图标 */}
                  <div className="shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                    <Package className="size-5 text-muted-foreground" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {server.name}
                      </h3>

                      {/* 操作按钮 - 右侧 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* 编辑按钮 */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditServer(server)
                          }}
                          title={t('common.edit')}
                        >
                          <Edit className="size-3" />
                        </Button>

                        {/* 删除按钮 */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(server.id, server.name)
                          }}
                          title={t('common.delete')}
                        >
                          <Trash2 className="size-3" />
                        </Button>

                        {/* 授权/连接开关 */}
                        {needsAuth ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAuth(server.id, server.name)
                            }}
                          >
                            <Key className="size-3 mr-1" />
                            {t('mcp.authorize')}
                          </Button>
                        ) : (
                          <div
                            className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={status === 'connected'}
                              loading={status === 'connecting'}
                              disabled={status === 'connecting'}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleConnect(server.id)
                                } else {
                                  handleDisconnect(server.id)
                                }
                              }}
                              className="scale-75"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 状态徽章 - 仅显示特殊状态（授权、错误）和工具数 */}
                    <div className="flex items-center gap-2 mb-2">
                      {needsAuth ? (
                        <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                          <Key className="size-3" />
                          {t('mcp.needs_auth_badge')}
                        </Badge>
                      ) : status === 'error' ? (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          {t('mcp.error_badge')}
                        </Badge>
                      ) : null}

                      {status === 'connected' && tools.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('mcp.tools_count', { count: tools.length })}
                        </span>
                      )}

                      {/* Stdio 服务提示 */}
                      {isStdio && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('mcp.local_badge')}
                        </Badge>
                      )}
                    </div>

                    {/* 服务 URL 或 Command */}
                    {server.configJson.url ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {server.configJson.url}
                      </p>
                    ) : server.configJson.command ? (
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {server.configJson.command} {server.configJson.args?.join(' ')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 添加服务器 Dialog */}
      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t('mcp.dialog_add_title')}</DialogTitle>
            <DialogDescription>{t('mcp.dialog_add_description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="server-config">{t('mcp.config_json_label')}</Label>
              <Textarea
                id="server-config"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                onPaste={handlePaste}
                placeholder={t('mcp.placeholder_server_config')}
                rows={12}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddServer}>{t('mcp.add_button')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑服务器 Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t('mcp.edit_server_dialog_title')}</DialogTitle>
            <DialogDescription>{t('mcp.edit_server_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-server-config">{t('mcp.config_json_label')}</Label>
              <Textarea
                id="edit-server-config"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                onPaste={handlePaste}
                placeholder={t('mcp.placeholder_edit_server_config')}
                rows={12}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenEditDialog(false)
                setEditingServer(null)
                setConfigJson('')
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateServer}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
