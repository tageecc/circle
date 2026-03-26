/**
 * Memory Service
 * 管理 AI 的持久化记忆
 */

import { getDb } from '../database/db'
import * as schema from '../database/schema'
import { eq, desc } from 'drizzle-orm'

export interface Memory {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export class MemoryService {
  private db = getDb().getDb()

  /**
   * 创建新记忆（自动生成 ID）
   */
  async createMemory(content: string): Promise<string> {
    const now = new Date()
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.db
      .insert(schema.memories)
      .values({
        id,
        content,
        createdAt: now,
        updatedAt: now
      })
      .run()

    console.log(`[MemoryService] Created memory: ${id}`)
    return id
  }

  /**
   * 更新记忆
   */
  async updateMemory(id: string, content: string): Promise<void> {
    const result = this.db
      .update(schema.memories)
      .set({
        content,
        updatedAt: new Date()
      })
      .where(eq(schema.memories.id, id))
      .run()

    if (result.changes === 0) {
      throw new Error(`Memory with ID "${id}" not found`)
    }

    console.log(`[MemoryService] Updated memory: ${id}`)
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<void> {
    const result = this.db.delete(schema.memories).where(eq(schema.memories.id, id)).run()

    if (result.changes === 0) {
      throw new Error(`Memory with ID "${id}" not found`)
    }

    console.log(`[MemoryService] Deleted memory: ${id}`)
  }

  /**
   * 获取所有记忆
   */
  async getAllMemories(): Promise<Memory[]> {
    const memories = this.db
      .select()
      .from(schema.memories)
      .orderBy(desc(schema.memories.updatedAt))
      .all()

    return memories.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt)
    }))
  }
}
