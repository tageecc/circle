/**
 * Spawn a focused sub-agent run (Claude Code AgentTool / runAgent parity — same process, bounded steps).
 * Uses generateText + tool loop; no nested delegate_task or ask_user (avoids HITL deadlock in sub-context).
 */

import { tool, generateText, stepCountIs } from 'ai'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { getToolContext, type ToolContext } from '../services/tool-context'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { createLanguageModel } from '../utils/model-factory'
import { getCoreTools } from '../assistant/core-tools'
import { MCPService } from '../services/mcp.service'
import { registerTaskRun, updateTaskRun } from '../agent/task-run-registry'
import { logHarnessEvent } from '../services/agent-harness-telemetry'
import { wrapToolsForExclusiveSerialization } from './wrap-tools-execution'

const SUBAGENT_SYSTEM = `You are a focused coding sub-agent. Complete the assigned task using tools.
Be concise in your final summary. Do not call delegate_task or ask the user questions.`

function getSubagentTools() {
  const core = getCoreTools()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ask_user, ...rest } = core
  const mcp = MCPService.getInstance().getAISDKTools()
  return wrapToolsForExclusiveSerialization({ ...rest, ...mcp })
}

const inputSchema = z.object({
  task: z.string().min(1).describe('Clear task description for the sub-agent.'),
  context: z
    .string()
    .optional()
    .describe('Optional extra context (paths, constraints) — keep short.')
})

export const delegateTaskTool = tool({
  description: `Delegate a self-contained sub-task to a bounded agent run (separate tool loop, same workspace).
Use for: large explorations, parallelizable research, or isolated refactors that would clutter the main thread.
Do NOT nest delegate_task inside a sub-result. Prefer direct tools for simple one-off reads.`,
  inputSchema,
  execute: async (
    { task, context }: z.infer<typeof inputSchema>,
    options: ToolCallOptions
  ) => {
    const ctx = getToolContext(options) as ToolContext
    if ((ctx.delegateDepth ?? 0) >= 1) {
      return {
        success: false,
        error: 'Nested delegate_task is not allowed.'
      }
    }

    const taskId = nanoid()
    const description = task.slice(0, 200)
    registerTaskRun({
      id: taskId,
      parentSessionId: ctx.sessionId,
      description,
      createdAt: Date.now(),
      status: 'running'
    })

    const t0 = Date.now()
    try {
      const { getConfigService } = await import('../index.js')
      const config = getConfigService()
      const modelId = ctx.modelId
      if (!modelId) {
        throw new Error('modelId missing from tool context')
      }

      const prompt = context ? `${task}\n\nContext:\n${context}` : task

      const subCtx: ToolContext = {
        ...ctx,
        delegateDepth: 1
      }

      const result = await generateText({
        model: createLanguageModel(modelId, config),
        system: SUBAGENT_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        tools: getSubagentTools(),
        stopWhen: stepCountIs(32),
        temperature: config.getTemperature(),
        maxRetries: 1,
        experimental_context: subCtx,
        abortSignal: ctx.abortSignal
      })

      const text = result.text
      const stepCount = result.steps?.length ?? 0

      updateTaskRun(taskId, {
        status: 'completed',
        resultSummary: text?.slice(0, 2_000)
      })

      logHarnessEvent('agent.delegate_task_done', {
        ms: Date.now() - t0,
        steps: stepCount
      })

      return {
        success: true,
        task_id: taskId,
        summary: text ?? '(no text)',
        steps_used: stepCount
      }
    } catch (e) {
      updateTaskRun(taskId, {
        status: 'failed',
        resultSummary: e instanceof Error ? e.message : String(e)
      })
      logHarnessEvent('agent.delegate_task_failed', {
        message: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)
      })
      return {
        success: false,
        task_id: taskId,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
})
