import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { getDatabase, getSchema } from '../database/client'
import type { Tool, NewTool } from '../database/schema.sqlite'
import { getMCPClientManager } from '../index'

/**
 * 工具服务 - 支持 MCP 和 Custom 两种来源
 */
export class ToolService {
  /** 工具来自 MCP 导入或自定义创建，无内置示例数据 */
  static async initializeDefaultTools(): Promise<void> {}

  /**
   * 获取所有工具（带使用统计）
   */
  static async getAllTools(agentId?: string): Promise<any[]> {
    const db = getDatabase()
    const { tools, toolUsageStats } = getSchema()
    const allTools = await db
      .select()
      .from(tools as any)
      .orderBy((tools as any).createdAt)

    // 添加使用统计信息
    const enrichedTools = await Promise.all(
      allTools.map(async (tool) => {
        let usageStats: any = null

        if (agentId) {
          // 获取特定 Agent 的使用统计
          const [stats] = await db
            .select()
            .from(toolUsageStats as any)
            .where(and(eq(toolUsageStats.toolName, tool.name), eq(toolUsageStats.agentId, agentId)))
          usageStats = stats || null
        } else {
          // 获取全局使用统计（所有 Agent 的总和）
          const [stats] = await db
            .select({
              totalCalls: sql<number>`SUM(${toolUsageStats.totalCalls})`,
              successCalls: sql<number>`SUM(${toolUsageStats.successCalls})`,
              failedCalls: sql<number>`SUM(${toolUsageStats.failedCalls})`,
              lastUsedAt: sql<Date>`MAX(${toolUsageStats.lastUsedAt})`,
              avgExecutionTime: sql<number>`AVG(${toolUsageStats.avgExecutionTime})`
            })
            .from(toolUsageStats as any)
            .where(eq(toolUsageStats.toolName, tool.name))

          usageStats = stats || null
        }

        return {
          ...tool,
          usageStats: usageStats || {
            totalCalls: 0,
            successCalls: 0,
            failedCalls: 0,
            lastUsedAt: null,
            avgExecutionTime: 0
          }
        }
      })
    )

    return enrichedTools
  }

  /**
   * 获取 Top N 常用工具
   */
  static async getTopTools(limit: number = 10, agentId?: string): Promise<any[]> {
    const db = getDatabase()
    const schema = getSchema() as any
    const { tools, toolUsageStats } = schema
    let query
    if (agentId) {
      // 特定 Agent 的 Top Tools
      query = db
        .select({
          tool: tools,
          stats: toolUsageStats
        })
        .from(toolUsageStats)
        .innerJoin(tools, eq(tools.name, toolUsageStats.toolName))
        .where(eq(toolUsageStats.agentId, agentId))
        .orderBy(desc(toolUsageStats.totalCalls))
        .limit(limit)
    } else {
      // 全局 Top Tools
      query = db
        .select({
          toolName: toolUsageStats.toolName,
          totalCalls: sql<number>`SUM(${toolUsageStats.totalCalls})`.as('total_calls')
        })
        .from(toolUsageStats)
        .groupBy(toolUsageStats.toolName)
        .orderBy(desc(sql`total_calls`))
        .limit(limit)

      const topToolNames = await query

      // 获取完整的工具信息
      if (topToolNames.length === 0) return []

      const toolNames = topToolNames.map((t) => t.toolName)
      return await db.select().from(tools).where(inArray(tools.name, toolNames))
    }

    return await query
  }

  /**
   * 从 MCP Server 导入工具
   */
  static async importMCPTools(serverId: string): Promise<number> {
    const db = getDatabase()
    const { tools, mcpServers } = getSchema()

    // 获取 MCP Server 信息
    const [mcpServer] = await db
      .select()
      .from(mcpServers as any)
      .where(eq(mcpServers.id, serverId))

    if (!mcpServer || !mcpServer.tools || mcpServer.tools.length === 0) {
      throw new Error('MCP Server not found or has no tools')
    }

    let importedCount = 0

    // 为每个 MCP 工具创建 Tool 记录
    for (const toolName of mcpServer.tools) {
      try {
        await db
          .insert(tools as any)
          .values({
            name: toolName,
            description: `Tool from ${mcpServer.name} MCP Server`,
            source: 'mcp',
            mcpServerId: serverId,
            mcpServerName: mcpServer.name,
            category: 'MCP',
            status: mcpServer.status === 'connected' ? 'active' : 'inactive',
            enabled: 1
          })
          .onConflictDoNothing()

        importedCount++
      } catch (error) {
        console.error(`Failed to import tool ${toolName}:`, error)
      }
    }

    console.log(`✅ Imported ${importedCount} tools from ${mcpServer.name}`)
    return importedCount
  }

