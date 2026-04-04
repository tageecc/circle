/**
 * Native Gemini streaming + function-call rounds (no `ai` package).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { nanoid } from 'nanoid'
import type {
  AssistantModelMessage,
  ModelMessage,
  TextPart,
  ToolCallPart,
  ToolExecutionOptions,
  ToolResultPart
} from '@ai-sdk/provider-utils'
import type { CircleToolSet } from '../../types/circle-tool-set'
import type { ToolContext } from '../../services/tool-context'
import { modelMessagesToGeminiContents } from './model-messages-to-gemini'
import { toolsToGeminiDeclarations } from './gemini-tools'
import { stripReasoningFromModelMessages } from './strip-reasoning-messages'
import type { NativeAgentStreamPart } from './native-agent-stream-parts'
import { toolOutputToResultPart } from './tool-output-part'
import { AGENT_HARNESS } from '../../constants/service.constants'
import { lastPreparedMessageRole } from './model-message-helpers'

export type NativeGoogleLoopOptions = {
  apiKey: string
  model: string
  systemPrompt: string
  initialMessages: ModelMessage[]
  tools: CircleToolSet
  toolContext: ToolContext
  temperature: number
  maxSteps: number
  abortSignal?: AbortSignal
  prepareStepMessages?: (messages: ModelMessage[]) => ModelMessage[]
}

export async function* runNativeGoogleAgentLoop(
  options: NativeGoogleLoopOptions
): AsyncGenerator<NativeAgentStreamPart, void, undefined> {
  const {
    apiKey,
    model: modelName,
    systemPrompt,
    tools,
    toolContext,
    temperature,
    maxSteps,
    prepareStepMessages,
    abortSignal
  } = options

  const genAI = new GoogleGenerativeAI(apiKey)
  const declarations = await toolsToGeminiDeclarations(tools)
  const model = genAI.getGenerativeModel({
    model: modelName,
    tools: [{ functionDeclarations: declarations }],
    systemInstruction: systemPrompt
  })

  let working: ModelMessage[] = [...options.initialMessages]
  let cumulativeIn = 0
  let cumulativeOut = 0
  const prepare = prepareStepMessages ?? ((m: ModelMessage[]) => stripReasoningFromModelMessages(m))

  let round = 0
  while (round < maxSteps) {
    round += 1
    yield { type: 'start-step', request: {} }

    let lengthRecoveries = 0
    let softNudgesThisRound = 0
    let calls: Array<{ name: string; args?: Record<string, unknown> }> = []
    let assistantText = ''

    requestLoop: while (true) {
      assistantText = ''

      const stepMessages = prepare(working)
      const contents = modelMessagesToGeminiContents(stepMessages)

      const { stream, response } = await model.generateContentStream(
        {
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: 8192
          }
        },
        abortSignal ? { signal: abortSignal } : undefined
      )

      let prevLen = 0
      for await (const chunk of stream) {
        const full = chunk.text()
        const delta = full.slice(prevLen)
        prevLen = full.length
        assistantText = full
        if (delta) {
          yield { type: 'text-delta', text: delta }
        }
      }

      const final = await response
      const usage = final.usageMetadata
      if (usage) {
        cumulativeIn += usage.promptTokenCount ?? 0
        cumulativeOut += usage.candidatesTokenCount ?? 0
      }

      calls = (final.functionCalls?.() ?? []) as Array<{
        name: string
        args?: Record<string, unknown>
      }>

      const finishReason = (final as { candidates?: Array<{ finishReason?: string }> })
        .candidates?.[0]?.finishReason

      if (finishReason === 'MAX_TOKENS') {
        if (lengthRecoveries >= AGENT_HARNESS.MAX_OUTPUT_LENGTH_RECOVERIES) {
          break requestLoop
        }
        lengthRecoveries += 1
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
        calls.length === 0 &&
        assistantText.length > 0 &&
        lastPreparedMessageRole(stepMessages) === 'tool' &&
        softNudgesThisRound < AGENT_HARNESS.POST_TOOL_SOFT_NUDGE_MAX_PER_ROUND
      ) {
        softNudgesThisRound += 1
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

    if (!calls.length) {
      yield {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: 'stop',
        totalUsage: {
          inputTokens: cumulativeIn,
          outputTokens: cumulativeOut,
          totalTokens: cumulativeIn + cumulativeOut
        }
      }
      return
    }

    const parsedCalls = calls.map((fc) => ({
      id: nanoid(),
      name: fc.name,
      input: (fc.args as Record<string, unknown>) ?? {}
    }))

    const messagesForToolExec = prepare(working)

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
        messages: messagesForToolExec,
        abortSignal: options.abortSignal,
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

  yield { type: 'error', error: new Error('Native Google agent: max steps exceeded') }
}
