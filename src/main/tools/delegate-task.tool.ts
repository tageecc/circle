/**
 * Spawn a focused sub-agent run with bounded steps in the same process.
 * Uses the native agent loop only (same execution model as main chat).
 */

import { z } from 'zod'
import { nanoid } from 'nanoid'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import type { CircleToolSet } from '../types/circle-tool-set'
import { getToolContext, type ToolContext } from '../services/tool-context'
import { getCoreTools } from '../assistant/core-tools'
import { MCPService } from '../services/mcp.service'
import { attachTaskRunRuntime, registerTaskRun, updateTaskRun } from '../agent/task-run-registry'
import { logHarnessEvent } from '../services/agent-harness-telemetry'
import { wrapToolsForExclusiveSerialization } from './wrap-tools-execution'
import { defineTool } from './define-tool'
import {
  canUseNativeAgentLoop,
  runNativeAgentLoop,
  type NativeAgentStreamPart
} from '../agent/native'
import { stripReasoningFromModelMessages } from '../agent/native/strip-reasoning-messages'
import {
  type SubagentType,
  getSubagentSystemPrompt,
  getSubagentDefinition,
  isValidSubagentType
} from '../agent/subagent-types'
import { sendToRenderer } from '../utils/ipc'
import type { ConfigService } from '../services/config.service'

function getSubagentTools(): CircleToolSet {
  const core = getCoreTools()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ask_user, ...rest } = core
  const mcp = MCPService.getInstance().getAISDKTools()
  return wrapToolsForExclusiveSerialization({ ...rest, ...mcp })
}

interface DelegateState {
  text: string
  rounds: number
  toolCalls: number
  filesRead: number
  searches: number
  edits: number
  terminalError?: string
}

function accumulateDelegateOutput(part: NativeAgentStreamPart, state: DelegateState): void {
  if (part.type === 'start-step') state.rounds += 1
  if (part.type === 'text-delta' && typeof part.text === 'string') state.text += part.text
  if (part.type === 'tool-call') {
    state.toolCalls += 1
    const toolName = part.toolName || ''
    if (toolName === 'read_file') state.filesRead += 1
    if (toolName === 'grep' || toolName === 'codebase_search' || toolName === 'glob_file_search')
      state.searches += 1
    if (toolName === 'edit_file') state.edits += 1
  }
  if (part.type === 'error') {
    state.terminalError = part.error instanceof Error ? part.error.message : String(part.error)
  }
}

function getRendererTarget(ctx: ToolContext): { webContentsId: number } | undefined {
  return typeof ctx.senderWebContentsId === 'number'
    ? { webContentsId: ctx.senderWebContentsId }
    : undefined
}

interface ExecuteDelegateParams {
  taskId: string
  task: string
  subagentType: SubagentType
  subagentDef: ReturnType<typeof getSubagentDefinition>
  maxSteps: number
  ctx: ToolContext
  config: ConfigService
  modelId: string
  tools: CircleToolSet
  subCtx: ToolContext
  prompt: string
  t0: number
  isBackground: boolean
  abortSignal?: AbortSignal
}

/**
 * Core execution logic for delegate tasks (shared by sync and background modes)
 */
