/**
 * Map AI SDK ModelMessage[] to Anthropic Messages API MessageParam[] (system is separate).
 */

import type {
  AssistantModelMessage,
  ModelMessage,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage
} from '@ai-sdk/provider-utils'
import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam
} from '@anthropic-ai/sdk/resources/messages'

function toolResultToString(part: ToolResultPart): string {
  const o = part.output
  if (o.type === 'text') return o.value
  if (o.type === 'json') return JSON.stringify(o.value)
  if (o.type === 'error-text') return o.value
  if (o.type === 'error-json') return JSON.stringify(o.value)
  if (o.type === 'content') return o.value.map((x) => (x.type === 'text' ? x.text : '')).join('')
  return JSON.stringify(o)
}

function userToAnthropic(msg: UserModelMessage): MessageParam {
  const c = msg.content
  if (typeof c === 'string') {
    return { role: 'user', content: c }
  }
  const parts: ContentBlockParam[] = []
  for (const p of c) {
    if (p.type === 'text') {
      parts.push({ type: 'text', text: p.text })
    }
  }
  if (parts.length === 1 && parts[0].type === 'text') {
    return { role: 'user', content: parts[0].text }
  }
  return { role: 'user', content: parts }
}

function assistantToAnthropic(msg: AssistantModelMessage): MessageParam {
  const c = msg.content
  if (typeof c === 'string') {
    return { role: 'assistant', content: c }
  }
  const blocks: ContentBlockParam[] = []
  for (const p of c) {
    if (p.type === 'text') {
      blocks.push({ type: 'text', text: p.text })
    }
    if (p.type === 'tool-call') {
      const tc = p as ToolCallPart
      blocks.push({
        type: 'tool_use',
        id: tc.toolCallId,
        name: tc.toolName,
        input: tc.input
      })
    }
  }
  return { role: 'assistant', content: blocks }
}

function toolToAnthropic(msg: ToolModelMessage): MessageParam {
  const blocks: ToolResultBlockParam[] = []
  for (const p of msg.content) {
    if (p.type === 'tool-result') {
      const tr = p as ToolResultPart
      blocks.push({
        type: 'tool_result',
        tool_use_id: tr.toolCallId,
        content: toolResultToString(tr)
      })
    }
  }
  return { role: 'user', content: blocks }
}

export function modelMessagesToAnthropic(messages: ModelMessage[]): MessageParam[] {
  const out: MessageParam[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    if (msg.role === 'user') {
      out.push(userToAnthropic(msg))
      continue
    }
    if (msg.role === 'assistant') {
      out.push(assistantToAnthropic(msg as AssistantModelMessage))
      continue
    }
    if (msg.role === 'tool') {
      out.push(toolToAnthropic(msg as ToolModelMessage))
    }
  }
  return out
}
