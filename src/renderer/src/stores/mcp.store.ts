import { create } from 'zustand'
import type { MCPServerDetail, ConnectionStatus } from '@/types/mcp'
import { extractServerCode } from '@/utils/mcp'

export interface MCPMarketServer {
  code: string
  name: string
  description: string
  ownerEmpId: string
  platformCode: string
  updateTimeStamp: string
  icon: string
  usageCount: number
  toolsCount: number
}

interface MCPMarketCache {
  servers: MCPMarketServer[]
  totalElements: number
  totalPages: number
  lastOrderBy: 'USAGE' | 'TIMESTAMP'
  isLoading: boolean
  isLoaded: boolean
}

interface MCPDetailCacheItem {
  detail: MCPServerDetail
  timestamp: number
}

interface MCPDetailCache {
  // Map<serverCode | serverId, cacheItem>
  items: Map<string, MCPDetailCacheItem>
  // 缓存过期时间（毫秒）
  ttl: number
}

interface MCPState {
  /**
   * 已安装的 MCP 服务
   * Map<serverCode, serverId>
   */
  installedServers: Map<string, string>

  /**
   * MCP 服务连接状态
   * Map<serverId, ConnectionStatus>
   */
  connectionStates: Map<string, ConnectionStatus>

  /**
   * 当前激活的 tab
   */
  activeTab: 'marketplace' | 'installed'

  /**
   * 市场数据缓存
   */
  marketCache: MCPMarketCache

  /**
   * 详情页缓存
   */
  detailCache: MCPDetailCache

  /**
   * 加载已安装的服务列表
   */
  loadInstalledServers: () => Promise<void>

  /**
   * 检查服务是否已安装
   */
  isInstalled: (serverCode: string) => boolean

  /**
   * 获取已安装服务的 ID
   */
  getServerId: (serverCode: string) => string | null

  /**
   * 设置当前激活的 tab
   */
  setActiveTab: (tab: 'marketplace' | 'installed') => void

  /**
   * 预加载市场数据（后台静默加载，不阻塞 UI）
   */
  preloadMarketData: () => Promise<void>

  /**
   * 加载市场数据（支持分页）
   */
  loadMarketData: (options?: {
    orderBy?: 'USAGE' | 'TIMESTAMP'
    page?: number
    pageSize?: number
    reset?: boolean
  }) => Promise<void>

  /**
   * 获取服务详情（带缓存）
   */
  getServerDetail: (
    key: string,
    fetcher: () => Promise<MCPServerDetail>
  ) => Promise<MCPServerDetail>

  /**
   * 清除指定服务的详情缓存
   */
  clearDetailCache: (key: string) => void

  /**
   * 清除所有详情缓存
   */
  clearAllDetailCache: () => void

  /**
   * 设置服务连接状态
   */
  setConnectionStatus: (serverId: string, status: ConnectionStatus) => void

  /**
   * 获取服务连接状态
   */
  getConnectionStatus: (serverId: string) => ConnectionStatus

  /**
   * 批量初始化连接状态
   */
  initConnectionStates: (serverIds: string[]) => Promise<void>

  /**
   * 移除服务连接状态
   */
  removeConnectionStatus: (serverId: string) => void

  /**
   * 批量添加服务器
   */
  batchAddServers: (
    servers: Array<{ config: any; serverName: string }>
  ) => Promise<{ successCount: number; failCount: number }>
}

