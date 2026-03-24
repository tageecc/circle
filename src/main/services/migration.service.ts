import { getDatabase } from '../database/client'
import { agentMemories, agentTodos } from '../database/schema.sqlite'
import { isNull, eq } from 'drizzle-orm'

function getDb() {
  return getDatabase()
}

/**
 * 数据迁移服务
 * 负责从旧版本迁移数据到新的用户体系
 */
export class MigrationService {
  private static instance: MigrationService

  private constructor() {}

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService()
    }
    return MigrationService.instance
  }

  /**
   * 迁移旧数据到当前用户
   * 检测没有 user_id 的记录，自动关联到当前用户
   */
  async migrateOldDataToCurrentUser(userId: string): Promise<{
    memoriesMigrated: number
    todosMigrated: number
  }> {
    try {
      console.log('[MigrationService] Starting data migration for user:', userId)

      // 1. 迁移 agent_memories
      const orphanMemories = await getDb()
        .select()
        .from(agentMemories)
        .where(isNull(agentMemories.userId))

      let memoriesMigrated = 0
      if (orphanMemories.length > 0) {
        for (const memory of orphanMemories) {
          await getDb()
            .update(agentMemories)
            .set({
              userId,
              scope: 'user', // 默认设置为用户级
              updatedAt: new Date().toISOString()
            })
            .where(eq(agentMemories.id, memory.id))
        }
        memoriesMigrated = orphanMemories.length
        console.log(`[MigrationService] Migrated ${memoriesMigrated} memories`)
      }

      // 2. 迁移 agent_todos
      const orphanTodos = await getDb().select().from(agentTodos).where(isNull(agentTodos.userId))

      let todosMigrated = 0
      if (orphanTodos.length > 0) {
        for (const todo of orphanTodos) {
          await getDb()
            .update(agentTodos)
            .set({
              userId,
              updatedAt: new Date().toISOString()
            })
            .where(eq(agentTodos.id, todo.id))
        }
        todosMigrated = orphanTodos.length
        console.log(`[MigrationService] Migrated ${todosMigrated} todos`)
      }

      if (memoriesMigrated > 0 || todosMigrated > 0) {
        console.log('[MigrationService] Migration completed successfully')
      } else {
        console.log('[MigrationService] No old data to migrate')
      }

      return {
        memoriesMigrated,
        todosMigrated
      }
    } catch (error) {
      console.error('[MigrationService] Migration failed:', error)
      throw error
    }
  }

  /**
   * 检查是否需要迁移
   */
  async needsMigration(): Promise<boolean> {
    try {
      // 检查是否有没有 user_id 的记录
      const [orphanMemory] = await getDb()
        .select()
        .from(agentMemories)
        .where(isNull(agentMemories.userId))
        .limit(1)

      const [orphanTodo] = await getDb()
        .select()
        .from(agentTodos)
        .where(isNull(agentTodos.userId))
        .limit(1)

      return !!(orphanMemory || orphanTodo)
    } catch (error) {
      console.error('[MigrationService] Error checking migration:', error)
      return false
    }
  }

  /**
   * 迁移特定项目的记忆到项目表
   * 用于将用户级记忆转换为项目级记忆
   */
  async migrateMemoriesToProject(
    _userId: string,
    projectId: string,
    memoryIds: string[]
  ): Promise<number> {
    try {
      let migrated = 0
      for (const memoryId of memoryIds) {
        await getDb()
          .update(agentMemories)
          .set({
            projectId,
            scope: 'project',
            updatedAt: new Date().toISOString()
          })
          .where(eq(agentMemories.id, memoryId))

        migrated++
      }

      console.log(`[MigrationService] Migrated ${migrated} memories to project ${projectId}`)
      return migrated
    } catch (error) {
      console.error('[MigrationService] Error migrating memories to project:', error)
      throw error
    }
  }
}
