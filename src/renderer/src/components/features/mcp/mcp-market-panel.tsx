import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  TrendingUp,
  Clock,
  Package,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/sonner'
import { useFileStore, getTabId } from '@/stores/file.store'
import { useMCPStore, type MCPMarketServer } from '@/stores/mcp.store'
import { getMCPServerUrl } from '@/utils/mcp'
import { MCPInstalledPanel } from './mcp-installed-panel'

interface MCPMarketPanelProps {}

export function MCPMarketPanel({}: MCPMarketPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [orderBy, setOrderBy] = useState<'USAGE' | 'TIMESTAMP'>('USAGE')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const scrollRef = useRef<HTMLDivElement>(null)
  const { openFiles, addFile, setActiveFile, activeFile } = useFileStore()
  const {
    isInstalled,
    getServerId,
    loadInstalledServers,
    activeTab,
    setActiveTab,
    marketCache,
    loadMarketData
  } = useMCPStore()

  // 从缓存中读取数据
  const servers = marketCache.servers
  const loading = marketCache.isLoading && !marketCache.isLoaded
  const loadingMore = marketCache.isLoading && marketCache.isLoaded
  const totalElements = marketCache.totalElements
  const hasMore = page < marketCache.totalPages

  // 加载 MCP 市场列表（使用 store）
  const loadServers = useCallback(
    async (reset = false) => {
      if (reset) {
        setPage(1)
      }

      try {
        const pageToLoad = reset ? 1 : page
        await loadMarketData({
          orderBy,
          page: pageToLoad,
          pageSize,
          reset
        })
      } catch (error) {
        toast.error(`加载 MCP 市场失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    },
    [orderBy, pageSize, loadMarketData, page]
  )

  // 滚动加载更多
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight

      if (scrollBottom < 100 && !loadingMore && hasMore) {
        setPage((prev) => prev + 1)
      }
    },
    [loadingMore, hasMore]
  )

  // 初始加载（仅首次）
  useEffect(() => {
    loadInstalledServers()

    // 如果缓存还没有数据，手动触发加载（预加载可能还没完成）
    if (!marketCache.isLoaded && !marketCache.isLoading) {
      loadServers(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInstalledServers])

  // orderBy 变化时重新加载（只有当 orderBy 与缓存不一致时才加载）
  useEffect(() => {
    if (marketCache.isLoaded && orderBy !== marketCache.lastOrderBy) {
      loadServers(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy, marketCache.lastOrderBy])

  // 加载下一页
  useEffect(() => {
    if (page > 1) {
      loadServers(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // 搜索过滤
  const filteredServers = servers.filter((server) => {
    const query = searchQuery.toLowerCase()
    return (
      server.name.toLowerCase().includes(query) ||
      server.description?.toLowerCase().includes(query) ||
      server.code.toLowerCase().includes(query)
    )
  })

  // 打开详情页
  const handleOpenDetail = (server: MCPMarketServer) => {
    const detailPath = `mcp://market/${server.code}`

    // 检查是否已经打开
    const existingFile = openFiles.find((file) => file.path === detailPath)

    if (existingFile) {
      // 如果已经打开，直接激活该 tab
      const tabId = getTabId(existingFile)
      setActiveFile(tabId)
    } else {
      // 如果没有打开，创建新的 tab
      addFile({
        path: detailPath,
        name: server.name,
        content: '', // 内容由 MCPDetailView 组件渲染
        language: 'markdown',
        isDirty: false,
        isPreview: false,
        encoding: 'utf-8',
        lineEnding: 'LF',
        isMCPDetail: true,
        mcpServerCode: server.code,
        mcpUsageCount: server.usageCount
      })
    }
  }

  // 安装 MCP 服务
  const handleInstall = async (server: MCPMarketServer, e: React.MouseEvent) => {
    e.stopPropagation()

    const toastId = `install-${server.code}`
    toast.loading('正在安装...', { id: toastId })

    try {
      await window.api.mcp.addServer({
        name: server.name,
        configJson: {
          type: 'http' as const,
          url: getMCPServerUrl(server.code),
          requiresAuth: true
        }
      })

      // 立即更新全局状态
      await loadInstalledServers()
      toast.success(`${server.name} 安装成功`, { id: toastId })
    } catch (error) {
      toast.error('安装失败', { id: toastId })
    }
  }

  // 卸载 MCP 服务
  const handleUninstall = async (server: MCPMarketServer, e: React.MouseEvent) => {
    e.stopPropagation()

    const serverId = getServerId(server.code)
    if (!serverId) {
      toast.error('未找到已安装的服务')
      return
    }

    const toastId = `uninstall-${server.code}`
    toast.loading('正在卸载...', { id: toastId })

    try {
      await window.api.mcp.deleteServer(serverId)

      // 立即更新全局状态
      await loadInstalledServers()
      toast.success(`${server.name} 卸载成功`, { id: toastId })
    } catch (error) {
      toast.error('卸载失败', { id: toastId })
    }
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as 'marketplace' | 'installed')}
      className="flex flex-col h-full"
    >
      {/* Tab Headers */}
      <div className="px-3 py-2 border-b border-border/30">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="marketplace" className="text-xs">
            市场
          </TabsTrigger>
          <TabsTrigger value="installed" className="text-xs">
            已安装
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Marketplace Tab */}
      <TabsContent
        value="marketplace"
        className="flex-1 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden"
      >
        {/* Search and Filter */}
        <div className="px-3 py-2 border-b border-border/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{totalElements} 个服务</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent/50"
              onClick={() => {
                setPage(1)
                loadServers(true)
                loadInstalledServers()
              }}
              disabled={loading}
              title="刷新"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索 MCP 服务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Select
              value={orderBy}
              onValueChange={(v) => {
                setOrderBy(v as 'USAGE' | 'TIMESTAMP')
                setPage(1)
              }}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USAGE">热门</SelectItem>
                <SelectItem value="TIMESTAMP">最新</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Server List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Package className="size-8 mb-2 opacity-50" />
              <p className="text-xs">暂无服务</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 p-2">
                {filteredServers.map((server) => {
                  const installed = isInstalled(server.code)
                  // 判断是否是当前选中的服务
                  const detailPath = `mcp://market/${server.code}`
                  const isActive = openFiles.some(
                    (file) => getTabId(file) === activeFile && file.path === detailPath
                  )

                  return (
                    <div
                      key={server.code}
                      className={cn(
                        'group p-3 rounded-lg border transition-all cursor-pointer',
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-border hover:bg-accent/30'
                      )}
                      onClick={() => handleOpenDetail(server)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {server.icon ? (
                            <img
                              src={server.icon}
                              alt={server.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="size-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-medium text-foreground truncate">
                              {server.name}
                            </h3>
                            {installed ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={(e) => handleUninstall(server, e)}
                              >
                                <Trash2 className="size-3 mr-1" />
                                卸载
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleInstall(server, e)}
                              >
                                <Download className="size-3 mr-1" />
                                安装
                              </Button>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {server.description || '暂无描述'}
                          </p>

                          {/* Meta Info */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1" title="工具数量">
                              <Package className="size-3" />
                              <span>{server.toolsCount || 0}</span>
                            </div>
                            <div className="flex items-center gap-1" title="使用次数（近30天）">
                              <TrendingUp className="size-3" />
                              <span>{server.usageCount || 0}</span>
                            </div>
                            <div className="flex items-center gap-1" title="更新时间">
                              <Clock className="size-3" />
                              <span>
                                {new Date(server.updateTimeStamp).toLocaleDateString('zh-CN', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 加载更多指示器 */}
              {loadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">加载中...</span>
                </div>
              )}

              {/* 没有更多数据提示 */}
              {!hasMore && servers.length > 0 && (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                  已加载全部 {servers.length} 个服务
                </div>
              )}
            </>
          )}
        </div>
      </TabsContent>

      {/* Installed Tab */}
      <TabsContent
        value="installed"
        className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
      >
        <MCPInstalledPanel />
      </TabsContent>
    </Tabs>
  )
}
