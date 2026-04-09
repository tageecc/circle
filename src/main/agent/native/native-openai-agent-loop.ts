/**
 * Native agent loop implementation: OpenAI-compatible chat.completions + tool rounds (no `ai` package).
 */

import type {
  AssistantModelMessage,
  ModelMessage,
  TextPart,
  ToolCallPart,
  ToolExecutionOptions,
  ToolResultPart
} from '@ai-sdk/provider-utils'
import type { CircleToolSet } from '../../types/circle-tool-set'
import type { OpenAICompatibleEndpoint } from './resolve-openai-endpoint'
import { modelMessagesToOpenAIChat } from './model-messages-to-openai'
import { stripReasoningFromModelMessages } from './strip-reasoning-messages'
import { toolsToOpenAIFunctions } from './openai-tool-definitions'
import { parseOpenAIChatCompletionSSE } from './openai-sse'
import type { ToolContext } from '../../services/tool-context'
import type { NativeAgentStreamPart } from './native-agent-stream-parts'
import { toolOutputToResultPart } from './tool-output-part'
import { debugLogger } from '../../services/debug-logger.service'
import { AGENT_HARNESS } from '../../constants/service.constants'
import { abortSignalForNativeChatFetch } from './merge-abort-signal'
import { lastPreparedMessageRole } from './model-message-helpers'

export type NativeOpenAILoopOptions = {
  endpoint: OpenAICompatibleEndpoint
  systemPrompt: string
  initialMessages: ModelMessage[]
  tools: CircleToolSet
  toolContext: ToolContext
  temperature: number
  maxSteps: number
  abortSignal?: AbortSignal
  prepareStepMessages?: (messages: ModelMessage[]) => ModelMessage[]
}

