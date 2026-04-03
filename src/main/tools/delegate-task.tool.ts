/**
 * Spawn a focused sub-agent run (Claude Code AgentTool / runAgent parity — same process, bounded steps).
 * Same routing as main chat: native loop when enabled and credentials exist, otherwise streamText.
 */

import { z } from 'zod'
import { nanoid } from 'nanoid'
import { streamText, stepCountIs } from 'ai'
import type { TextStreamPart, ToolSet } from 'ai'
import type { Tool, ToolCallOptions } from '@ai-sdk/provider-utils'
import { getToolContext, type ToolContext } from '../services/tool-context'
import { getCoreTools } from '../assistant/core-tools'
import { MCPService } from '../services/mcp.service'
import { registerTaskRun, updateTaskRun } from '../agent/task-run-registry'
import { logHarnessEvent } from '../services/agent-harness-telemetry'
import { wrapToolsForExclusiveSerialization } from './wrap-tools-execution'
import { defineTool } from './define-tool'
import {
  canUseNativeAgentLoop,
  nativeAgentLoopEnabled,
  runNativeAgentLoop,
  type NativeAgentStreamPart
} from '../agent/native'
import { stripReasoningFromModelMessages } from '../agent/native/strip-reasoning-messages'
import { createLanguageModel } from '../utils/model-factory'

const SUBAGENT_SYSTEM = `You are a focused coding sub-agent. Complete the assigned task using tools.
Be concise in your final summary. Do not call delegate_task or ask the user questions.`

function getSubagentTools(): Record<string, Tool> {
  const core = getCoreTools()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ask_user, ...rest } = core
  const mcp = MCPService.getInstance().getAISDKTools()
  return wrapToolsForExclusiveSerialization({ ...rest, ...mcp })
}

type DelegateStreamPart = NativeAgentStreamPart | TextStreamPart<Record<string, never>>

function accumulateDelegateOutput(
  part: DelegateStreamPart,
  state: { text: string; rounds: number }
): void {
  if (part.type === 'start-step') state.rounds += 1
  if (part.type === 'text-delta' && typeof part.text === 'string') state.text += part.text
}

const inputSchema = z.object({
  task: z.string().min(1).describe('Clear task description for the sub-agent.'),
  context: z
    .string()
    .optional()
    .describe('Optional extra context (paths, constraints) — keep short.')
})

export const delegateTaskTool = defineTool({
  description: `Delegate a self-contained sub-task to a bounded agent run (separate tool loop, same workspace).
Use for: large explorations, parallelizable research, or isolated refactors that would clutter the main thread.
Do NOT nest delegate_task inside a sub-result. Prefer direct tools for simple one-off reads.`,
  inputSchema,
  execute: async ({ task, context }: z.infer<typeof inputSchema>, options: ToolCallOptions) => {
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

      const tools = getSubagentTools()
      const state = { text: '', rounds: 0 }

      const useNative = nativeAgentLoopEnabled(config) && canUseNativeAgentLoop(modelId, config)

      if (useNative) {
        for await (const part of runNativeAgentLoop({
          modelId,
          configService: config,
          systemPrompt: SUBAGENT_SYSTEM,
          initialMessages: [{ role: 'user', content: prompt }],
          tools,
          toolContext: subCtx,
          temperature: config.getTemperature(),
          maxSteps: 32,
          abortSignal: ctx.abortSignal,
          prepareStepMessages: stripReasoningFromModelMessages
        })) {
          accumulateDelegateOutput(part, state)
        }
      } else {
        const stream = streamText({
          model: createLanguageModel(modelId, config),
          system: SUBAGENT_SYSTEM,
          messages: [{ role: 'user', content: prompt }],
          tools: tools as ToolSet,
          stopWhen: stepCountIs(32),
          maxRetries: 2,
          temperature: config.getTemperature(),
          experimental_context: subCtx,
          abortSignal: ctx.abortSignal,
          prepareStep: ({ messages }) => ({
            messages: stripReasoningFromModelMessages(messages)
          })
        })
        for await (const part of stream.fullStream) {
          accumulateDelegateOutput(part as DelegateStreamPart, state)
        }
      }

      updateTaskRun(taskId, {
        status: 'completed',
        resultSummary: state.text?.slice(0, 2_000)
      })

      logHarnessEvent('agent.delegate_task_done', {
        ms: Date.now() - t0,
        steps: state.rounds
      })

      return {
        success: true,
        task_id: taskId,
        summary: state.text ?? '(no text)',
        steps_used: state.rounds
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
