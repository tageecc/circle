/**
 * MCP IPC Handlers
 * 处理 MCP 协议相关的 IPC 通信
 */

import { ipcMain } from 'electron'
import { MCPService, type NewMCPServer, type MCPConfig } from '../services/mcp.service'
import { OAuthRequiredError } from '../services/oauth.service'

export function registerMCPHandlers() {
  const mcpService = MCPService.getInstance()

  // 获取所有 MCP 服务器
  ipcMain.handle('mcp:getAllServers', async () => {
    try {
      return await mcpService.getAllServers()
    } catch (error) {
      console.error('[MCP] Failed to get all servers:', error)
      throw error
    }
  })

  // 添加 MCP 服务器
  ipcMain.handle('mcp:addServer', async (_, server: NewMCPServer) => {
    try {
      return await mcpService.addServer(server)
    } catch (error) {
      console.error('[MCP] Failed to add server:', error)
      throw error
    }
  })

  // 更新 MCP 服务器
  ipcMain.handle(
    'mcp:updateServer',
    async (_, serverId: string, name: string, configJson: MCPConfig) => {
      try {
        return await mcpService.updateServer(serverId, name, configJson)
      } catch (error) {
        console.error('[MCP] Failed to update server:', error)
        throw error
      }
    }
  )

  // 删除 MCP 服务器
  ipcMain.handle('mcp:deleteServer', async (_, serverId: string) => {
    try {
      await mcpService.deleteServer(serverId)
    } catch (error) {
      console.error('[MCP] Failed to delete server:', error)
      throw error
    }
  })

  // 连接到 MCP 服务器
  ipcMain.handle('mcp:connect', async (_, serverId: string, serverConfig: MCPConfig) => {
    try {
      const success = await mcpService.connect(serverId, serverConfig)
      return { success, requiresAuth: false }
    } catch (error) {
      if (error instanceof OAuthRequiredError) {
        console.log('[MCP] Connection requires OAuth authorization')
        return { success: false, requiresAuth: true, statusCode: error.statusCode }
      }
      console.error('[MCP] Failed to connect:', error)
      throw error
    }
  })

  // 断开与 MCP 服务器的连接
  ipcMain.handle('mcp:disconnect', async (_, serverId: string) => {
    try {
      await mcpService.disconnect(serverId)
    } catch (error) {
      console.error('[MCP] Failed to disconnect:', error)
      throw error
    }
  })

  // 调用 MCP 工具
  ipcMain.handle('mcp:callTool', async (_, serverId: string, toolName: string, args: any) => {
    try {
      return await mcpService.callTool(serverId, toolName, args)
    } catch (error) {
      console.error('[MCP] Failed to call tool:', error)
      throw error
    }
  })

  // 列出所有可用工具
  ipcMain.handle('mcp:listAllTools', async () => {
    try {
      return await mcpService.listAllTools()
    } catch (error) {
      console.error('[MCP] Failed to list tools:', error)
      throw error
    }
  })

  // 列出所有可用资源
  ipcMain.handle('mcp:listAllResources', async () => {
    try {
      return await mcpService.listAllResources()
    } catch (error) {
      console.error('[MCP] Failed to list resources:', error)
      throw error
    }
  })

  // 读取资源
  ipcMain.handle(
    'mcp:readResource',
    async (_, serverId: string, resourceName: string, args: any) => {
      try {
        return await mcpService.readResource(serverId, resourceName, args)
      } catch (error) {
        console.error('[MCP] Failed to read resource:', error)
        throw error
      }
    }
  )

  // 列出所有可用提示
  ipcMain.handle('mcp:listAllPrompts', async () => {
    try {
      return await mcpService.listAllPrompts()
    } catch (error) {
      console.error('[MCP] Failed to list prompts:', error)
      throw error
    }
  })

  // 获取提示
  ipcMain.handle('mcp:getPrompt', async (_, serverId: string, promptName: string, args: any) => {
    try {
      return await mcpService.getPrompt(serverId, promptName, args)
    } catch (error) {
      console.error('[MCP] Failed to get prompt:', error)
      throw error
    }
  })

  // 获取连接状态
  ipcMain.handle('mcp:getConnectionStatus', async (_, serverId: string) => {
    try {
      return mcpService.getConnectionStatus(serverId)
    } catch (error) {
      console.error('[MCP] Failed to get connection status:', error)
      return 'disconnected'
    }
  })

  // OAuth 授权
  ipcMain.handle('mcp:startAuth', async (_, serverId: string) => {
    try {
      return await mcpService.startAuth(serverId)
    } catch (error) {
      console.error('[MCP] Failed to start auth:', error)
      throw error
    }
  })

  // 清除授权
  ipcMain.handle('mcp:clearAuth', async (_, serverId: string) => {
    try {
      await mcpService.clearAuth(serverId)
    } catch (error) {
      console.error('[MCP] Failed to clear auth:', error)
      throw error
    }
  })

  console.log('[MCP] Handlers registered')
}