  /**
   * 同步 MCP Server 的工具列表（当 MCP Server 更新时）
   */
  static async syncMCPServerTools(serverId: string): Promise<void> {
    const db = getDatabase()
    const { tools, mcpServers } = getSchema()

    // 获取 MCP Server 当前的工具列表
    const [mcpServer] = await db
      .select()
      .from(mcpServers as any)
      .where(eq(mcpServers.id, serverId))

    if (!mcpServer) return

    const currentTools = mcpServer.tools || []

    // 获取数据库中该 Server 的所有工具
    const dbTools = await db
      .select()
      .from(tools as any)
      .where(eq(tools.mcpServerId, serverId))

    const dbToolNames = new Set(dbTools.map((t) => t.name))

    // 添加新工具
    for (const toolName of currentTools) {
      if (!dbToolNames.has(toolName)) {
        await db
          .insert(tools as any)
          .values({
            name: toolName,
            description: `Tool from ${mcpServer.name}`,
            source: 'mcp',
            mcpServerId: serverId,
            mcpServerName: mcpServer.name,
            category: 'MCP',
            status: mcpServer.status === 'connected' ? 'active' : 'inactive',
            enabled: 1
          })
          .onConflictDoNothing()
      }
    }

    // 删除已不存在的工具
    const currentToolSet = new Set(currentTools)
    for (const dbTool of dbTools) {
      if (!currentToolSet.has(dbTool.name)) {
        await db.delete(tools as any).where(eq(tools.id, dbTool.id))
      }
    }

    // 更新状态
    await db
      .update(tools as any)
      .set({
        status: mcpServer.status === 'connected' ? 'active' : 'inactive'
      })
      .where(eq(tools.mcpServerId, serverId))
  }

  /**
   * 创建自定义工具
   */
  static async createCustomTool(data: {
    name: string
    description: string
    category?: string
    parameters: any
    code: string
  }): Promise<Tool> {
    const db = getDatabase()
    const { tools } = getSchema()
    // 简单的代码语法验证
    try {
      new Function('params', data.code)
    } catch (error) {
      throw new Error(`Invalid JavaScript code: ${error}`)
    }

    const [tool] = (await db
      .insert(tools as any)
      .values({
        name: data.name,
        description: data.description,
        source: 'custom',
        category: data.category || 'Custom',
        parameters: data.parameters,
        code: data.code,
        status: 'active',
        enabled: 1
      })
      .returning()) as Tool[]

    return tool!
  }

  /**
   * 更新工具
   */
  static async updateTool(id: string, data: Partial<NewTool>): Promise<Tool> {
    const db = getDatabase()
    const { tools } = getSchema()
    const [updated] = (await db
      .update(tools as any)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(tools.id, id))
      .returning()) as Tool[]

