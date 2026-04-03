/**
 * MCP Service
 * 管理 MCP 服务器连接和交互
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { jsonSchema } from '@ai-sdk/provider-utils'
import type { JSONSchema7 } from '@ai-sdk/provider'
import type { CircleToolSet } from '../types/circle-tool-set'
import { getDb } from '../database/db'
import * as schema from '../database/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { OAuthService, OAuthRequiredError } from './oauth.service'

// MCP 配置类型
export type MCPConfig = MCPStdioConfig | MCPHttpConfig

export interface MCPStdioConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface MCPHttpConfig {
  url: string
  headers?: Record<string, string>
}

// 数据库中的 MCPServer 类型（configJson 是字符串）
export type MCPServerDB = schema.MCPServer

// Service 层返回的 MCPServer 类型（configJson 已解析为对象）
export type MCPServer = Omit<MCPServerDB, 'configJson'> & {
  configJson: MCPConfig
}

export type NewMCPServer = Omit<MCPServer, 'createdAt' | 'updatedAt'>

class MCPHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'MCPHttpError'
  }
}

// MCP 消息类型
interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

// MCP 工具定义
interface MCPTool {
  name: string
  description?: string
  inputSchema: any
}

// MCP 资源定义
interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

// MCP 提示定义
interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

// MCP 服务器连接
interface MCPServerConnection {
  type: 'stdio' | 'http'
  process?: ChildProcessWithoutNullStreams // stdio 方式才有
  url?: string // http 方式才有
  headers?: Record<string, string> // http 方式才有
  sessionId?: string // http 方式的会话 ID（用于 Aone MCP 等需要 session tracking 的服务器）
  serverId: string
  serverName: string
  serverConfig: MCPConfig
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  tools: MCPTool[]
  resources: MCPResource[]
  prompts: MCPPrompt[]
  lastActivity: number
  pendingRequests: Map<
    string | number,
    { resolve: (value: any) => void; reject: (error: any) => void }
  >
  messageBuffer: string
}

export class MCPService {
  private static instance: MCPService
  private connections = new Map<string, MCPServerConnection>()
  private db = getDb()
  private oauthService = OAuthService.getInstance()
  private executionQueues = new Map<string, Promise<any>>()

  // 常量配置
  private readonly REQUEST_TIMEOUT = 120000 // 120秒

  private constructor() {}

  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService()
    }
    return MCPService.instance
  }

  /**
   * 解析 configJson（处理字符串和对象两种情况）
   */
  private parseConfigJson(configJson: string | MCPConfig): MCPConfig {
    return typeof configJson === 'string' ? JSON.parse(configJson) : configJson
  }

  /**
   * 获取已连接的服务器，否则抛出错误
   */
  private getConnectedServer(serverId: string): MCPServerConnection {
    const connection = this.connections.get(serverId)
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`)
    }
    return connection
  }

  /**
   * 聚合所有已连接服务器的某个属性列表
   */
  private aggregateFromConnections<T>(
    propertyName: 'tools' | 'resources' | 'prompts'
  ): Array<T & { serverId: string; serverName: string }> {
    const items: Array<T & { serverId: string; serverName: string }> = []
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        const itemsWithServer = connection[propertyName].map((item: any) => ({
          ...item,
          serverId: connection.serverId,
          serverName: connection.serverName
        }))
        items.push(...itemsWithServer)
      }
    }
    return items
  }

  /**
   * 更新 session ID 到连接的 headers
   */
  private updateSessionId(connection: MCPServerConnection, sessionId: string): void {
    if (!connection.sessionId) {
      connection.sessionId = sessionId
      connection.headers = connection.headers || {}
      connection.headers['Mcp-Session-Id'] = sessionId
      console.log(`[MCP ${connection.serverName}] Session ID received: ${sessionId}`)
    }
  }

  /**
   * 更新服务器的自动连接标记
   */
  private updateAutoConnect(serverId: string, serverName: string, autoConnect: boolean): void {
    try {
      const now = new Date()
      this.db
        .getDb()
        .update(schema.mcpServers)
        .set({ autoConnect, updatedAt: now })
        .where(eq(schema.mcpServers.id, serverId))
        .run()
      const action = autoConnect ? 'Enabled' : 'Disabled'
      console.log(`[MCP] ${action} auto-connect for ${serverName}`)
    } catch (error) {
      const action = autoConnect ? 'enable' : 'disable'
      console.error(`[MCP] Failed to ${action} auto-connect for ${serverName}:`, error)
    }
  }

  /**
   * 获取所有服务器
   */
  async getAllServers(): Promise<MCPServer[]> {
    const servers = this.db.getDb().select().from(schema.mcpServers).all()
    return servers.map((s) => ({
      ...s,
      configJson: this.parseConfigJson(s.configJson)
    })) as MCPServer[]
  }

  /**
   * 自动连接所有标记为自动连接的服务器
   */
  async autoConnectServers(): Promise<void> {
    try {
      const servers = this.db
        .getDb()
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.autoConnect, true))
        .all()

      if (servers.length === 0) {
        console.log('[MCP] No servers configured for auto-connect')
        return
      }

      console.log(`[MCP] Auto-connecting to ${servers.length} server(s)...`)
      const startTime = Date.now()

      // 并发连接所有服务器
      const results = await Promise.allSettled(
        servers.map(async (server) => {
          try {
            const config = this.parseConfigJson(server.configJson)
            await this.connect(server.id, config, false)
            console.log(`[MCP] ✅ Auto-connected to ${server.name}`)
            return { success: true, serverName: server.name }
          } catch (error) {
            console.error(`[MCP] ❌ Failed to auto-connect to ${server.name}:`, error)
            return { success: false, serverName: server.name, error }
          }
        })
      )

      const elapsed = Date.now() - startTime
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
      console.log(
        `[MCP] Auto-connect completed: ${succeeded}/${servers.length} succeeded in ${elapsed}ms`
      )
    } catch (error) {
      console.error('[MCP] Failed to auto-connect servers:', error)
    }
  }

  /**
   * 根据 ID 获取服务器
   */
  async getServerById(serverId: string): Promise<MCPServer | null> {
    const [server] = this.db
      .getDb()
      .select()
      .from(schema.mcpServers)
      .where(eq(schema.mcpServers.id, serverId))
      .limit(1)
      .all()
    if (!server) return null
    return {
      ...server,
      configJson: this.parseConfigJson(server.configJson)
    } as MCPServer
  }

  /**
   * 添加服务器
   */
  async addServer(server: NewMCPServer): Promise<MCPServer> {
    const now = new Date()
    const [newServer] = this.db
      .getDb()
      .insert(schema.mcpServers)
      .values({
        ...server,
        configJson: JSON.stringify(server.configJson),
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .all()
    return {
      ...newServer,
      configJson: this.parseConfigJson(newServer.configJson)
    } as MCPServer
  }

  /**
   * 更新服务器
   */
  async updateServer(serverId: string, name: string, configJson: MCPConfig): Promise<MCPServer> {
    const now = new Date()
    const [updated] = this.db
      .getDb()
      .update(schema.mcpServers)
      .set({ name, configJson: JSON.stringify(configJson), updatedAt: now })
      .where(eq(schema.mcpServers.id, serverId))
      .returning()
      .all()

    if (!updated) {
      throw new Error(`Server ${serverId} not found`)
    }

    return {
      ...updated,
      configJson: this.parseConfigJson(updated.configJson)
    } as MCPServer
  }

  /**
   * 删除服务器
   */
  async deleteServer(serverId: string): Promise<void> {
    if (this.connections.has(serverId)) {
      try {
        await this.disconnect(serverId)
      } catch (error) {
        console.warn(`[MCP] Failed to disconnect server ${serverId} during deletion:`, error)
      }
    }

    this.db.getDb().delete(schema.mcpServers).where(eq(schema.mcpServers.id, serverId)).run()
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(
    serverId: string,
    serverConfig: MCPConfig,
    autoSetAutoConnect: boolean = true
  ): Promise<boolean> {
    // 如果已经连接，先断开旧连接
    if (this.connections.has(serverId)) {
      console.log(`[MCP] Server ${serverId} already connected, disconnecting old connection`)
      await this.disconnect(serverId, false)
    }

    // 获取服务器配置
    const server = await this.getServerById(serverId)
    const serverName = server?.name || serverId

    let success = false

    // 检查配置类型：Stdio 或 HTTP
    if ('url' in serverConfig) {
      // HTTP 方式
      success = await this.connectHTTP(serverId, serverName, serverConfig)
    } else {
      // Stdio 方式
      success = await this.connectStdio(serverId, serverName, serverConfig)
    }

    // 连接成功后，设置自动连接标记
    if (success && autoSetAutoConnect) {
      this.updateAutoConnect(serverId, serverName, true)
    }

    return success
  }

  /**
   * 连接到 HTTP 方式的 MCP 服务器
   */
  private async connectHTTP(
    serverId: string,
    serverName: string,
    serverConfig: MCPConfig & { url: string; headers?: Record<string, string> }
  ): Promise<boolean> {
    const { url, headers = {} } = serverConfig

    // 准备基础请求头
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // 尝试获取有效的 OAuth token
    const token = await this.oauthService.getValidToken(serverId)
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`
      console.log(`[MCP] 🔐 Using OAuth token for ${serverName}`)
    }

    // 用户自定义 headers 优先级最高，会覆盖上面的默认值
    Object.assign(requestHeaders, headers)
    if (headers.Authorization) {
      console.log(`[MCP] 🔐 User-provided Authorization header will override OAuth token`)
    }

    const connection: MCPServerConnection = {
      type: 'http',
      url,
      headers: requestHeaders,
      serverId,
      serverName,
      serverConfig,
      status: 'connecting',
      tools: [],
      resources: [],
      prompts: [],
      lastActivity: Date.now(),
      pendingRequests: new Map(),
      messageBuffer: ''
    }

    this.connections.set(serverId, connection)

    try {
      await this.discoverCapabilities(connection)

      connection.status = 'connected'
      console.log(`[MCP] Connected to ${serverName} (HTTP)`)
      return true
    } catch (error: any) {
      this.connections.delete(serverId)
      connection.status = 'error'

      if (error instanceof MCPHttpError) {
        const statusCode = error.statusCode
        const hasToken = await this.oauthService.getValidToken(serverId)

        if ((statusCode === 400 || statusCode === 401 || statusCode === 403) && !hasToken) {
          console.log(`[MCP] OAuth required for ${serverName} (HTTP ${statusCode})`)
          throw new OAuthRequiredError(statusCode)
        }

        if ((statusCode === 401 || statusCode === 403) && hasToken) {
          console.log(`[MCP] Token expired for ${serverName}, re-authorization required`)
          await this.oauthService.clearAuth(serverId)
          throw new OAuthRequiredError(statusCode)
        }
      }

      console.error(`[MCP] Failed to connect to ${serverName} (HTTP):`, error)
      throw error
    }
  }

  /**
   * 连接到 Stdio 方式的 MCP 服务器
   */
  private async connectStdio(
    serverId: string,
    serverName: string,
    serverConfig: MCPConfig & { command: string; args: string[]; env?: Record<string, string> }
  ): Promise<boolean> {
    const { command, args, env } = serverConfig

    // 准备环境变量
    const processEnv: Record<string, string> = { ...process.env, ...env } as Record<string, string>

    // 启动子进程
    const childProcess = spawn(command, args, {
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const connection: MCPServerConnection = {
      type: 'stdio',
      process: childProcess,
      serverId,
      serverName,
      serverConfig,
      status: 'connecting',
      tools: [],
      resources: [],
      prompts: [],
      lastActivity: Date.now(),
      pendingRequests: new Map(),
      messageBuffer: ''
    }

    // 处理标准输出
    childProcess.stdout.on('data', (data) => {
      connection.messageBuffer += data.toString()
      this.processMessages(connection)
    })

    // 处理标准错误
    childProcess.stderr.on('data', (data) => {
      console.error(`[MCP ${serverName}] stderr:`, data.toString())
    })

    // 处理进程退出
    childProcess.on('exit', (code) => {
      console.log(`[MCP ${serverName}] Process exited with code ${code}`)
      connection.status = 'disconnected'
      this.connections.delete(serverId)
    })

    // 处理进程错误
    childProcess.on('error', (error) => {
      console.error(`[MCP ${serverName}] Process error:`, error)
      connection.status = 'error'
      this.connections.delete(serverId)
    })

    this.connections.set(serverId, connection)

    try {
      // 初始化连接：发现工具、资源和提示
      await this.discoverCapabilities(connection)

      connection.status = 'connected'
      console.log(`[MCP] Connected to ${serverName} (Stdio)`)
      return true
    } catch (error: any) {
      this.connections.delete(serverId)
      connection.status = 'error'

      if (connection.process) {
        connection.process.kill()
      }

      console.error(`[MCP] Failed to connect to ${serverName} (Stdio):`, error)
      throw error
    }
  }

  /**
   * 断开连接
   */
  async disconnect(serverId: string, clearAutoConnect: boolean = true): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      // 如果连接不存在，直接返回，不抛错
      console.log(`[MCP] Server ${serverId} is not connected, skipping disconnect`)
      return
    }

    // 清理待处理的请求
    for (const [id, pending] of connection.pendingRequests) {
      pending.reject(new Error('Connection closed'))
      connection.pendingRequests.delete(id)
    }

    // 终止子进程（仅 Stdio 方式）
    if (connection.type === 'stdio' && connection.process) {
      connection.process.kill()
    }

    connection.status = 'disconnected'
    this.connections.delete(serverId)

    // 清除自动连接标记
    if (clearAutoConnect) {
      this.updateAutoConnect(serverId, connection.serverName, false)
    }

    console.log(`[MCP] Disconnected from ${connection.serverName}`)
  }

  /**
   * 调用工具
   */
  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const connection = this.getConnectedServer(serverId)

    // 使用队列确保同一 server 的工具串行执行（避免浏览器还没启动就执行点击等操作）
    const previousTask = this.executionQueues.get(serverId) || Promise.resolve()

    const currentTask = previousTask
      .catch(() => {}) // 忽略上一个任务的错误，继续执行当前任务
      .then(() => {
        return this.sendRequest(connection, 'tools/call', {
          name: toolName,
          arguments: args
        })
      })

    this.executionQueues.set(serverId, currentTask)
    return currentTask
  }

  /**
   * 列出所有可用工具
   */
  async listAllTools(): Promise<MCPTool[]> {
    return this.aggregateFromConnections<MCPTool>('tools')
  }

  /**
   * MCP tools as AI SDK `Tool` (inputSchema via jsonSchema — same shape as defineTool).
   */
  getAISDKTools(): CircleToolSet {
    const tools: CircleToolSet = {}

    for (const conn of this.connections.values()) {
      if (conn.status !== 'connected') continue

      for (const tool of conn.tools) {
        tools[`${conn.serverName}__${tool.name}`] = {
          description: tool.description || `${tool.name} from ${conn.serverName}`,
          inputSchema: jsonSchema(tool.inputSchema as JSONSchema7),
          execute: async (args: unknown) => {
            const result = await this.callTool(conn.serverId, tool.name, args)
            return typeof result === 'string' ? result : JSON.stringify(result)
          }
        }
      }
    }

    return tools
  }

  /**
   * 列出所有可用资源
   */
  async listAllResources(): Promise<MCPResource[]> {
    return this.aggregateFromConnections<MCPResource>('resources')
  }

  /**
   * 读取资源
   */
  async readResource(serverId: string, resourceName: string, args: any): Promise<any> {
    const connection = this.getConnectedServer(serverId)
    return this.sendRequest(connection, 'resources/read', {
      uri: resourceName,
      ...args
    })
  }

  /**
   * 列出所有可用提示
   */
  async listAllPrompts(): Promise<MCPPrompt[]> {
    return this.aggregateFromConnections<MCPPrompt>('prompts')
  }

  /**
   * 获取提示
   */
  async getPrompt(serverId: string, promptName: string, args: any): Promise<string> {
    const connection = this.getConnectedServer(serverId)
    return this.sendRequest(connection, 'prompts/get', {
      name: promptName,
      arguments: args
    })
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(serverId: string): 'connecting' | 'connected' | 'disconnected' | 'error' {
    const connection = this.connections.get(serverId)
    return connection?.status || 'disconnected'
  }

  /**
   * 发现 MCP 服务器的能力（工具、资源、提示）
   */
  private async discoverCapabilities(connection: MCPServerConnection): Promise<void> {
    try {
      // 1. 发送 initialize 请求
      const initResult = await this.sendRequest(connection, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'Circle',
          version: '1.0.0'
        }
      })

      const serverCapabilities = initResult.capabilities || {}
      console.log(
        `[MCP ${connection.serverName}] Initialized with capabilities:`,
        Object.keys(serverCapabilities)
      )

      // 2. 发送 initialized 通知（notification，无需等待响应）
      this.sendNotification(connection, 'notifications/initialized', {})

      // 3. 根据服务器能力列出工具
      if (serverCapabilities.tools) {
        const toolsResponse = await this.sendRequest(connection, 'tools/list', {})
        connection.tools = toolsResponse.tools || []
      }

      // 4. 根据服务器能力列出资源
      if (serverCapabilities.resources) {
        const resourcesResponse = await this.sendRequest(connection, 'resources/list', {})
        connection.resources = resourcesResponse.resources || []
      }

      // 5. 根据服务器能力列出提示
      if (serverCapabilities.prompts) {
        const promptsResponse = await this.sendRequest(connection, 'prompts/list', {})
        connection.prompts = promptsResponse.prompts || []
      }

      console.log(`[MCP ${connection.serverName}] Discovered:`, {
        tools: connection.tools.length,
        resources: connection.resources.length,
        prompts: connection.prompts.length
      })
    } catch (error) {
      console.error(`[MCP ${connection.serverName}] Failed to discover capabilities:`, error)
      throw error
    }
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private async sendRequest(
    connection: MCPServerConnection,
    method: string,
    params: any
  ): Promise<any> {
    const id = nanoid()
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }

    // HTTP 方式：使用 fetch 发送请求
    if (connection.type === 'http') {
      return this.sendHTTPRequest(connection, message)
    }

    // Stdio 方式：通过 stdin 发送
    return new Promise((resolve, reject) => {
      connection.pendingRequests.set(id, { resolve, reject })

      // 发送消息
      const messageStr = JSON.stringify(message) + '\n'
      connection.process!.stdin.write(messageStr)

      // 设置超时
      setTimeout(() => {
        if (connection.pendingRequests.has(id)) {
          connection.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, this.REQUEST_TIMEOUT)
    })
  }

  /**
   * 发送 JSON-RPC 通知（无需响应）
   */
  private sendNotification(connection: MCPServerConnection, method: string, params: any): void {
    const message = {
      jsonrpc: '2.0',
      method,
      params
    }

    // HTTP 方式
    if (connection.type === 'http') {
      if (!connection.url) return

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        ...(connection.headers || {})
      }

      fetch(connection.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
      }).catch((error) => {
        console.error(`[MCP ${connection.serverName}] Notification failed:`, error)
      })
      return
    }

    // Stdio 方式
    if (connection.process) {
      const messageStr = JSON.stringify(message) + '\n'
      connection.process.stdin.write(messageStr)
    }
  }

  /**
   * 通过 HTTP 发送 JSON-RPC 请求（支持 SSE）
   */
  private async sendHTTPRequest(
    connection: MCPServerConnection,
    message: MCPMessage
  ): Promise<any> {
    if (!connection.url) {
      throw new Error('HTTP connection missing URL')
    }

    try {
      // 准备请求头，支持 SSE (text/event-stream)
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        ...(connection.headers || {})
      }

      const response = await fetch(connection.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        // 尝试获取服务器返回的详细错误信息
        let errorDetail = response.statusText
        try {
          const errorBody = await response.json()
          if (errorBody.message) {
            errorDetail = errorBody.message
          } else if (errorBody.error) {
            errorDetail = errorBody.error
          }
        } catch {
          // 如果不是 JSON，忽略
        }
        throw new MCPHttpError(response.status, errorDetail)
      }

      // 提取 session ID（如果服务器返回）
      const sessionIdHeader =
        response.headers.get('Mcp-Session-Id') || response.headers.get('X-Session-Id')
      if (sessionIdHeader) {
        this.updateSessionId(connection, sessionIdHeader)
      }

      const contentType = response.headers.get('content-type') || ''

      // 如果返回的是 SSE 流
      if (contentType.includes('text/event-stream')) {
        return await this.parseSSEResponse(response, connection, message.id)
      }

      // 否则按普通 JSON 处理
      const result: MCPMessage = await response.json()
      connection.lastActivity = Date.now()

      // 也可能在响应体中包含 session ID
      if (result.result?.sessionId) {
        this.updateSessionId(connection, result.result.sessionId)
      }

      if (result.error) {
        throw new Error(result.error.message)
      }

      return result.result
    } catch (error) {
      console.error(`[MCP ${connection.serverName}] HTTP request failed:`, error)
      throw error
    }
  }

  /**
   * 解析 SSE 响应流
   */
  private async parseSSEResponse(
    response: Response,
    connection: MCPServerConnection,
    requestId?: string | number
  ): Promise<any> {
    if (!response.body) {
      throw new Error('Response body is null')
    }

    return new Promise((resolve, reject) => {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // 设置超时
      const timeout = setTimeout(() => {
        reader.cancel()
        reject(new Error(`SSE stream timeout after ${this.REQUEST_TIMEOUT / 1000} seconds`))
      }, this.REQUEST_TIMEOUT)

      const processChunk = async () => {
        try {
          const { done, value } = await reader.read()

          if (done) {
            clearTimeout(timeout)
            reject(new Error('SSE stream ended without result'))
            return
          }

          buffer += decoder.decode(value, { stream: true })

          // SSE 格式：每个事件以 \n\n 分隔
          const events = buffer.split('\n\n')
          buffer = events.pop() || '' // 保留不完整的事件

          for (const event of events) {
            if (!event.trim()) continue

            // 解析事件中的 data: 行
            const lines = event.split('\n')
            for (const line of lines) {
              const trimmedLine = line.trim()

              if (trimmedLine.startsWith('data: ')) {
                const data = trimmedLine.slice(6)

                // 跳过特殊标记
                if (data === '[DONE]' || data === '') {
                  continue
                }

                try {
                  const message: MCPMessage = JSON.parse(data)
                  connection.lastActivity = Date.now()

                  // 如果指定了 requestId，验证响应 id 是否匹配
                  if (requestId !== undefined && message.id !== requestId) {
                    console.log(
                      `[MCP ${connection.serverName}] Ignoring message with mismatched id: ${message.id} (expected: ${requestId})`
                    )
                    continue
                  }

                  // 处理错误响应
                  if (message.error) {
                    clearTimeout(timeout)
                    reader.cancel()
                    reject(new Error(message.error.message || 'Unknown error'))
                    return
                  }

                  // 获取结果（tools/list, resources/list 等）
                  if (message.result !== undefined) {
                    clearTimeout(timeout)
                    reader.cancel()
                    resolve(message.result)
                    return
                  }
                } catch (parseError) {
                  console.warn(
                    `[MCP ${connection.serverName}] Failed to parse SSE data:`,
                    data,
                    parseError
                  )
                }
              }
            }
          }

          // 继续读取下一块
          processChunk()
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      }

      processChunk()
    })
  }

  /**
   * 处理接收到的消息
   */
  private processMessages(connection: MCPServerConnection): void {
    const lines = connection.messageBuffer.split('\n')
    connection.messageBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message: MCPMessage = JSON.parse(line)
        this.handleMessage(connection, message)
      } catch (error) {
        console.error(`[MCP ${connection.serverName}] Failed to parse message:`, line, error)
      }
    }
  }

  /**
   * 处理单个 JSON-RPC 消息
   */
  private handleMessage(connection: MCPServerConnection, message: MCPMessage): void {
    connection.lastActivity = Date.now()

    if (message.id !== undefined) {
      // 响应消息
      const pending = connection.pendingRequests.get(message.id)
      if (pending) {
        connection.pendingRequests.delete(message.id)

        if (message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message.result)
        }
      }
    } else if (message.method) {
      // 通知消息
      console.log(`[MCP ${connection.serverName}] Notification:`, message.method)
    }
  }

  /**
   * 启动 OAuth 授权流程
   */
  async startAuth(serverId: string): Promise<boolean> {
    try {
      const server = await this.getServerById(serverId)
      if (!server) {
        throw new Error(`Server ${serverId} not found`)
      }

      const config = server.configJson as unknown as MCPConfig
      if (!('url' in config)) {
        throw new Error('只有 HTTP MCP 服务器支持 OAuth 授权')
      }

      console.log(`[MCP] 🔐 启动 ${server.name} 的 OAuth 授权流程...`)
      const success = await this.oauthService.startAuthFlow(serverId, config.url)

      if (success) {
        console.log(`[MCP] ✅ ${server.name} 授权成功`)
      }

      return success
    } catch (error) {
      console.error('[MCP] OAuth 授权失败:', error)
      throw error
    }
  }

  /**
   * 清除 OAuth 授权
   */
  async clearAuth(serverId: string): Promise<void> {
    try {
      // 先断开连接
      if (this.connections.has(serverId)) {
        await this.disconnect(serverId)
      }

      await this.oauthService.clearAuth(serverId)
      console.log(`[MCP] 🗑️  已清除 OAuth 授权`)
    } catch (error) {
      console.error('[MCP] 清除授权失败:', error)
      throw error
    }
  }
}
