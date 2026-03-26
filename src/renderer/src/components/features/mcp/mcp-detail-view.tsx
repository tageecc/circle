import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  Package,
  Calendar,
  TrendingUp,
  FileText,
  Lock,
  User,
  XCircle,
  Key,
  Trash2,
  Edit
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { useMCPStore } from '@/stores/mcp.store'
import { useMCPEdit } from '@/hooks/use-mcp-edit'
import type { ConnectionStatus, MCPServerDetail } from '@/types/mcp'

interface MCPDetailViewProps {
  serverId: string
  usageCount?: number
}

type TabType = 'readme' | 'tools' | 'scopes' | 'config'

export function MCPDetailView({ serverId, usageCount }: MCPDetailViewProps) {
  const [detail, setDetail] = useState<MCPServerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('readme')
  const [installing, setInstalling] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [isUninstalled, setIsUninstalled] = useState(false)

  const {
    installedServers,
    loadInstalledServers,
    getServerDetail,
    clearDetailCache,
    setConnectionStatus,
    getConnectionStatus,
    removeConnectionStatus
  } = useMCPStore()

  const installedServerId = serverId

  const connectionStatus = installedServerId
    ? getConnectionStatus(installedServerId)
    : 'disconnected'

  // 使用共享的编辑逻辑
  const {
    openEditDialog,
    setOpenEditDialog,
    configJson,
    setConfigJson,
    handleEditServer: openEditDialog_,
    handlePaste,
    handleUpdateServer: updateServer_,
    handleCloseDialog
  } = useMCPEdit(async () => {
    clearDetailCache(`local:${serverId}`)
    await loadDetail()
    await loadInstalledServers()
  })

  const handleEditServer = () => installedServerId && openEditDialog_(installedServerId)
  const handleUpdateServer = () => installedServerId && updateServer_(installedServerId)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cacheKey = `local:${serverId}`

      const detail = await getServerDetail(cacheKey, async () => {
        const servers = await window.api.mcp.getAllServers()
        const server = servers.find((s: any) => s.id === serverId)

        if (!server) {
          throw new Error('服务不存在')
        }

        const cfg = server.configJson as { command?: string; url?: string }
        const summary = cfg.url ?? cfg.command ?? 'MCP'

        const allTools = await window.api.mcp.listAllTools()
        const serverTools = allTools.filter(
          (tool: any) =>
            tool.serverId === serverId ||
            tool.serverId === server.id ||
            tool.serverName === server.name
        )

        return {
          name: server.name,
          displayName: server.name,
          description: `本地 MCP（${summary}）`,
          readme: '暂无说明文档',
          tools: serverTools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          })),
          scopes: []
        }
      })

      setDetail(detail)

      if (!detail.readme && detail.tools && detail.tools.length > 0) {
        setActiveTab('tools')
      }
    } catch (err) {
      console.error('[MCPDetailView] 加载详情失败:', err)
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [serverId, getServerDetail])

  // 加载连接状态和授权状态
  const loadServerStatus = useCallback(async () => {
    if (!installedServerId) {
      setNeedsAuth(false)
      setIsUninstalled(true)
      return
    }

    try {
      // 获取服务器配置，判断服务类型
      const servers = await window.api.mcp.getAllServers()
      const server = servers.find((s) => s.id === installedServerId)

      // 服务不存在，说明已被卸载
      if (!server) {
        setIsUninstalled(true)
        setNeedsAuth(false)
        return
      }

      // 服务存在，标记为未卸载
      setIsUninstalled(false)

      const status = await window.api.mcp.getConnectionStatus(installedServerId)
      setConnectionStatus(installedServerId, status as ConnectionStatus)

      // 判断服务类型：只有 HTTP 类型才可能需要 OAuth 授权
      const isHttpServer = server.configJson.type === 'http' || server.configJson.url

      // Stdio 类型（本地服务）永远不需要 OAuth 授权
      if (!isHttpServer) {
        setNeedsAuth(false)
        // 如果是本地服务且已连接，清除缓存并重新加载详情以获取最新的工具列表
        if (status === 'connected' && serverId) {
          const cacheKey = `local:${serverId}`
          clearDetailCache(cacheKey)
          await loadDetail()
        }
        return
      }

      // HTTP 类型服务：已连接则不需要授权
      if (status === 'connected') {
        setNeedsAuth(false)
      } else {
        // 未连接时，暂时不设置授权状态，等用户点击连接时再判断
        setNeedsAuth(false)
      }
    } catch (error) {
      console.error('[MCPDetailView] 加载服务状态失败:', error)
    }
  }, [installedServerId, serverId, loadDetail, setConnectionStatus])

  // 初始加载（仅首次）
  useEffect(() => {
    loadInstalledServers()
  }, [loadInstalledServers])

  // 加载详情（serverCode 变化时重新加载）
  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  // 加载服务状态（installedServerId 或 installedServers 变化时重新加载）
  useEffect(() => {
    loadServerStatus()
  }, [loadServerStatus])

  // 监听服务列表变化，触发状态重新检查（针对本地服务被卸载的情况）
  useEffect(() => {
    if (serverId && installedServerId) {
      loadServerStatus()
    }
  }, [installedServers, serverId, installedServerId, loadServerStatus])

  const handleUninstall = async () => {
    if (!detail || !installedServerId) return

    setInstalling(true)
    try {
      await window.api.mcp.deleteServer(installedServerId)

      // 清除连接状态和缓存
      removeConnectionStatus(installedServerId)
      clearDetailCache(`local:${installedServerId}`)

      await loadInstalledServers()
      setNeedsAuth(false)
      toast.success(`${detail.displayName} 卸载成功`)
    } catch (error) {
      toast.error('卸载失败')
    } finally {
      setInstalling(false)
    }
  }

  const handleAuth = async () => {
    if (!installedServerId || !detail) return

    try {
      console.log(`[MCP Detail] 启动 OAuth 授权: ${detail.displayName}`)
      const success = await window.api.mcp.startAuth(installedServerId)

      if (success) {
        toast.success(`${detail.displayName} 授权成功`)
        setNeedsAuth(false)
        // 授权成功后自动连接
        await handleConnect()
      } else {
        toast.error(`${detail.displayName} 授权失败`)
      }
    } catch (error) {
      console.error('[MCP Detail] Auth failed:', error)
      toast.error(`授权失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleConnect = async () => {
    if (!installedServerId) return

    setConnectionStatus(installedServerId, 'connecting')

    try {
      const servers = await window.api.mcp.getAllServers()
      const server = servers.find((s) => s.id === installedServerId)
      if (!server) return

      const result = await window.api.mcp.connect(installedServerId, server.configJson)

      if (result.requiresAuth) {
        console.log(`[MCP Detail] Server requires OAuth authorization`)
        setNeedsAuth(true)
        setConnectionStatus(installedServerId, 'disconnected')
        return
      }

      if (result.success) {
        setConnectionStatus(installedServerId, 'connected')
        toast.success('连接成功')

        clearDetailCache(`local:${serverId}`)
        await loadDetail()
      } else {
        setConnectionStatus(installedServerId, 'error')
        toast.error('连接失败')
      }
    } catch (error) {
      console.error('[MCP Detail] Connect failed:', error)
      setConnectionStatus(installedServerId, 'error')
      toast.error(`连接失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleDisconnect = async () => {
    if (!installedServerId) return

    // 设置为 connecting 状态以显示 loading
    setConnectionStatus(installedServerId, 'connecting')

    try {
      await window.api.mcp.disconnect(installedServerId)
      setConnectionStatus(installedServerId, 'disconnected')
      toast.success('已断开连接')
    } catch (error) {
      console.error('[MCP Detail] Disconnect failed:', error)
      setConnectionStatus(installedServerId, 'error')
      toast.error('断开连接失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
        <Package className="size-12 mb-4 opacity-50" />
        <p className="text-sm mb-4">{error || '加载失败'}</p>
        <Button variant="outline" size="sm" onClick={loadDetail}>
          重试
        </Button>
      </div>
    )
  }

  // Tab 配置
  const tabs = [
    {
      id: 'readme' as TabType,
      label: '说明文档',
      icon: FileText,
      show: !!detail.readme
    },
    {
      id: 'tools' as TabType,
      label: '工具列表',
      icon: Package,
      badge: detail.tools?.length,
      show: detail.tools && detail.tools.length > 0
    },
    {
      id: 'scopes' as TabType,
      label: '权限范围',
      icon: Lock,
      show: detail.scopes && detail.scopes.length > 0
    }
  ].filter((tab) => tab.show)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden group">
      {/* Header - 概览区 */}
      <div className="shrink-0 border-b border-border/30">
        <div className="flex items-start gap-4 p-6">
          {/* Icon */}
          <div className="shrink-0 w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden">
            {detail.avatarUrl ? (
              <img
                src={detail.avatarUrl}
                alt={detail.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="size-10 text-primary/70" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground mb-1.5">{detail.displayName}</h1>
                <p className="text-sm text-muted-foreground">{detail.description || '暂无描述'}</p>
              </div>

              {/* Actions: 编辑/卸载/授权/连接开关 */}
              <div className="shrink-0 flex items-center gap-2">
                {isUninstalled ? (
                  <Badge variant="secondary" className="text-xs">
                    已卸载
                  </Badge>
                ) : installedServerId ? (
                  <>
                    {/* 编辑按钮 - hover 时显示 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEditServer}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      title="编辑配置"
                    >
                      <Edit className="size-4 mr-1" />
                      编辑
                    </Button>

                    {/* 卸载按钮 - hover 时显示 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUninstall}
                      disabled={installing}
                      className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="size-4 mr-1" />
                      {installing ? '卸载中...' : '卸载'}
                    </Button>

                    {/* 需要授权 */}
                    {needsAuth ? (
                      <Button size="sm" variant="default" onClick={handleAuth}>
                        <Key className="size-4 mr-2" />
                        授权
                      </Button>
                    ) : (
                      /* 连接开关 */
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={connectionStatus === 'connected'}
                          loading={connectionStatus === 'connecting'}
                          disabled={connectionStatus === 'connecting'}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleConnect()
                            } else {
                              handleDisconnect()
                            }
                          }}
                        />
                        <span
                          className={cn(
                            'text-xs',
                            connectionStatus === 'error'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          )}
                        >
                          {connectionStatus === 'connecting'
                            ? '连接中...'
                            : connectionStatus === 'connected'
                              ? '已启用'
                              : connectionStatus === 'error'
                                ? '连接失败'
                                : '已禁用'}
                        </span>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {/* Meta & Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {detail.creator && (
                  <span className="flex items-center gap-1" title="创建者">
                    <User className="size-3" />
                    {detail.creator}
                  </span>
                )}
                {detail.gmtModified && (
                  <div className="flex items-center gap-1" title="最后更新时间">
                    <Calendar className="size-3" />
                    <span>{new Date(detail.gmtModified).toLocaleDateString('zh-CN')}</span>
                  </div>
                )}
                {usageCount !== undefined && (
                  <div className="flex items-center gap-1" title="使用次数（近30天）">
                    <TrendingUp className="size-3" />
                    <span>{usageCount.toLocaleString()}</span>
                  </div>
                )}
                {detail.tools && detail.tools.length > 0 && (
                  <div className="flex items-center gap-1" title="工具数量">
                    <Package className="size-3" />
                    <span>{detail.tools.length} 个工具</span>
                  </div>
                )}
              </div>

              {/* Status Badge - 仅显示特殊状态（授权、错误） */}
              {installedServerId && (
                <div>
                  {needsAuth ? (
                    <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                      <Key className="size-3" />
                      需要授权
                    </Badge>
                  ) : connectionStatus === 'error' ? (
                    <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                      <XCircle className="size-3" />
                      错误
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 border-t border-border/30">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                  activeTab === tab.id
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {tab.badge}
                  </Badge>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content - Tab 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* README Tab */}
          {activeTab === 'readme' && detail.readme && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{detail.readme}</ReactMarkdown>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === 'tools' && detail.tools && detail.tools.length > 0 && (
            <div className="space-y-3 max-w-4xl">
              {detail.tools.map((tool, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-border/50 hover:border-border hover:bg-accent/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{tool.name}</h3>
                    {tool.annotations && Object.keys(tool.annotations).length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {Object.keys(tool.annotations).length} 注解
                      </Badge>
                    )}
                  </div>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground mb-3">{tool.description}</p>
                  )}
                  {tool.inputSchema && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                        查看参数 Schema
                      </summary>
                      <pre className="mt-2 p-3 rounded bg-muted text-[10px] overflow-x-auto border border-border/30">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Scopes Tab */}
          {activeTab === 'scopes' && detail.scopes && detail.scopes.length > 0 && (
            <div className="space-y-3 max-w-2xl">
              {detail.scopes.map((scope, index) => (
                <div key={index} className="p-4 rounded-lg border border-border/50 bg-accent/20">
                  {scope.deptName && (
                    <div className="text-sm font-medium text-foreground mb-2">{scope.deptName}</div>
                  )}
                  {scope.deptNo && (
                    <div className="text-xs text-muted-foreground">部门编号: {scope.deptNo}</div>
                  )}
                  {scope.deptNoPathList && scope.deptNoPathList.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      路径: {scope.deptNoPathList.join(' > ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 编辑服务器 Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>编辑 MCP 服务器</DialogTitle>
            <DialogDescription>修改 MCP 服务器的配置信息</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-server-config">配置 JSON</Label>
              <Textarea
                id="edit-server-config"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                onPaste={handlePaste}
                placeholder={`{
  "command": "npx",
  "args": ["your-mcp-server@latest"],
  "env": {
    "API_KEY": "your-key"
  }
}`}
                rows={12}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              取消
            </Button>
            <Button onClick={handleUpdateServer}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