async function executeDelegateTask(params: ExecuteDelegateParams): Promise<DelegateState> {
  const {
    taskId,
    task,
    subagentType,
    subagentDef,
    maxSteps,
    ctx,
    config,
    modelId,
    tools,
    subCtx,
    prompt,
    t0,
    isBackground,
    abortSignal
  } = params

  const state: DelegateState = {
    text: '',
    rounds: 0,
    toolCalls: 0,
    filesRead: 0,
    searches: 0,
    edits: 0
  }

  const systemPrompt = getSubagentSystemPrompt(subagentType)
  let lastProgressUpdate = 0
  const rendererTarget = getRendererTarget(ctx)

  try {
    for await (const part of runNativeAgentLoop({
      modelId,
      configService: config,
      systemPrompt,
      initialMessages: [{ role: 'user', content: prompt }],
      tools,
      toolContext: subCtx,
      temperature: config.getTemperature(),
      maxSteps,
      abortSignal,
      prepareStepMessages: stripReasoningFromModelMessages
    })) {
      accumulateDelegateOutput(part, state)

      const now = Date.now()
      if (part.type === 'tool-call' && now - lastProgressUpdate > 1000) {
        lastProgressUpdate = now
        sendToRenderer(
          'delegate:progress',
          {
            taskId,
            sessionId: ctx.sessionId,
            filesExplored: state.filesRead,
            searches: state.searches,
            edits: state.edits,
            toolCalls: state.toolCalls,
            currentOperation: part.toolName || undefined
          },
          rendererTarget
        )

        updateTaskRun(taskId, {
          progress: {
            filesExplored: state.filesRead,
            searches: state.searches,
            edits: state.edits,
            toolCalls: state.toolCalls
          },
          currentOperation: part.toolName || undefined
        })
      }
    }

    const durationMs = Date.now() - t0

    updateTaskRun(taskId, {
      status: 'completed',
      resultSummary: state.text?.slice(0, 2_000),
      completedAt: Date.now(),
      durationMs,
      progress: {
        filesExplored: state.filesRead,
        searches: state.searches,
        edits: state.edits,
        toolCalls: state.toolCalls
      }
    })

    sendToRenderer(
      'delegate:complete',
      {
        taskId,
        sessionId: ctx.sessionId,
        status: 'completed',
        result: state.text?.slice(0, 500),
        durationMs,
        progress: {
          filesExplored: state.filesRead,
          searches: state.searches,
          edits: state.edits,
          toolCalls: state.toolCalls
        }
      },
      rendererTarget
    )

    if (isBackground) {
      sendToRenderer('system:notification', {
        title: 'Sub-agent Task Completed',
        body: `${subagentDef.name}: ${task.slice(0, 80)}${task.length > 80 ? '...' : ''}`,
        sound: true
      })
    }

    logHarnessEvent('agent.delegate_task_done', {
      ms: durationMs,
      steps: state.rounds
    })

    return state
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    const durationMs = Date.now() - t0
    const wasStopped = abortSignal?.aborted === true
    const finalStatus = wasStopped ? 'stopped' : 'failed'
    const finalSummary = wasStopped ? 'Stopped by user request' : errorMsg

    updateTaskRun(taskId, {
      status: finalStatus,
      resultSummary: finalSummary,
      completedAt: Date.now(),
      durationMs
    })

    sendToRenderer(
      'delegate:complete',
      {
        taskId,
        sessionId: ctx.sessionId,
        status: finalStatus,
        ...(wasStopped ? { result: finalSummary } : { error: errorMsg }),
        durationMs,
        progress: {
          filesExplored: state.filesRead,
          searches: state.searches,
          edits: state.edits,
          toolCalls: state.toolCalls
        }
      },
      rendererTarget
    )

    if (isBackground && !wasStopped) {
      sendToRenderer('system:notification', {
        title: 'Sub-agent Task Failed',
        body: `${subagentDef.name}: ${errorMsg.slice(0, 80)}`,
        sound: true
      })
    }

    logHarnessEvent('agent.delegate_task_failed', {
      message: errorMsg.slice(0, 200)
    })

    throw e
  }
}

/**
 * Execute delegate task in background (async, non-blocking)
 */
async function executeInBackground(
  taskId: string,
  task: string,
  subagentType: SubagentType,
  subagentDef: ReturnType<typeof getSubagentDefinition>,
  maxSteps: number,
  ctx: ToolContext,
  config: ConfigService,
  modelId: string,
  tools: CircleToolSet,
  subCtx: ToolContext,
  prompt: string,
  t0: number,
  abortSignal: AbortSignal
): Promise<void> {
  await executeDelegateTask({
    taskId,
    task,
    subagentType,
    subagentDef,
    maxSteps,
    ctx,
    config,
    modelId,
    tools,
    subCtx,
    prompt,
    t0,
    isBackground: true,
    abortSignal
  })
}

const inputSchema = z.object({
  task: z.string().min(1).describe('Clear task description for the sub-agent.'),
  context: z
    .string()
    .optional()
    .describe('Optional extra context (paths, constraints) — keep short.'),
  subagent_type: z
    .enum(['general', 'review', 'test', 'security', 'refactor', 'explore', 'fix'])
    .optional()
    .default('general')
    .describe(
      'Type of specialized agent: general (default), review (code review), test (write tests), security (security audit), refactor (improve code structure), explore (understand codebase), fix (debug and fix issues)'
    ),
  max_steps: z
    .number()
    .int()
    .min(4)
    .max(128)
    .optional()
    .describe('Maximum agent steps (tool rounds). Default 64.'),
  run_in_background: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, run the sub-agent task in the background. The tool will return immediately with task_id, and you can check status using task_get or task_list. Completion will be notified via system notification.'
    )
})

