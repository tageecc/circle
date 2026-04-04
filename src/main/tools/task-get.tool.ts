/**
 * Task Get Tool - Get detailed information about a specific task
 */

import { z } from 'zod'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { getTaskRun } from '../agent/task-run-registry'

const inputSchema = z.object({
  task_id: z.string().describe('The ID of the task to retrieve (from delegate_task or task_list)')
})

export const taskGetTool = defineTool({
  description: `Get detailed information about a specific delegate task by ID.

Returns complete information about a sub-agent task, including:
- Task description and status
- Creation time and duration
- Full result summary (for completed tasks)
- Error details (for failed tasks)

Use this to:
- Check detailed results of a completed task
- Get the full output from a delegate agent
- Understand why a task failed

Get the task_id from:
- The result of delegate_task (task_id field)
- The output of task_list`,

  inputSchema,

  execute: async ({ task_id }, _options: ToolCallOptions) => {
    const task = getTaskRun(task_id)

    if (!task) {
      return JSON.stringify({
        success: false,
        error: `Task ${task_id} not found. Use task_list to see available tasks.`
      })
    }

    const now = Date.now()
    const age = Math.floor((now - task.createdAt) / 1000)
    const ageStr =
      age < 60
        ? `${age}s ago`
        : age < 3600
          ? `${Math.floor(age / 60)}m ago`
          : `${Math.floor(age / 3600)}h ago`

    return JSON.stringify({
      success: true,
      task: {
        id: task.id,
        description: task.description,
        status: task.status,
        created_at: new Date(task.createdAt).toISOString(),
        age: ageStr,
        result: task.resultSummary || null
      }
    })
  }
})