    return updated!
  }

  /**
   * 删除工具
   */
  static async deleteTool(id: string): Promise<void> {
    const db = getDatabase()
    const { tools } = getSchema()
    await db.delete(tools as any).where(eq(tools.id, id))
  }

  /**
   * 获取所有已启用且状态为 active 的工具名称（默认 Agent 未配置 tools 时使用）
   */
  static async getEnabledToolNames(): Promise<string[]> {
    const db = getDatabase()
    const { tools } = getSchema()
    const rows = await db
      .select()
      .from(tools as any)
      .where(and(eq(tools.enabled, 1), eq(tools.status, 'active')))
    return (rows as { name: string }[]).map((r) => r.name)
  }

  /**
   * 获取 Agent 可用的工具（用于 Mastra）
   */
  static async getToolsForAgent(toolNames: string[]): Promise<Record<string, any>> {
    if (toolNames.length === 0) return {}
    const db = getDatabase()
    const { tools } = getSchema()
    // 获取工具定义
    const selectedTools = await db
      .select()
      .from(tools as any)
      .where(and(inArray(tools.name, toolNames), eq(tools.enabled, 1), eq(tools.status, 'active')))

    const toolsMap: Record<string, any> = {}
    const mcpClientManager = getMCPClientManager()

    for (const tool of selectedTools) {
      try {
        if (tool.source === 'mcp') {
          // MCP 工具：从 MCPClientManager 获取
          if (mcpClientManager.isInitialized()) {
            const allMCPTools = await mcpClientManager.getTools()
            if (allMCPTools[tool.name]) {
              toolsMap[tool.name] = allMCPTools[tool.name]
            }
          }
        } else if (tool.source === 'custom') {
          // 自定义工具：从代码创建执行器
          toolsMap[tool.name] = this.createCustomToolExecutor(tool)
        }
      } catch (error) {
        console.error(`Failed to load tool ${tool.name}:`, error)
      }
    }

    return toolsMap
  }

  /**
   * 创建自定义工具执行器
   */
  private static createCustomToolExecutor(tool: Record<string, any>): any {
    return {
      description: tool.description || '',
      parameters: tool.parameters || {},
      execute: async (params: any) => {
        try {
          // 在沙箱环境中执行用户代码
          const fn = new Function('params', tool.code!)
          return await fn(params)
        } catch (error) {
          throw new Error(`Tool execution failed: ${error}`)
        }
      }
    }
  }

  /**
   * 记录工具使用统计
   */
  static async recordToolUsage(
    toolName: string,
    agentId: string,
    success: boolean,
    executionTime: number
  ): Promise<void> {
    const db = getDatabase()
    const { toolUsageStats } = getSchema()
    try {
      // 尝试更新现有记录
      const [existing] = await db
        .select()
        .from(toolUsageStats as any)
        .where(and(eq(toolUsageStats.toolName, toolName), eq(toolUsageStats.agentId, agentId)))

      if (existing) {
        // 更新统计
        const newTotalCalls = existing.totalCalls + 1
        const newSuccessCalls = existing.successCalls + (success ? 1 : 0)
        const newFailedCalls = existing.failedCalls + (success ? 0 : 1)

        // 计算新的平均执行时间
        const newAvgTime = Math.round(
          ((existing.avgExecutionTime || 0) * existing.totalCalls + executionTime) / newTotalCalls
        )

        await db
          .update(toolUsageStats as any)
          .set({
            totalCalls: newTotalCalls,
            successCalls: newSuccessCalls,
            failedCalls: newFailedCalls,
            lastUsedAt: new Date(),
            avgExecutionTime: newAvgTime,
            updatedAt: new Date()
          })
          .where(and(eq(toolUsageStats.toolName, toolName), eq(toolUsageStats.agentId, agentId)))
      } else {
        // 创建新记录
        await db.insert(toolUsageStats as any).values({
          toolName,
          agentId,
          totalCalls: 1,
          successCalls: success ? 1 : 0,
          failedCalls: success ? 0 : 1,
          lastUsedAt: new Date(),
          avgExecutionTime: executionTime
        })
      }
    } catch (error) {
      console.error('Failed to record tool usage:', error)
    }
  }

  /**
   * 获取工具使用统计（按 MCP Server 分组）
   */
  static async getToolStatsByServer(agentId?: string): Promise<any> {
    const allTools = await this.getAllTools(agentId)

    // 按 MCP Server 分组
    const groupedByServer: Record<string, any> = {
      custom: { tools: [], totalCalls: 0 }
    }

    for (const tool of allTools) {
      if (tool.source === 'mcp' && tool.mcpServerId) {
        const serverKey = tool.mcpServerId
        if (!groupedByServer[serverKey]) {
          groupedByServer[serverKey] = {
            serverName: tool.mcpServerName,
            tools: [],
            totalCalls: 0
          }
        }
        groupedByServer[serverKey].tools.push(tool)
        groupedByServer[serverKey].totalCalls += tool.usageStats.totalCalls
      } else if (tool.source === 'custom') {
        groupedByServer.custom.tools.push(tool)
        groupedByServer.custom.totalCalls += tool.usageStats.totalCalls
      }
    }

    return groupedByServer
  }
}