export const delegateTaskTool = defineTool({
  description: `Delegate a self-contained sub-task to a specialized bounded agent (separate tool loop, same workspace).

**When to use:**
- Code review, security audit, or testing tasks
- Large explorations or research that would clutter the main thread
- Isolated refactors or bug fixes
- Tasks requiring focused, specialized expertise

**Subagent types:**
- \`general\` - General-purpose coding tasks (default)
- \`review\` - Code review for bugs, best practices, and quality
- \`security\` - Security audit for vulnerabilities and risks
- \`test\` - Write comprehensive test cases
- \`refactor\` - Improve code structure without changing behavior
- \`explore\` - Understand and document codebase structure
- \`fix\` - Debug and fix specific issues

**Parameters:**
- \`subagent_type\` - Choose the right specialist for the task
- \`max_steps\` (4–128, default 64) - Caps tool rounds

The JSON result includes \`steps_used\`, \`tool_calls\`, and a \`warning\` if the loop ended with an error.

**Important:** Do NOT nest delegate_task. Prefer direct tools for simple one-off reads.`,
  inputSchema,
  execute: async (
    {
      task,
      context,
      subagent_type,
      max_steps: maxStepsArg,
      run_in_background
    }: z.infer<typeof inputSchema>,
    options: ToolCallOptions
  ) => {
    const ctx = getToolContext(options) as ToolContext
    if ((ctx.delegateDepth ?? 0) >= 1) {
      return JSON.stringify({
        success: false,
        error: 'Nested delegate_task is not allowed.'
      })
    }

    // Validate and get subagent type
    const subagentType = (subagent_type || 'general') as SubagentType
    if (!isValidSubagentType(subagentType)) {
      return JSON.stringify({
        success: false,
        error: `Invalid subagent_type: ${subagent_type}. Must be one of: general, review, test, security, refactor, explore, fix.`
      })
    }

    const taskId = nanoid()
    const description = task.slice(0, 200)
    const subagentDef = getSubagentDefinition(subagentType)
    const t0 = Date.now()
    try {
      const { getConfigService } = await import('../index.js')
      const config = getConfigService()
      const modelId = ctx.modelId
      if (!modelId) {
        throw new Error('modelId missing from tool context')
      }

      if (!canUseNativeAgentLoop(modelId, config)) {
        return JSON.stringify({
          success: false,
          error: `No provider credentials for native agent (model: ${modelId}). Configure this provider in Model Settings.`
        })
      }

      const prompt = context ? `${task}\n\nContext:\n${context}` : task
      const maxSteps = maxStepsArg ?? 64
      const executionAbortController = run_in_background ? new AbortController() : undefined
      const executionAbortSignal = executionAbortController?.signal ?? ctx.abortSignal

      const subCtx: ToolContext = {
        ...ctx,
        abortSignal: executionAbortSignal,
        delegateDepth: 1
      }

      const tools = getSubagentTools()

      registerTaskRun(
        {
          id: taskId,
          parentSessionId: ctx.sessionId,
          description,
          createdAt: Date.now(),
          status: 'running',
          background: run_in_background,
          subagentType,
          subagentName: subagentDef.name,
          startedAt: Date.now(),
          progress: {
            filesExplored: 0,
            searches: 0,
            edits: 0,
            toolCalls: 0
          }
        },
        executionAbortController ? { abortController: executionAbortController } : undefined
      )

      sendToRenderer(
        'delegate:start',
        {
          taskId,
          sessionId: ctx.sessionId,
          description,
          subagentType,
          subagentName: subagentDef.name,
          icon: subagentDef.icon,
          color: subagentDef.color
        },
        getRendererTarget(ctx)
      )

      // If background execution is requested, launch async and return immediately
      if (run_in_background) {
        const completionPromise = executeInBackground(
          taskId,
          task,
          subagentType,
          subagentDef,
          maxSteps,
          ctx,
          config,
          modelId,
          tools,
          subCtx,
          prompt,
          t0,
          executionAbortSignal as AbortSignal
        ).catch((err) => {
          console.error('[delegate-task] Background execution failed:', err)
        })
        attachTaskRunRuntime(taskId, { completionPromise })

        return JSON.stringify({
          success: true,
          task_id: taskId,
          subagent_type: subagentType,
          subagent_name: subagentDef.name,
          background: true,
          message: 'Task started in background. Use task_get or task_list to check progress.'
        })
      }

      // Execute synchronously
      const state = await executeDelegateTask({
        taskId,
        task,
        subagentType,
        subagentDef,
        maxSteps,
        ctx,
        config,
        modelId,
        tools,
        subCtx,
        prompt,
        t0,
        isBackground: false,
        abortSignal: executionAbortSignal
      })

      const durationMs = Date.now() - t0

      return JSON.stringify({
        success: true,
        task_id: taskId,
        subagent_type: subagentType,
        subagent_name: subagentDef.name,
        summary: state.text ?? '(no text)',
        steps_used: state.rounds,
        tool_calls: state.toolCalls,
        max_steps: maxSteps,
        duration_ms: durationMs,
        statistics: {
          files_explored: state.filesRead,
          searches: state.searches,
          edits: state.edits
        },
        ...(state.terminalError
          ? {
              warning: state.terminalError,
              note: 'The sub-agent loop reported a terminal error (often max steps). The summary above may be partial; retry with a narrower task or increase max_steps.'
            }
          : {})
      })
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      return JSON.stringify({
        success: false,
        error: errorMsg
      })
    }
  }
})
