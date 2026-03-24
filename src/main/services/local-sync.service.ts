import { getDatabase } from '../database/client'
import { agentMemories, agentTodos, projects } from '../database/schema.sqlite'
import { eq } from 'drizzle-orm'

function getDb() {
  return getDatabase()
}

/**
 * 本地数据合并服务（简化版）
 * 处理同一设备上不同用户之间的数据合并
 */
export class LocalSyncService {
  private static instance: LocalSyncService

  private constructor() {}

  static getInstance(): LocalSyncService {
    if (!LocalSyncService.instance) {
      LocalSyncService.instance = new LocalSyncService()
    }
    return LocalSyncService.instance
  }

  /**
   * 合并两个用户的数据
   * @param fromUserId 源用户（当前默认用户）
   * @param toUserId 目标用户（登录的账号）
   * @param strategy 合并策略
   */
  async mergeUsers(
    fromUserId: string,
    toUserId: string,
    strategy: 'keep_both' | 'prefer_local' | 'prefer_cloud' = 'keep_both'
  ): Promise<MergeResult> {
    const result: MergeResult = {
      memoriesAdded: 0,
      memoriesUpdated: 0,
      memoriesSkipped: 0,
      projectsAdded: 0,
      projectsUpdated: 0,
      projectsSkipped: 0,
      conflicts: {
        hasConflicts: false,
        memories: [],
        projects: []
      }
    }

    try {
      console.log('[LocalSyncService] Starting merge:', { fromUserId, toUserId, strategy })

      // 1. 获取源用户的数据
      const fromMemories = await getDb()
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.userId, fromUserId))

      const fromProjects = await getDb()
        .select()
        .from(projects)
        .where(eq(projects.userId, fromUserId))

      // 2. 获取目标用户的数据
      const toMemories = await getDb()
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.userId, toUserId))

      const toProjects = await getDb().select().from(projects).where(eq(projects.userId, toUserId))

      // 3. 合并记忆
      for (const memory of fromMemories) {
        const conflict = toMemories.find(
          (m) => m.title.toLowerCase() === memory.title.toLowerCase()
        )

        if (!conflict) {
          // 无冲突，直接转移
          await getDb()
            .update(agentMemories)
            .set({ userId: toUserId })
            .where(eq(agentMemories.id, memory.id))
          result.memoriesAdded++
        } else {
          // 有冲突
          result.conflicts.hasConflicts = true
          result.conflicts.memories.push({
            local: memory,
            cloud: conflict,
            type: 'duplicate_title'
          })

          switch (strategy) {
            case 'keep_both':
              // 重命名并保留
              await getDb()
                .update(agentMemories)
                .set({
                  userId: toUserId,
                  title: `${memory.title} (from ${memory.userId.substring(0, 8)})`
                })
                .where(eq(agentMemories.id, memory.id))
              result.memoriesAdded++
              break

            case 'prefer_local':
              // 保留源用户的，覆盖目标用户的
              await getDb()
                .update(agentMemories)
                .set({
                  content: memory.content,
                  importance: memory.importance,
                  updatedAt: new Date().toISOString()
                })
                .where(eq(agentMemories.id, conflict.id))
              result.memoriesUpdated++
              // 删除源记忆
              await getDb().delete(agentMemories).where(eq(agentMemories.id, memory.id))
              break

            case 'prefer_cloud':
              // 保留目标用户的，删除源用户的
              await getDb().delete(agentMemories).where(eq(agentMemories.id, memory.id))
              result.memoriesSkipped++
              break
          }
        }
      }

      // 4. 合并项目
      for (const project of fromProjects) {
        const conflict = toProjects.find((p) => p.path === project.path)

        if (!conflict) {
          // 无冲突，直接转移
          await getDb()
            .update(projects)
            .set({ userId: toUserId })
            .where(eq(projects.id, project.id))
          result.projectsAdded++
        } else {
          // 项目冲突：通常是同一项目，合并元数据
          result.conflicts.hasConflicts = true
          result.conflicts.projects.push({
            local: project,
            cloud: conflict,
            type: 'duplicate_path'
          })

          // 合并元数据（取较新的）
          await getDb()
            .update(projects)
            .set({
              projectType: project.projectType || conflict.projectType,
              framework: project.framework || conflict.framework,
              isIndexed: Math.max(project.isIndexed || 0, conflict.isIndexed || 0),
              lastIndexedAt: project.lastIndexedAt || conflict.lastIndexedAt
            })
            .where(eq(projects.id, conflict.id))
          result.projectsUpdated++

          // 删除源项目
          await getDb().delete(projects).where(eq(projects.id, project.id))
        }
      }

      // 5. 转移任务（任务通常按会话隔离，直接转移）
      await getDb()
        .update(agentTodos)
        .set({ userId: toUserId })
        .where(eq(agentTodos.userId, fromUserId))

      console.log('[LocalSyncService] Merge completed:', result)
      return result
    } catch (error) {
      console.error('[LocalSyncService] Merge failed:', error)
      throw error
    }
  }

  /**
   * 获取用户数据统计
   */
  async getUserStats(userId: string): Promise<{
    memories: number
    projects: number
    todos: number
  }> {
    const memories = await getDb()
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.userId, userId))

    const userProjects = await getDb().select().from(projects).where(eq(projects.userId, userId))

    const todos = await getDb().select().from(agentTodos).where(eq(agentTodos.userId, userId))

    return {
      memories: memories.length,
      projects: userProjects.length,
      todos: todos.length
    }
  }
}

// 类型定义
export interface MergeResult {
  memoriesAdded: number
  memoriesUpdated: number
  memoriesSkipped: number
  projectsAdded: number
  projectsUpdated: number
  projectsSkipped: number
  conflicts: {
    hasConflicts: boolean
    memories: Array<{
      local: any
      cloud: any
      type: string
    }>
    projects: Array<{
      local: any
      cloud: any
      type: string
    }>
  }
}
