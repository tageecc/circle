import { z } from 'zod'

/**
 * 任务管理工具
 * 用于 Agent 创建和管理任务列表
 */
export const todoWriteTool = {
  description: `Use this tool to create and manage a structured task list for your current coding session.

When to Use:
- Complex multi-step tasks (3+ distinct steps)
- Non-trivial tasks requiring careful planning
- User explicitly requests todo list
- After receiving new instructions (use merge=false)
- After completing tasks (use merge=true)
- When starting new tasks (mark as in_progress)

When NOT to Use:
- Single, straightforward tasks
- Trivial tasks (< 3 steps)
- Purely conversational requests
- NEVER include: linting, testing, searching codebase

Task States:
- pending: Not yet started
- in_progress: Currently working on (only ONE at a time)
- completed: Finished successfully
- cancelled: No longer needed`,

  parameters: z.object({
    merge: z
      .boolean()
      .describe(
        'Whether to merge with existing todos. If true, merges based on id. If false, replaces all todos'
      ),
    todos: z
      .array(
        z.object({
          id: z.string().describe('Unique identifier for the todo item'),
          content: z.string().describe('The description/content of the todo item'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'cancelled'])
            .describe('The current status')
        })
      )
      .min(2)
      .describe('Array of todo items (minimum 2)')
  }),

  execute: async function ({
    merge,
    todos
  }: {
    merge: boolean
    todos: Array<{
      id: string
      content: string
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    }>
  }) {
    try {
      const { TodoService } = await import('../services/todo.service')
      const todoService = TodoService.getInstance()

      // 从 context 获取必要信息（由调用方注入）
      const ctx = (
        this as {
          context?: { sessionId?: string; projectId?: string; agentId?: string }
        }
      ).context
      if (!ctx?.sessionId) {
        throw new Error('Session ID is required to manage todos')
      }

      const { sessionId, projectId, agentId } = ctx

      if (merge) {
        // 合并模式：更新现有 todos
        const updated = await todoService.mergeTodos(
          sessionId,
          projectId || null,
          agentId || null,
          todos
        )
        return {
          success: true,
          mode: 'merge',
          todos: updated,
          totalCount: updated.length
        }
      } else {
        // 替换模式：替换所有 todos
        const replaced = await todoService.replaceTodos(
          sessionId,
          projectId || null,
          agentId || null,
          todos
        )
        return {
          success: true,
          mode: 'replace',
          todos: replaced,
          totalCount: replaced.length
        }
      }
    } catch (error: any) {
      throw new Error(`Todo operation failed: ${error.message}`)
    }
  }
}
