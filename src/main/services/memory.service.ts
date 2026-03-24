import { getDatabase } from '../database/client'
import { agentMemories, type AgentMemory } from '../database/schema.sqlite'
import { eq } from 'drizzle-orm'

function getDb() {
  return getDatabase()
}

/**
 * 记忆管理服务
 * 负责管理 Agent 的长期记忆
 */
export class MemoryService {
  private static instance: MemoryService

  private constructor() {}

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService()
    }
    return MemoryService.instance
  }

  /**
   * 创建新记忆
   */
  async createMemory(data: {
    title: string
    content: string
    projectId?: string | null
    agentId?: string | null
    scope?: string
    importance?: number
  }): Promise<AgentMemory> {
    const [created] = await getDb()
      .insert(agentMemories)
      .values({
        title: data.title,
        content: data.content,
        projectId: data.projectId ?? null,
        agentId: data.agentId ?? null,
        scope: data.scope ?? 'global',
        importance: data.importance ?? 5,
        accessCount: 0,
        metadata: null
      })
      .returning()

    console.log('[MemoryService] Memory created:', created.id)
    return created
  }

  /**
   * 更新记忆
   */
  async updateMemory(
    memoryId: string,
    data: {
      title?: string
      content?: string
      importance?: number
    }
  ): Promise<AgentMemory> {
    const [updated] = await getDb()
      .update(agentMemories)
      .set({
        ...data,
        updatedAt: new Date().toISOString()
      })
      .where(eq(agentMemories.id, memoryId))
      .returning()

    if (!updated) {
      throw new Error(`Memory not found: ${memoryId}`)
    }

    console.log('[MemoryService] Memory updated:', memoryId)
    return updated
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const result = await getDb()
      .delete(agentMemories)
      .where(eq(agentMemories.id, memoryId))
      .returning()

    if (result.length === 0) {
      throw new Error(`Memory not found: ${memoryId}`)
    }

    console.log('[MemoryService] Memory deleted:', memoryId)
  }

  /**
   * 获取记忆
   */
  async getMemory(memoryId: string): Promise<AgentMemory | null> {
    const [memory] = await getDb()
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.id, memoryId))
      .limit(1)

    if (memory) {
      // 更新访问计数
      await getDb()
        .update(agentMemories)
        .set({
          accessCount: (memory.accessCount || 0) + 1,
          lastAccessedAt: new Date().toISOString()
        })
        .where(eq(agentMemories.id, memoryId))
    }

    return memory || null
  }

  /**
   * 获取所有记忆
   */
  async getAllMemories(filters?: {
    agentId?: string
    projectId?: string
    minImportance?: number
  }): Promise<AgentMemory[]> {
    // 构建查询条件
    const conditions: any[] = []

    if (filters?.agentId) {
      conditions.push(eq(agentMemories.agentId, filters.agentId))
    }
    if (filters?.projectId) {
      conditions.push(eq(agentMemories.projectId, filters.projectId))
    }

    let query = getDb().select().from(agentMemories)

    if (conditions.length > 0) {
      const { and } = await import('drizzle-orm')
      query = query.where(and(...conditions)) as any
    }

    const memories = await query

    // 前端过滤最小重要性（数据库索引无需优化）
    if (filters?.minImportance) {
      return memories.filter((m) => (m.importance || 0) >= filters.minImportance!)
    }

    return memories
  }
}