export async function* runNativeOpenAIAgentLoop(
  options: NativeOpenAILoopOptions
): AsyncGenerator<NativeAgentStreamPart, void, undefined> {
  const {
    endpoint,
    systemPrompt,
    tools,
    toolContext,
    temperature,
    maxSteps,
    abortSignal,
    prepareStepMessages
  } = options

  let working: ModelMessage[] = [...options.initialMessages]
  let cumulativeIn = 0
  let cumulativeOut = 0
  const prepare = prepareStepMessages ?? ((m: ModelMessage[]) => stripReasoningFromModelMessages(m))

  const trace = (record: Record<string, unknown>): Promise<void> =>
    debugLogger.logNativeAgentTrace(toolContext.sessionId, { provider: 'openai', ...record })

  let round = 0
  while (round < maxSteps) {
    round += 1
    yield { type: 'start-step', request: {} }

    let lengthRecoveries = 0
    let softNudgesThisRound = 0
    let fr = 'stop'
    let assistantText = ''
    const toolCallAcc = new Map<number, { id?: string; name?: string; args: string }>()
    let usageChunk:
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined
    let lastFinish: string | undefined
    let reasoningOpen = false

    requestLoop: while (true) {
      toolCallAcc.clear()
      assistantText = ''
      lastFinish = undefined
      usageChunk = undefined
      reasoningOpen = false

      const stepMessages = prepare(working)
      const openaiMessages = modelMessagesToOpenAIChat(stepMessages)
      const toolDefs = await toolsToOpenAIFunctions(tools)

      await trace({
        phase: 'openai_round_start',
        round,
        maxSteps,
        model: endpoint.model,
        stepMessageCount: stepMessages.length,
        lengthRecoveries,
        softNudgesThisRound
      })

      const url = `${endpoint.baseURL.replace(/\/$/, '')}/chat/completions`
      const body: Record<string, unknown> = {
        model: endpoint.model,
        messages: [{ role: 'system', content: systemPrompt }, ...openaiMessages],
        tools: toolDefs,
        tool_choice: 'auto',
        stream: true,
        temperature,
        max_tokens: AGENT_HARNESS.OPENAI_MAX_COMPLETION_TOKENS
      }
      body.stream_options = { include_usage: true }

      await trace({ phase: 'openai_fetch_start', round, url: url.replace(/\?.*$/, '') })

      const fetchSignal = abortSignalForNativeChatFetch(abortSignal)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (endpoint.apiKey) {
        headers.Authorization = `Bearer ${endpoint.apiKey}`
      }

      let res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: fetchSignal
      })

      if (!res.ok && res.status === 400) {
        const errText = await res.text()
        const retryBody: Record<string, unknown> = { ...body }
        if (errText.includes('stream_options') || errText.includes('Unknown parameter')) {
          delete retryBody.stream_options
          res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(retryBody),
            signal: fetchSignal
          })
        }
        if (!res.ok && res.status === 400) {
          const err2 = await res.text()
          if (
            retryBody.max_tokens != null &&
            (err2.includes('max_tokens') ||
              err2.includes('max_completion') ||
              err2.includes('Unknown parameter'))
          ) {
            delete retryBody.max_tokens
            res = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(retryBody),
              signal: fetchSignal
            })
          }
        }
      }

      if (!res.ok) {
        const t = await res.text()
        await trace({
          phase: 'openai_fetch_error',
          round,
          status: res.status,
          bodyPreview: t.slice(0, 500)
        })
        throw new Error(`Native agent HTTP ${res.status}: ${t}`)
      }

      for await (const json of parseOpenAIChatCompletionSSE(res.body, abortSignal)) {
        if (json.error) {
          const err = json.error as { message?: string }
          throw new Error(err.message || JSON.stringify(json.error))
        }
        const u = json.usage as typeof usageChunk | undefined
        if (u) usageChunk = u

        const choices = json.choices as Array<Record<string, unknown>> | undefined
        if (!choices?.length) continue

        const choice = choices[0]
        const delta = choice.delta as Record<string, unknown> | undefined
        const frChunk = choice.finish_reason as string | null | undefined
        if (frChunk) lastFinish = frChunk ?? undefined

        if (delta?.content) {
          const c = String(delta.content)
          assistantText += c
          yield { type: 'text-delta', text: c }
        }

        const rc = (delta?.reasoning_content ?? delta?.reasoning) as string | undefined
        if (rc && typeof rc === 'string') {
          if (!reasoningOpen) {
            reasoningOpen = true
            yield { type: 'reasoning-start' }
          }
          yield { type: 'reasoning-delta', text: rc }
        }

        const tcd = delta?.tool_calls as Array<Record<string, unknown>> | undefined
        if (tcd) {
          for (const tc of tcd) {
            const idx = typeof tc.index === 'number' ? tc.index : 0
            if (!toolCallAcc.has(idx)) toolCallAcc.set(idx, { args: '' })
            const acc = toolCallAcc.get(idx)!
            const id = tc.id as string | undefined
            if (id) acc.id = id
            const fn = tc.function as { name?: string; arguments?: string } | undefined
            if (fn?.name) acc.name = fn.name
            if (fn?.arguments) acc.args += fn.arguments
          }
        }
      }

      if (reasoningOpen) {
        yield { type: 'reasoning-end' }
        reasoningOpen = false
      }

      if (usageChunk) {
        cumulativeIn += usageChunk.prompt_tokens ?? 0
        cumulativeOut += usageChunk.completion_tokens ?? 0
      }

      fr = lastFinish ?? 'stop'

      const toolCallAccSummary = [...toolCallAcc.entries()].map(([index, e]) => ({
        index,
        id: e.id,
        name: e.name,
        argsLen: e.args.length
      }))

      await trace({
        phase: 'openai_sse_done',
        round,
        lastFinishFromStream: lastFinish ?? null,
        effectiveFinishReason: fr,
        assistantTextChars: assistantText.length,
        toolCallSlots: toolCallAccSummary,
        usageLastChunk: usageChunk ?? null
      })

      if (fr === 'length') {
        if (lengthRecoveries >= AGENT_HARNESS.MAX_OUTPUT_LENGTH_RECOVERIES) {
          await trace({ phase: 'openai_length_recovery_exhausted', round, lengthRecoveries })
          break requestLoop
        }
        lengthRecoveries += 1
        await trace({ phase: 'openai_length_recovery', round, attempt: lengthRecoveries })
        if (assistantText) {
          working = [
            ...working,
            {
              role: 'assistant',
              content: [{ type: 'text', text: assistantText }]
            } as ModelMessage
          ]
        }
        working = [
          ...working,
          {
            role: 'user',
            content: [{ type: 'text', text: 'Continue.' }]
          } as ModelMessage
        ]
        continue requestLoop
      }

      if (
        fr === 'stop' &&
        toolCallAcc.size === 0 &&
        assistantText.length > 0 &&
        lastPreparedMessageRole(stepMessages) === 'tool' &&
        softNudgesThisRound < AGENT_HARNESS.POST_TOOL_SOFT_NUDGE_MAX_PER_ROUND
      ) {
        softNudgesThisRound += 1
        await trace({ phase: 'openai_soft_nudge', round, nudgeIndex: softNudgesThisRound })
        working = [
          ...working,
          {
            role: 'assistant',
            content: [{ type: 'text', text: assistantText }]
          } as ModelMessage,
          {
            role: 'user',
            content: [{ type: 'text', text: 'Continue.' }]
          } as ModelMessage
        ]
        continue requestLoop
      }

      break requestLoop
    }

    const toolCallAccSummary = [...toolCallAcc.entries()].map(([index, e]) => ({
      index,
      id: e.id,
      name: e.name,
      argsLen: e.args.length
    }))

    if (fr === 'stop' || fr === 'length' || fr === 'content_filter') {
      await trace({
        phase: 'openai_yield_finish',
        round,
        reason: 'stop_length_or_filter',
        rawFinishReason: fr
      })
      yield {
        type: 'finish',
        finishReason: fr === 'stop' ? 'stop' : 'length',
        rawFinishReason: fr,
        totalUsage: {
          inputTokens: cumulativeIn,
          outputTokens: cumulativeOut,
          totalTokens: cumulativeIn + cumulativeOut
        }
      }
      return
    }

    if (fr !== 'tool_calls') {
      await trace({
        phase: 'openai_yield_finish',
        round,
        reason: 'unknown_finish_reason',
        rawFinishReason: fr
      })
      yield {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: fr,
        totalUsage: {
          inputTokens: cumulativeIn,
          outputTokens: cumulativeOut,
          totalTokens: cumulativeIn + cumulativeOut
        }
      }
      return
    }

    const indices = [...toolCallAcc.keys()].sort((a, b) => a - b)
    const completed: Array<{ id: string; name: string; args: string }> = []
    for (const i of indices) {
      const e = toolCallAcc.get(i)
      if (!e?.id || !e.name) continue
      completed.push({ id: e.id, name: e.name, args: e.args })
    }

    if (completed.length === 0) {
      await trace({
        phase: 'openai_error',
        round,
        error: 'finish_reason tool_calls but no completed tool calls parsed',
        toolCallSlots: toolCallAccSummary
      })
      yield { type: 'error', error: new Error('finish_reason tool_calls but no tool calls parsed') }
      return
    }

    await trace({
      phase: 'openai_tool_calls',
      round,
      tools: completed.map((c) => c.name)
    })

    const messagesForToolExec = prepare(working)

    const assistantContent: Array<TextPart | ToolCallPart> = []
    if (assistantText) {
      assistantContent.push({ type: 'text', text: assistantText })
    }

    const parsedCalls: Array<{ id: string; name: string; input: unknown }> = []
    for (const c of completed) {
      let input: unknown
      try {
        input = c.args.trim() ? JSON.parse(c.args) : {}
      } catch {
        input = { raw: c.args }
      }
      parsedCalls.push({ id: c.id, name: c.name, input })
      assistantContent.push({
        type: 'tool-call',
        toolCallId: c.id,
        toolName: c.name,
        input
      })
    }

    const assistantMsg: AssistantModelMessage = {
      role: 'assistant',
      content: assistantContent
    }
    working = [...working, assistantMsg as ModelMessage]

    for (const c of parsedCalls) {
      yield {
        type: 'tool-call',
        toolCallId: c.id,
        toolName: c.name,
        input: c.input,
        dynamic: true
      }

      const tool = tools[c.name]
      if (!tool || typeof tool.execute !== 'function') {
        yield {
          type: 'tool-error',
          toolCallId: c.id,
          toolName: c.name,
          input: c.input,
          error: new Error(`Unknown or non-executable tool: ${c.name}`),
          dynamic: true
        }
        working = [
          ...working,
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: c.id,
                toolName: c.name,
                output: {
                  type: 'error-text',
                  value: `Unknown or non-executable tool: ${c.name}`
                }
              }
            ]
          } as ModelMessage
        ]
        continue
      }

      const execOpts: ToolExecutionOptions = {
        toolCallId: c.id,
        messages: messagesForToolExec,
        abortSignal,
        experimental_context: toolContext
      }

      try {
        const output = await (
          tool.execute as (inp: unknown, o: ToolExecutionOptions) => Promise<unknown>
        )(c.input, execOpts)
        yield {
          type: 'tool-result',
          toolCallId: c.id,
          toolName: c.name,
          input: c.input,
          output,
          dynamic: true
        }

        const tr: ToolResultPart = {
          type: 'tool-result',
          toolCallId: c.id,
          toolName: c.name,
          output: toolOutputToResultPart(output)
        }
        working = [
          ...working,
          {
            role: 'tool',
            content: [tr]
          } as ModelMessage
        ]
        await trace({
          phase: 'openai_tool_done',
          round,
          toolName: c.name,
          ok: true,
          outputType: typeof output
        })
      } catch (err) {
        yield {
          type: 'tool-error',
          toolCallId: c.id,
          toolName: c.name,
          input: c.input,
          error: err,
          dynamic: true
        }
        const msg = err instanceof Error ? err.message : String(err)
        working = [
          ...working,
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: c.id,
                toolName: c.name,
                output: { type: 'error-text', value: msg }
              }
            ]
          } as ModelMessage
        ]
        await trace({
          phase: 'openai_tool_done',
          round,
          toolName: c.name,
          ok: false,
          error: msg
        })
      }
    }

    await trace({ phase: 'openai_round_tools_done', round })
  }

  await trace({ phase: 'openai_max_steps_exceeded', maxSteps })
  yield { type: 'error', error: new Error('Native agent: max steps exceeded') }
}
