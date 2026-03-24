import { MCPClient } from '@mastra/mcp'
import { MCPService } from './mcp.service'
import type { MCPServer } from '../database/schema.sqlite'

function parseMcpServerConfig(config: MCPServer['config']): {
  command: string
  args: string[]
  env: Record<string, string>
} {
  let raw: Record<string, unknown>
  try {
    raw =
      typeof config === 'string'
        ? (JSON.parse(config) as Record<string, unknown>)
        : (config as Record<string, unknown>)
  } catch {
    raw = {}
  }
  const command = String(raw.command ?? '')
  const args = Array.isArray(raw.args) ? (raw.args as unknown[]).map(String) : []
  const env =
    raw.env && typeof raw.env === 'object' && raw.env !== null && !Array.isArray(raw.env)
      ? (raw.env as Record<string, string>)
      : {}
  return { command, args, env }
}

/**
 * MCP Client 管理服务
 * 使用 Mastra 的 MCPClient 来管理 MCP 服务器连接
 */
export class MCPClientManager {
  private globalClient: MCPClient | null = null
  private clientInitialized = false
  private initializing = false

  /**
   * 初始化全局 MCP Client（后台异步，不阻塞）
   * 逐个连接服务器，单个失败不影响其他服务器
   */
  async initializeGlobalClient(): Promise<void> {
    if (this.initializing || this.clientInitialized) {
      console.log('[MCP] Client already initializing or initialized')
      return
    }

    this.initializing = true

    try {
      console.log('[MCP] Starting background MCP client initialization...')

      const servers = await MCPService.getAllServers()

      if (servers.length === 0) {
        console.log('[MCP] No MCP servers configured')
        this.initializing = false
        return
      }

      // 将所有服务器状态设置为 loading
      for (const server of servers) {
        await MCPService.updateServer(server.id, { status: 'loading' })
      }

      // 逐个尝试连接服务器
      const successfulServers: Record<string, any> = {}
      const failedServers: Array<{ id: string; name: string; error: string }> = []

      for (const server of servers) {
        try {
          console.log(`[MCP] Attempting to connect to ${server.name}...`)

          // 为单个服务器创建 MCPClient
          const cfg = parseMcpServerConfig(server.config)
          const singleClient = new MCPClient({
            id: `circle-${server.name}`,
            servers: {
              [server.name]: {
                command: cfg.command,
                args: cfg.args,
                env: cfg.env
              }
            }
          })

          // 尝试获取工具列表（验证连接）
          const tools = await singleClient.getTools()
          const toolNames = Object.keys(tools)

          console.log(`[MCP] Successfully connected to ${server.name}: ${toolNames.length} tools`)

          // 连接成功，更新数据库
          await MCPService.updateServer(server.id, {
            status: 'connected',
            tools: JSON.stringify(toolNames),
            error: null
          })

          // 保存到成功列表
          successfulServers[server.name] = {
            command: cfg.command,
            args: cfg.args,
            env: cfg.env
          }
        } catch (error: any) {
          // 单个服务器失败，记录错误但继续处理其他服务器
          const errorMessage = this.extractErrorMessage(error)
          console.error(`[MCP] Failed to connect to ${server.name}:`, errorMessage)

          failedServers.push({
            id: server.id,
            name: server.name,
            error: errorMessage
          })

          // 更新数据库中的错误状态
          await MCPService.updateServer(server.id, {
            status: 'error',
            error: errorMessage,
            tools: JSON.stringify([])
          })
        }
      }

      // 如果有成功的服务器，创建全局 MCPClient
      if (Object.keys(successfulServers).length > 0) {
        this.globalClient = new MCPClient({
          id: 'circle-global-mcp',
          servers: successfulServers
        })
        this.clientInitialized = true
        console.log(
          `[MCP] Global client initialized with ${Object.keys(successfulServers).length}/${servers.length} servers`
        )
      } else {
        console.warn('[MCP] No servers connected successfully')
      }

      // 输出连接摘要
      if (failedServers.length > 0) {
        console.warn(`[MCP] Failed servers (${failedServers.length}):`)
        failedServers.forEach(({ name, error }) => {
          console.warn(`  - ${name}: ${error}`)
        })
      }

      this.initializing = false
    } catch (error) {
      console.error('[MCP] Failed to initialize global client:', error)
      this.clientInitialized = false
      this.initializing = false
    }
  }

