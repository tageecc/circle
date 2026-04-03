/**
 * Native Anthropic Messages API streaming + tool rounds (no Vercel AI SDK).
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AssistantModelMessage,
  ModelMessage,
  TextPart,
  Tool,
  ToolCallPart,
  ToolExecutionOptions,
  ToolResultPart
} from '@ai-sdk/provider-utils'
import type { JSONValue } from '@ai-sdk/provider'
import type { ToolContext } from '../../services/tool-context'
import { modelMessagesToAnthropic } from './model-messages-to-anthropic'
import { stripReasoningFromModelMessages } from './strip-reasoning-messages'
import { toolsToAnthropicAPI } from './anthropic-tools'

export type NativeAnthropicLoopOptions = {
  apiKey: string
  model: string
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

export async function* runNativeAnthropicAgentLoop(
  options: NativeAnthropicLoopOptions
): AsyncGenerator<StreamPart> {
  const {
    apiKey,
    model,
    systemPrompt,
    tools,
    toolContext,
    temperature,
    maxSteps,
    abortSignal,
    prepareStepMessages
  } = options

  const client = new Anthropic({ apiKey })
  let working: ModelMessage[] = [...options.initialMessages]
  let cumulativeIn = 0
  let cumulativeOut = 0
  const prepare = prepareStepMessages ?? ((m: ModelMessage[]) => stripReasoningFromModelMessages(m))

  let round = 0
  while (round < maxSteps) {
    round += 1
    yield { type: 'start-step', request: {} }
    const stepMessages = prepare(working)
    const anthropicMessages = modelMessagesToAnthropic(stepMessages)
    const anthropicTools = await toolsToAnthropicAPI(tools)

    const stream = await client.messages.create({
      model,
      max_tokens: 16_384,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
      temperature,
      stream: true
    })

    let assistantText = ''
    const toolByIndex = new Map<number, { id: string; name: string; inputJson: string }>()
    let lastStopReason: string | null = null
    let reasoningOpen = false

    for await (const ev of stream) {
      switch (ev.type) {
        case 'content_block_start': {
          const block = ev.content_block
          if (block.type === 'tool_use') {
            toolByIndex.set(ev.index, { id: block.id, name: block.name, inputJson: '' })
          }
          if (block.type === 'thinking' && !reasoningOpen) {
            reasoningOpen = true
            yield { type: 'reasoning-start' }
          }
          break
        }
        case 'content_block_delta': {
          const d = ev.delta
          if (d.type === 'text_delta') {
            assistantText += d.text
            yield { type: 'text-delta', text: d.text }
          } else if (d.type === 'thinking_delta') {
            yield { type: 'reasoning-delta', text: d.thinking }
          } else if (d.type === 'input_json_delta') {
            const t = toolByIndex.get(ev.index)
            if (t) t.inputJson += d.partial_json
          }
          break
        }
        case 'message_delta': {
          if (ev.delta.stop_reason) lastStopReason = ev.delta.stop_reason
          if (ev.usage) {
            cumulativeIn += ev.usage.input_tokens ?? 0
            cumulativeOut += ev.usage.output_tokens ?? 0
          }
          break
        }
        default:
          break
      }
    }

    if (reasoningOpen) {
      yield { type: 'reasoning-end' }
    }

    const sr = lastStopReason ?? 'end_turn'
    if (sr === 'end_turn' || sr === 'max_tokens') {
      yield {
        type: 'finish',
        finishReason: sr === 'end_turn' ? 'stop' : 'length',
        rawFinishReason: sr,
        totalUsage: {
          inputTokens: cumulativeIn,
          outputTokens: cumulativeOut,
          totalTokens: cumulativeIn + cumulativeOut
        }
      }
      return
    }

    if (sr !== 'tool_use') {
      yield {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: sr,
        totalUsage: {
          inputTokens: cumulativeIn,
          outputTokens: cumulativeOut,
          totalTokens: cumulativeIn + cumulativeOut
        }
      }
      return
    }

    const parsedCalls: Array<{ id: string; name: string; input: unknown }> = []
    const indices = [...toolByIndex.keys()].sort((a, b) => a - b)
    for (const i of indices) {
      const e = toolByIndex.get(i)
      if (!e) continue
      let input: unknown = {}
      try {
        input = e.inputJson.trim() ? JSON.parse(e.inputJson) : {}
      } catch {
        input = { raw: e.inputJson }
      }
      parsedCalls.push({ id: e.id, name: e.name, input })
    }

    if (parsedCalls.length === 0) {
      yield { type: 'error', error: new Error('Anthropic stop_reason tool_use but no tool blocks') }
      return
    }

    const assistantContent: Array<TextPart | ToolCallPart> = []
    if (assistantText) {
      assistantContent.push({ type: 'text', text: assistantText })
    }
    for (const c of parsedCalls) {
      assistantContent.push({
        type: 'tool-call',
        toolCallId: c.id,
        toolName: c.name,
        input: c.input
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

  yield { type: 'error', error: new Error('Native Anthropic agent: max steps exceeded') }
}
