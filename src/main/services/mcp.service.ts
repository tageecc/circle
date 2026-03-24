import { getDatabase, getSchema } from '../database/client'
import type { MCPServer, NewMCPServer } from '../database/schema.sqlite'
import { eq } from 'drizzle-orm'

export class MCPService {
  static async getAllServers(): Promise<MCPServer[]> {
    const db = getDatabase()
    const { mcpServers } = getSchema()
    return (await db.select().from(mcpServers as any)) as MCPServer[]
  }

  static async getServerById(id: string): Promise<MCPServer | undefined> {
    const db = getDatabase()
    const { mcpServers } = getSchema()
    const result = (await db
      .select()
      .from(mcpServers as any)
      .where(eq(mcpServers.id, id))) as MCPServer[]
    return result[0]
  }

  static async createServer(server: NewMCPServer): Promise<MCPServer> {
    const db = getDatabase()
    const { mcpServers } = getSchema()
    const result = (await db
      .insert(mcpServers as any)
      .values(server)
      .returning()) as MCPServer[]
    return result[0]!
  }

  static async updateServer(id: string, server: Partial<NewMCPServer>): Promise<MCPServer> {
    const db = getDatabase()
    const { mcpServers } = getSchema()
    const result = (await db
      .update(mcpServers as any)
      .set({ ...server, updatedAt: new Date().toISOString() })
      .where(eq(mcpServers.id, id))
      .returning()) as MCPServer[]
    return result[0]!
  }

  static async deleteServer(id: string): Promise<void> {
    const db = getDatabase()
    const { mcpServers } = getSchema()
    await db.delete(mcpServers as any).where(eq(mcpServers.id, id))
  }

  /**
   * 更新服务器状态
   */
  static async updateServerStatus(
    id: string,
    status: 'connected' | 'disconnected' | 'error'
  ): Promise<MCPServer> {
    return this.updateServer(id, { status })
  }

  /**
   * 更新服务器工具列表
   */
  static async updateServerTools(id: string, tools: string[]): Promise<MCPServer> {
    return this.updateServer(id, { tools: JSON.stringify(tools) })
  }

  /**
   * 初始化默认 MCP 服务器（已废弃，请使用 npm run db:seed）
   */
  static async initializeDefaultServers(): Promise<void> {
    // 不再自动创建默认服务器
    // 使用 npm run db:seed 来创建示例数据
    console.log('ℹ️  MCP Servers: Use "npm run db:seed" to initialize sample servers')
  }
}