  /**
   * 提取可读的错误信息
   */
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error
    }

    if (error instanceof Error) {
      // 提取关键错误信息
      const message = error.message || ''

      // 常见错误模式
      if (message.includes('Connection closed')) {
        return '连接关闭：命令可能不存在或立即退出。请检查 command 和 args 是否正确。'
      }
      if (message.includes('ENOENT')) {
        return '命令未找到：请确认命令路径正确且已安装。'
      }
      if (message.includes('spawn')) {
        return '无法启动进程：请检查命令权限和路径。'
      }
      if (message.includes('timeout')) {
        return '连接超时：服务器响应时间过长。'
      }

      // 返回原始错误信息（截取前200字符）
      return message.length > 200 ? message.substring(0, 200) + '...' : message
    }

    return '未知错误'
  }

  /**
   * 获取全局 MCP Client
   */
  getGlobalClient(): MCPClient | null {
    return this.globalClient
  }

  /**
   * 检查客户端是否已初始化
   */
  isInitialized(): boolean {
    return this.clientInitialized
  }

  /**
   * 获取所有 MCP 工具（静态方式）
   * 适用于所有 Agent 共享同一套 MCP 配置的场景
   */
  async getTools(): Promise<Record<string, any>> {
    if (!this.globalClient || !this.clientInitialized) {
      console.log('[MCP] Client not initialized, returning empty tools')
      return {}
    }

    try {
      const tools = await this.globalClient.getTools()
      console.log(`[MCP] Retrieved ${Object.keys(tools).length} tools from MCP servers`)
      return tools
    } catch (error) {
      console.error('[MCP] Failed to get tools:', error)
      return {}
    }
  }

  /**
   * 获取 MCP 工具集（动态方式）
   * 适用于每个 Agent/请求有不同配置的场景
   */
  async getToolsets(): Promise<Record<string, any>> {
    if (!this.globalClient || !this.clientInitialized) {
      console.log('[MCP] Client not initialized, returning empty toolsets')
      return {}
    }

    try {
      const toolsets = await this.globalClient.getToolsets()
      return toolsets
    } catch (error) {
      console.error('[MCP] Failed to get toolsets:', error)
      return {}
    }
  }

  /**
   * 创建特定于 Agent 的 MCP Client（用于动态配置）
   */
  async createClientForAgent(agentId: string, serverIds?: string[]): Promise<MCPClient> {
    const servers = serverIds
      ? await Promise.all(serverIds.map((id) => MCPService.getServerById(id)))
      : await MCPService.getAllServers()

    const validServers = servers.filter((s): s is NonNullable<typeof s> => s !== undefined)

    const serversConfig: Record<string, any> = {}

    for (const server of validServers) {
      const cfg = parseMcpServerConfig(server.config)
      serversConfig[server.name] = {
        command: cfg.command,
        args: cfg.args,
        env: cfg.env
      }
    }

    return new MCPClient({
      id: `agent-${agentId}-mcp`,
      servers: serversConfig
    })
  }

  /**
   * 重新初始化客户端（当 MCP 配置变化时调用）
   */
  async reinitialize(): Promise<void> {
    console.log('[MCP] Reinitializing MCP client...')

    // 断开旧连接
    if (this.globalClient) {
      try {
        await this.globalClient.disconnect()
      } catch (error) {
        console.error('[MCP] Error disconnecting old client:', error)
      }
    }

    this.globalClient = null
    this.clientInitialized = false

    // 重新初始化
    await this.initializeGlobalClient()
  }

  /**
   * 断开所有连接
   */
  async disconnect(): Promise<void> {
    if (this.globalClient) {
      try {
        console.log('[MCP] Disconnecting global MCP client...')
        await this.globalClient.disconnect()
        this.globalClient = null
        this.clientInitialized = false
        console.log('[MCP] Global MCP client disconnected')
      } catch (error) {
        console.error('[MCP] Error disconnecting client:', error)
      }
    }
  }
}

// 单例导出
let mcpClientManagerInstance: MCPClientManager | null = null

export function createMCPClientManager(): MCPClientManager {
  if (!mcpClientManagerInstance) {
    mcpClientManagerInstance = new MCPClientManager()
  }
  return mcpClientManagerInstance
}

export function getMCPClientManager(): MCPClientManager {
  if (!mcpClientManagerInstance) {
    throw new Error('MCPClientManager not initialized')
  }
  return mcpClientManagerInstance
}
