import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { getToolContext } from '../services/tool-context'
import { SessionService } from '../services/session.service'
import { sendToRenderer } from '../utils/ipc'
/**
 * Todo 类型在主进程中需要定义
 * 因为 todo-write 工具在主进程运行，需要访问 Todo 类型
 */

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: number
  updatedAt: number
}

const todoSchema = z.object({
  id: z.string().describe('Unique identifier for the todo item'),
  content: z.string().max(70).describe('Task description (max 70 characters)'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .describe('Current status of the task')
})

const inputSchema = z.object({
  merge: z
    .boolean()
    .describe('Whether to merge with existing todos (true) or replace them (false)'),
  todos: z.array(todoSchema).min(1).describe('Array of todo items to create or update')
})

/**
 * Todo Write Tool
 * 管理任务列表，追踪复杂任务的进度
 */
export const todoWriteTool = defineTool({
  description: `Create and manage a structured task list for complex coding tasks. Helps organize work, track progress, and ensure nothing is forgotten.

### When to Use This Tool

Use todo_write when:
- **Complex multi-step tasks** (3+ distinct steps)
- **Non-trivial features** requiring careful planning
- **User provides multiple tasks** (numbered list, comma-separated)
- **After receiving instructions** - break down requirements into actionable todos
- **After completing tasks** - mark complete and add any follow-up tasks
- **Starting new work** - mark relevant task as in_progress

### When NOT to Use

Skip todo_write for:
- **Single, straightforward tasks** (just do it)
- **Trivial operations** (no organizational benefit)
- **Tasks completable in <3 steps**
- **Purely conversational requests** (no coding work)

⚠️ **NEVER include operational tasks** like linting, testing, or examining code - only user-facing work.

### Task States

- \`pending\`: Not yet started, queued for later
- \`in_progress\`: Currently working on (ideally only ONE at a time)
- \`completed\`: Finished successfully
- \`cancelled\`: No longer needed

### Best Practices

**1. Create todos at task START**
\`\`\`typescript
// ✅ Good: Plan first, then execute
todo_write({
  merge: false,
  todos: [
    { id: '1', content: 'Add user authentication flow', status: 'in_progress' },
    { id: '2', content: 'Implement password validation', status: 'pending' },
    { id: '3', content: 'Add error handling', status: 'pending' }
  ]
})
// Then immediately start working in the same response
\`\`\`

**2. Update todos as you progress**
\`\`\`typescript
// ✅ Mark complete and start next
todo_write({
  merge: true,  // Merge with existing
  todos: [
    { id: '1', content: 'Add user authentication flow', status: 'completed' },
    { id: '2', content: 'Implement password validation', status: 'in_progress' }
  ]
})
\`\`\`

**3. Only ONE task in_progress at a time**
\`\`\`typescript
// ✅ Good: Sequential focus
{ id: '1', status: 'in_progress' },
{ id: '2', status: 'pending' }

// ❌ Bad: Multiple in progress
{ id: '1', status: 'in_progress' },
{ id: '2', status: 'in_progress' }  // Confusing!
\`\`\`

### Task Breakdown Guidelines

**Be specific and actionable**:
- ✅ "Add login form with email/password fields"
- ✅ "Implement JWT token generation"
- ✅ "Create user registration endpoint"
- ❌ "Do authentication" (too vague)
- ❌ "Fix the code" (not actionable)

**Break down by logical units**:
- By feature: authentication → validation → storage
- By file: component → service → tests
- By layer: UI → logic → API

### Examples

<example>
  User: "Add dark mode toggle to settings"
  Todos:
    1. Add theme state management [in_progress]
    2. Implement dark/light mode styles [pending]
    3. Create toggle component [pending]
    4. Update existing components [pending]
  <reasoning>
    Good: Multi-step feature, clear breakdown, start working immediately
  </reasoning>
</example>

<example>
  User: "Rename getCwd to getCurrentWorkingDirectory"
  Action: No todos needed, just use search-replace
  <reasoning>
    Bad: Simple refactoring, straightforward task, no planning needed
  </reasoning>
</example>

<example>
  User: "Optimize React app - it's rendering slowly"
  Todos:
    1. Add memoization to expensive components [in_progress]
    2. Implement virtualization for large lists [pending]
    3. Optimize image loading [pending]
    4. Fix state update loops [pending]
  <reasoning>
    Good: Complex optimization with multiple approaches, benefits from tracking
  </reasoning>
</example>

### Workflow Integration

**Typical flow**:
1. User requests complex feature
2. **Create todos** with first item \`in_progress\`
3. **Start working** immediately (in same response)
4. Complete task → **Update todo** to \`completed\`
5. Start next task → **Update todo** to \`in_progress\`
6. Repeat until all done

**Parallel tool calls**: Create todos AND start work in same response:
\`\`\`typescript
// In same tool call batch:
todo_write({ todos: [...] })  // Plan
read_file('src/auth.ts')      // Start investigating
\`\`\`

### Merge vs Replace

**merge: false** (replace)
- Starting new task
- Complete reset of plan
- User changes direction

**merge: true** (update)
- Updating progress on existing todos
- Marking tasks complete
- Adding follow-up tasks

### Important Notes

- **DON'T** create todos for operational tasks (linting, searching code)
- **DO** create todos for user-facing deliverables
- **DON'T** mention todo creation to user (just do it)
- **DO** update todos as you progress
- Keep task descriptions under 70 characters
- Use clear, specific task names
- Only one task \`in_progress\` at a time

### Deleting Todos

To remove a todo in merge mode, simply don't include it in the update:
\`\`\`typescript
// Original: [{ id: '1', ... }, { id: '2', ... }, { id: '3', ... }]
// To remove id='2':
todo_write({
  merge: true,
  todos: [
    { id: '1', content: '...', status: 'completed' },
    { id: '3', content: '...', status: 'pending' }
    // id='2' is omitted, so it will be removed
  ]
})
\`\`\``,
  inputSchema,
  execute: async ({ merge, todos }, options: ToolCallOptions) => {
    try {
      const { sessionId, senderWebContentsId } = getToolContext(options)

      // 1. 获取现有 todos（从 session metadata）
      const session = await SessionService.getSession(sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }

      const metadata = (session.metadata || {}) as Record<string, unknown>
      const existingTodos = (metadata.todos as Todo[] | undefined) || []

      // 2. 合并或替换 todos
      let updatedTodos: Todo[]

      if (merge) {
        // 合并模式：更新现有 todos
        const todoMap = new Map(existingTodos.map((t) => [t.id, t]))

        todos.forEach((newTodo) => {
          todoMap.set(newTodo.id, {
            ...newTodo,
            updatedAt: Date.now(),
            createdAt: todoMap.get(newTodo.id)?.createdAt || Date.now()
          })
        })

        updatedTodos = Array.from(todoMap.values())
      } else {
        // 替换模式：创建新的 todos
        updatedTodos = todos.map((t) => ({
          ...t,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
      }

      // 3. 持久化到数据库（session metadata）
      await SessionService.updateSessionMetadata(sessionId, {
        ...metadata,
        todos: updatedTodos
      })

      // 4. 发送到前端更新 UI
      sendToRenderer('todo:update', {
        sessionId,
        todos: updatedTodos,
        action: merge ? 'updated' : 'created'
      }, senderWebContentsId ? { webContentsId: senderWebContentsId } : undefined)

      // 5. 日志输出
      console.log(
        `[TodoWrite] ${merge ? 'Updated' : 'Created'} ${updatedTodos.length} todos for session ${sessionId}`
      )
      console.log('[TodoWrite] Tasks:')
      updatedTodos.forEach((t) => {
        const icon =
          t.status === 'completed'
            ? '✓'
            : t.status === 'in_progress'
              ? '→'
              : t.status === 'cancelled'
                ? '✗'
                : '○'
        console.log(`  ${icon} [${t.id}] ${t.content}`)
      })

      // 6. 格式化返回给 AI
      const todosList = updatedTodos
        .map((t) => {
          const icon =
            t.status === 'completed'
              ? '✅'
              : t.status === 'in_progress'
                ? '🔄'
                : t.status === 'cancelled'
                  ? '❌'
                  : '⏳'
          return `${icon} **[${t.id}]** ${t.content} - _${t.status}_`
        })
        .join('\n')

      const summary = {
        total: updatedTodos.length,
        completed: updatedTodos.filter((t) => t.status === 'completed').length,
        in_progress: updatedTodos.filter((t) => t.status === 'in_progress').length,
        pending: updatedTodos.filter((t) => t.status === 'pending').length,
        cancelled: updatedTodos.filter((t) => t.status === 'cancelled').length
      }

      return JSON.stringify({
        success: true,
        action: merge ? 'updated' : 'created',
        message: `Task list ${merge ? 'updated' : 'created'} successfully. Persisted to database.`,
        summary,
        todos: todosList,
        totalTodos: updatedTodos.length
      })
    } catch (error: unknown) {
      const err = error as Error
      console.error('[TodoWrite] Error:', err)
      return JSON.stringify({
        success: false,
        error: err.message
      })
    }
  }
})
