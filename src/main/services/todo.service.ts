import { getDatabase } from '../database/client'
import { agentTodos, type AgentTodo, type NewAgentTodo } from '../database/schema.sqlite'
import { eq, and } from 'drizzle-orm'

function getDb() {
  return getDatabase()
}

/**
 * 任务管理服务
 * 负责管理 Agent 的任务列表
 */
export class TodoService {
  private static instance: TodoService

  private constructor() {}

  static getInstance(): TodoService {
    if (!TodoService.instance) {
      TodoService.instance = new TodoService()
    }
    return TodoService.instance
  }

  /**
   * 合并 Todos（更新现有 + 添加新的）
   */
  async mergeTodos(
    sessionId: string,
    projectId: string | null,
    agentId: string | null,
    todos: Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    }>
  ): Promise<AgentTodo[]> {
    const results: AgentTodo[] = []

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i]

      // 检查是否已存在
      const [existing] = await getDb()
        .select()
        .from(agentTodos)
        .where(and(eq(agentTodos.sessionId, sessionId), eq(agentTodos.todoId, todo.id)))
        .limit(1)

      if (existing) {
        // 更新现有 todo
        const [updated] = await getDb()
          .update(agentTodos)
          .set({
            content: todo.content,
            status: todo.status,
            order: i,
            updatedAt: new Date().toISOString()
          })
          .where(eq(agentTodos.id, existing.id))
          .returning()

        results.push(updated)
      } else {
        // 创建新 todo
        const [created] = await getDb()
          .insert(agentTodos)
          .values({
            sessionId,
            projectId,
            agentId,
            todoId: todo.id,
            content: todo.content,
            status: todo.status,
            order: i,
            metadata: null
          })
          .returning()

        results.push(created)
      }
    }

    console.log(`[TodoService] Merged ${results.length} todos for session: ${sessionId}`)
    return results
  }

  /**
   * 替换 Todos（删除旧的 + 创建新的）
   */
  async replaceTodos(
    sessionId: string,
    projectId: string | null,
    agentId: string | null,
    todos: Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    }>
  ): Promise<AgentTodo[]> {
    // 删除该会话的所有旧 todos
    await getDb().delete(agentTodos).where(eq(agentTodos.sessionId, sessionId))

    // 创建新 todos
    const newTodos: NewAgentTodo[] = todos.map((todo, index) => ({
      sessionId,
      projectId,
      agentId,
      todoId: todo.id,
      content: todo.content,
      status: todo.status,
      order: index,
      metadata: null
    }))

    const created = await getDb().insert(agentTodos).values(newTodos).returning()

    console.log(`[TodoService] Replaced todos for session: ${sessionId}`, created.length)
    return created
  }

  /**
   * 获取会话的所有 Todos
   */
  async getTodos(sessionId: string): Promise<AgentTodo[]> {
    const todos = await getDb()
      .select()
      .from(agentTodos)
      .where(eq(agentTodos.sessionId, sessionId))
      .orderBy(agentTodos.order)

    return todos
  }

  /**
   * 删除会话的所有 Todos
   */
  async clearTodos(sessionId: string): Promise<void> {
    await getDb().delete(agentTodos).where(eq(agentTodos.sessionId, sessionId))

    console.log(`[TodoService] Cleared todos for session: ${sessionId}`)
  }
}
