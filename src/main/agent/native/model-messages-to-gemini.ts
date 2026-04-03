/**
 * Map ModelMessage history to Gemini Content[] (roles: user | model).
 */

import type {
  AssistantModelMessage,
  ModelMessage,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage
} from '@ai-sdk/provider-utils'
import type { Content, Part } from '@google/generative-ai'

function toolResultToObject(part: ToolResultPart): object {
  const o = part.output
  if (o.type === 'text') return { result: o.value }
  if (o.type === 'json') return o.value as object
  return { result: JSON.stringify(o) }
}

function userToGemini(msg: UserModelMessage): Content {
  const c = msg.content
  if (typeof c === 'string') {
    return { role: 'user', parts: [{ text: c }] }
  }
  const parts: Part[] = []
  for (const p of c) {
    if (p.type === 'text') parts.push({ text: p.text })
  }
  return { role: 'user', parts: parts.length ? parts : [{ text: '' }] }
}

function assistantToGemini(msg: AssistantModelMessage): Content {
  const c = msg.content
  if (typeof c === 'string') {
    return { role: 'model', parts: [{ text: c }] }
  }
  const parts: Part[] = []
  for (const p of c) {
    if (p.type === 'text') parts.push({ text: p.text })
    if (p.type === 'tool-call') {
      const tc = p as ToolCallPart
      parts.push({
        functionCall: {
          name: tc.toolName,
          args: (typeof tc.input === 'object' && tc.input !== null ? tc.input : {}) as Record<
            string,
            unknown
          >
        }
      })
    }
  }
  return { role: 'model', parts: parts.length ? parts : [{ text: '' }] }
}

function toolToGemini(msg: ToolModelMessage): Content {
  const parts: Part[] = []
  for (const p of msg.content) {
    if (p.type === 'tool-result') {
      const tr = p as ToolResultPart
      parts.push({
        functionResponse: {
          name: tr.toolName,
          response: toolResultToObject(tr)
        }
      })
    }
  }
  return { role: 'user', parts: parts.length ? parts : [{ text: '' }] }
}

export function modelMessagesToGeminiContents(messages: ModelMessage[]): Content[] {
  const out: Content[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    if (msg.role === 'user') {
      out.push(userToGemini(msg))
      continue
    }
    if (msg.role === 'assistant') {
      out.push(assistantToGemini(msg as AssistantModelMessage))
      continue
    }
    if (msg.role === 'tool') {
      out.push(toolToGemini(msg as ToolModelMessage))
    }
  }
  return out
}
