/**
 * task_stop: Stop a running background delegate task
 */

import { z } from 'zod'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import {
  abortTaskRun,
  getTaskRunCompletionPromise,
  getTaskRunForSession
} from '../agent/task-run-registry'
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
    const task = getTaskRunForSession(task_id, ctx.sessionId)

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

    if (!task.background) {
      return JSON.stringify({
        success: false,
        error: `Task ${task_id} is not a background task and cannot be stopped independently.`
      })
    }

    if (!abortTaskRun(task_id)) {
      return JSON.stringify({
        success: false,
        error: `Task ${task_id} cannot be stopped because it has no active runtime controller.`
      })
    }

    await getTaskRunCompletionPromise(task_id)

    const finalTask = getTaskRunForSession(task_id, ctx.sessionId)

    return JSON.stringify({
      success: finalTask?.status === 'stopped',
      task_id: task_id,
      previous_status: 'running',
      current_status: finalTask?.status || 'stopped',
      note:
        finalTask?.status === 'stopped'
          ? 'Task stopped successfully.'
          : `Stop was requested, but the task finished with status: ${finalTask?.status || 'unknown'}.`
    })
  }
})