export const useMCPStore = create<MCPState>((set, get) => ({
  installedServers: new Map(),
  connectionStates: new Map(),
  activeTab: 'marketplace',
  marketCache: {
    servers: [],
    totalElements: 0,
    totalPages: 0,
    lastOrderBy: 'USAGE',
    isLoading: false,
    isLoaded: false
  },
  detailCache: {
    items: new Map(),
    ttl: 30 * 60 * 1000 // 30分钟
  },

  loadInstalledServers: async () => {
    try {
      const servers = await window.api.mcp.getAllServers()
      const serverMap = new Map<string, string>()

      servers.forEach((server: any) => {
        const code = server.configJson?.url ? extractServerCode(server.configJson.url) : null
        if (code) {
          serverMap.set(code, server.id)
        }
      })

      set({ installedServers: serverMap })
    } catch (error) {
      console.error('[MCPStore] 加载已安装服务失败:', error)
    }
  },

  isInstalled: (serverCode: string) => {
    return get().installedServers.has(serverCode)
  },

  getServerId: (serverCode: string) => {
    return get().installedServers.get(serverCode) || null
  },

  setActiveTab: (tab: 'marketplace' | 'installed') => {
    set({ activeTab: tab })
  },

  preloadMarketData: async () => {
    const state = get()

    // 如果已经加载过或正在加载，跳过
    if (state.marketCache.isLoaded || state.marketCache.isLoading) {
      return
    }

    // 后台静默加载，不阻塞 UI
    set((state) => ({
      marketCache: { ...state.marketCache, isLoading: true }
    }))

    try {
      const result = await window.api.mcp.getMarketServers({
        orderBy: 'USAGE',
        page: 1,
        pageSize: 20
      })

      set({
        marketCache: {
          servers: result.content,
          totalElements: result.totalElements,
          totalPages: result.totalPages,
          lastOrderBy: 'USAGE',
          isLoading: false,
          isLoaded: true
        }
      })
    } catch (error) {
      console.error('[MCPStore] 预加载市场数据失败:', error)
      set((state) => ({
        marketCache: { ...state.marketCache, isLoading: false }
      }))
    }
  },

  loadMarketData: async (options = {}) => {
    const { orderBy = 'USAGE', page = 1, pageSize = 20, reset = false } = options
    const state = get()

    // 如果正在加载，跳过
    if (state.marketCache.isLoading) {
      return
    }

    set((state) => ({
      marketCache: { ...state.marketCache, isLoading: true }
    }))

    try {
      const result = await window.api.mcp.getMarketServers({
        orderBy,
        page,
        pageSize
      })

      set((state) => ({
        marketCache: {
          servers: reset ? result.content : [...state.marketCache.servers, ...result.content],
          totalElements: result.totalElements,
          totalPages: result.totalPages,
          lastOrderBy: orderBy,
          isLoading: false,
          isLoaded: true
        }
      }))
    } catch (error) {
      console.error('[MCPStore] 加载市场数据失败:', error)
      set((state) => ({
        marketCache: { ...state.marketCache, isLoading: false }
      }))
      throw error
    }
  },

  getServerDetail: async (key: string, fetcher: () => Promise<MCPServerDetail>) => {
    const state = get()
    const cached = state.detailCache.items.get(key)
    const now = Date.now()

    // 如果缓存存在且未过期，直接返回
    if (cached && now - cached.timestamp < state.detailCache.ttl) {
      return cached.detail
    }

    // 否则重新获取
    const detail = await fetcher()

    // 更新缓存
    set((state) => {
      const newItems = new Map(state.detailCache.items)
      newItems.set(key, { detail, timestamp: now })
      return {
        detailCache: {
          ...state.detailCache,
          items: newItems
        }
      }
    })

    return detail
  },

  clearDetailCache: (key: string) => {
    set((state) => {
      const newItems = new Map(state.detailCache.items)
      newItems.delete(key)
      return {
        detailCache: {
          ...state.detailCache,
          items: newItems
        }
      }
    })
  },

  clearAllDetailCache: () => {
    set((state) => ({
      detailCache: {
        ...state.detailCache,
        items: new Map()
      }
    }))
  },

  setConnectionStatus: (serverId: string, status: ConnectionStatus) => {
    set((state) => {
      const newStates = new Map(state.connectionStates)
      newStates.set(serverId, status)
      return { connectionStates: newStates }
    })
  },

  getConnectionStatus: (serverId: string) => {
    return get().connectionStates.get(serverId) || 'disconnected'
  },

  initConnectionStates: async (serverIds: string[]) => {
    try {
      const states = new Map<string, ConnectionStatus>()

      // 并行获取所有服务的连接状态
      await Promise.all(
        serverIds.map(async (serverId) => {
          try {
            const status = await window.api.mcp.getConnectionStatus(serverId)
            states.set(serverId, status as ConnectionStatus)
          } catch (error) {
            console.error(`[MCPStore] 获取服务 ${serverId} 连接状态失败:`, error)
            states.set(serverId, 'disconnected')
          }
        })
      )

      set({ connectionStates: states })
    } catch (error) {
      console.error('[MCPStore] 初始化连接状态失败:', error)
    }
  },

  removeConnectionStatus: (serverId: string) => {
    set((state) => {
      const newStates = new Map(state.connectionStates)
      newStates.delete(serverId)
      return { connectionStates: newStates }
    })
  },

  batchAddServers: async (servers: Array<{ config: any; serverName: string }>) => {
    let successCount = 0
    let failCount = 0

    for (const { config, serverName } of servers) {
      try {
        await window.api.mcp.addServer({ name: serverName, configJson: config })
        successCount++
      } catch (error) {
        console.error(`[MCPStore] 添加服务器失败 ${serverName}:`, error)
        failCount++
      }
    }

    // 刷新已安装服务列表
    if (successCount > 0) {
      await get().loadInstalledServers()
    }

    return { successCount, failCount }
  }
}))
