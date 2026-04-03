/**
 * Claude Code–style agent loop without Vercel streamText: OpenAI-compatible chat.completions + tool rounds.
 */

import type {
  AssistantModelMessage,
  ModelMessage,
  TextPart,
  Tool,
  ToolCallPart,
  ToolExecutionOptions,
  ToolResultPart
} from '@ai-sdk/provider-utils'
import type { OpenAICompatibleEndpoint } from './resolve-openai-endpoint'
import { modelMessagesToOpenAIChat } from './model-messages-to-openai'
import { stripReasoningFromModelMessages } from './strip-reasoning-messages'
import { toolsToOpenAIFunctions } from './openai-tool-definitions'
import { parseOpenAIChatCompletionSSE } from './openai-sse'
import type { JSONValue } from '@ai-sdk/provider'
import type { ToolContext } from '../../services/tool-context'

export type NativeOpenAILoopOptions = {
  endpoint: OpenAICompatibleEndpoint
  systemPrompt: string
  initialMessages: ModelMessage[]
  tools: Record<string, Tool | Record<string, unknown>>
  toolContext: ToolContext
  temperature: number
  maxSteps: number
  abortSignal?: AbortSignal
  prepareStepMessages?: (messages: ModelMessage[]) => ModelMessage[]
}

type StreamPart = Record<string, unknown>

function toolOutputToResultPart(output: unknown): ToolResultPart['output'] {
  if (typeof output === 'string') {
    return { type: 'text', value: output }
  }
  return { type: 'json', value: output as JSONValue }
}

export async function* runNativeOpenAIAgentLoop(
  options: NativeOpenAILoopOptions
): AsyncGenerator<StreamPart> {
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

  let round = 0
  while (round < maxSteps) {
    round += 1
    yield { type: 'start-step', request: {} }
    const stepMessages = prepare(working)
    const openaiMessages = modelMessagesToOpenAIChat(stepMessages)
    const toolDefs = await toolsToOpenAIFunctions(tools)

    const url = `${endpoint.baseURL.replace(/\/$/, '')}/chat/completions`
    const body: Record<string, unknown> = {
      model: endpoint.model,
      messages: [{ role: 'system', content: systemPrompt }, ...openaiMessages],
      tools: toolDefs,
      tool_choice: 'auto',
      stream: true,
      temperature
    }
    body.stream_options = { include_usage: true }

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: abortSignal
    })

    if (!res.ok && res.status === 400) {
      const errText = await res.text()
      if (errText.includes('stream_options') || errText.includes('Unknown parameter')) {
        const retryBody = { ...body }
        delete retryBody.stream_options
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${endpoint.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(retryBody),
          signal: abortSignal
        })
      }
    }

    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Native agent HTTP ${res.status}: ${t}`)
    }

    let assistantText = ''
    const toolCallAcc = new Map<number, { id?: string; name?: string; args: string }>()
    let lastFinish: string | undefined
    let usageChunk:
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined
    let reasoningOpen = false

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
      const fr = choice.finish_reason as string | null | undefined
      if (fr) lastFinish = fr ?? undefined

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
    }

    if (usageChunk) {
      cumulativeIn += usageChunk.prompt_tokens ?? 0
      cumulativeOut += usageChunk.completion_tokens ?? 0
    }

    const fr = lastFinish ?? 'stop'
    if (fr === 'stop' || fr === 'length' || fr === 'content_filter') {
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
      yield { type: 'error', error: new Error('finish_reason tool_calls but no tool calls parsed') }
      return
    }

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
        messages: stepMessages,
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
      }
    }
  }

  yield { type: 'error', error: new Error('Native agent: max steps exceeded') }
}
