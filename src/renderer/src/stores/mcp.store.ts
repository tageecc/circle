import { create } from 'zustand'
import type { MCPServerDetail, ConnectionStatus } from '@/types/mcp'
import { extractServerCode } from '@/utils/mcp'

interface MCPDetailCacheItem {
  detail: MCPServerDetail
  timestamp: number
}

interface MCPDetailCache {
  items: Map<string, MCPDetailCacheItem>
  ttl: number
}

interface MCPState {
  installedServers: Map<string, string>
  connectionStates: Map<string, ConnectionStatus>
  detailCache: MCPDetailCache
  loadInstalledServers: () => Promise<void>
  isInstalled: (serverCode: string) => boolean
  getServerId: (serverCode: string) => string | null
  getServerDetail: (key: string, fetcher: () => Promise<MCPServerDetail>) => Promise<MCPServerDetail>
  clearDetailCache: (key: string) => void
  clearAllDetailCache: () => void
  setConnectionStatus: (serverId: string, status: ConnectionStatus) => void
  getConnectionStatus: (serverId: string) => ConnectionStatus
  initConnectionStates: (serverIds: string[]) => Promise<void>
  removeConnectionStatus: (serverId: string) => void
  batchAddServers: (
    servers: Array<{ config: any; serverName: string }>
  ) => Promise<{ successCount: number; failCount: number }>
}

export const useMCPStore = create<MCPState>((set, get) => ({
  installedServers: new Map(),
  connectionStates: new Map(),
  detailCache: {
    items: new Map(),
    ttl: 30 * 60 * 1000
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

  getServerDetail: async (key: string, fetcher: () => Promise<MCPServerDetail>) => {
    const state = get()
    const cached = state.detailCache.items.get(key)
    const now = Date.now()
    if (cached && now - cached.timestamp < state.detailCache.ttl) {
      return cached.detail
    }
    const detail = await fetcher()
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
      await Promise.all(
        serverIds.map(async (serverId) => {
          try {
            const status = await window.api.mcp.getConnectionStatus(serverId)
            states.set(serverId, status as ConnectionStatus)
          } catch {
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
    if (successCount > 0) {
      await get().loadInstalledServers()
    }
    return { successCount, failCount }
  }
}))
