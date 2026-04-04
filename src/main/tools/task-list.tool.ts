/**
 * Task List Tool - List all delegate tasks for the current session
 */

import { z } from 'zod'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { getToolContext } from '../services/tool-context'
import { listTaskRunsForSession } from '../agent/task-run-registry'

const inputSchema = z.object({
  status: z
    .enum(['pending', 'running', 'completed', 'failed', 'all'])
    .optional()
    .default('all')
    .describe('Filter tasks by status. Default: all')
})

export const taskListTool = defineTool({
  description: `List all delegate tasks for the current session.

Shows information about sub-agent tasks that have been created via delegate_task, including:
- Task ID and description
- Status (pending, running, completed, failed)
- Creation time
- Result summary (for completed tasks)

Use this to:
- Check status of running background tasks
- Review completed delegate work
- Get task IDs for use with task_get

You can filter by status: pending, running, completed, failed, or all (default).`,

  inputSchema,

  execute: async ({ status }, options: ToolCallOptions) => {
    const ctx = getToolContext(options)
    const allTasks = listTaskRunsForSession(ctx.sessionId)

    // Filter by status if specified
    const filteredTasks = status === 'all' ? allTasks : allTasks.filter((t) => t.status === status)

    if (filteredTasks.length === 0) {
      return JSON.stringify({
        success: true,
        count: 0,
        message:
          status === 'all'
            ? 'No delegate tasks found for this session.'
            : `No ${status} delegate tasks found.`,
        tasks: []
      })
    }

    // Format tasks for output
    const formattedTasks = filteredTasks.map((task) => {
      const now = Date.now()
      const age = Math.floor((now - task.createdAt) / 1000)
      const ageStr =
        age < 60
          ? `${age}s`
          : age < 3600
            ? `${Math.floor(age / 60)}m`
            : `${Math.floor(age / 3600)}h`

      return {
        id: task.id,
        description: task.description,
        status: task.status,
        age: ageStr,
        result: task.resultSummary ? task.resultSummary.slice(0, 200) : undefined
      }
    })

    return JSON.stringify({
      success: true,
      count: filteredTasks.length,
      tasks: formattedTasks,
      summary: `Found ${filteredTasks.length} ${status === 'all' ? '' : status + ' '}task(s).`
    })
  }
})
