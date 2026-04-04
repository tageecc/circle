/**
 * task_stop: Stop a running background delegate task
 */

import { z } from 'zod'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { getTaskRun, updateTaskRun } from '../agent/task-run-registry'
import { sendToRenderer } from '../utils/ipc'
import { getToolContext } from '../services/tool-context'

const inputSchema = z.object({
  task_id: z.string().describe('The ID of the task to stop')
})

export const taskStopTool = defineTool({
  description: `Stop a running background delegate task.
  
  Use this tool when you need to:
  - Cancel a long-running background task
  - Abort a task that is no longer needed
  - Stop a task that appears to be stuck
  
  Returns:
  - success: boolean indicating if the task was stopped
  - task_id: the ID of the stopped task
  - previous_status: the status before stopping
  - note: additional information about the stop operation`,

  inputSchema,
  execute: async ({ task_id }, options: ToolCallOptions) => {
    const ctx = getToolContext(options)
    const task = getTaskRun(task_id)

    if (!task) {
      return JSON.stringify({
        success: false,
        error: `Task ${task_id} not found. Use task_list to see available tasks.`
      })
    }

    if (task.status !== 'running') {
      return JSON.stringify({
        success: false,
        error: `Task ${task_id} is not running (status: ${task.status}). Only running tasks can be stopped.`,
        current_status: task.status
      })
    }

    // Update task status to failed (stopped by user)
    updateTaskRun(task_id, {
      status: 'failed',
      resultSummary: 'Stopped by user request',
      completedAt: Date.now(),
      durationMs: task.startedAt ? Date.now() - task.startedAt : undefined
    })

    // Notify frontend
    sendToRenderer('delegate:complete', {
      taskId: task_id,
      sessionId: ctx.sessionId,
      error: 'Task stopped by user',
      durationMs: task.startedAt ? Date.now() - task.startedAt : 0
    })

    return JSON.stringify({
      success: true,
      task_id: task_id,
      previous_status: 'running',
      note: 'Task has been stopped. The task will be marked as failed with reason "Stopped by user request".'
    })
  }
})
