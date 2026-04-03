/**
 * Convert AI SDK ModelMessage[] to OpenAI Chat Completions message list (no system — caller adds system separately).
 */

import type {
  AssistantModelMessage,
  ModelMessage,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage
} from '@ai-sdk/provider-utils'

export type OpenAIChatMessage = {
  role: 'user' | 'assistant' | 'tool'
  content?: string | null | Array<Record<string, unknown>>
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

function toolResultOutputToString(part: ToolResultPart): string {
  const o = part.output
  if (o.type === 'text') return o.value
  if (o.type === 'json') return JSON.stringify(o.value)
  if (o.type === 'error-text') return o.value
  if (o.type === 'error-json') return JSON.stringify(o.value)
  if (o.type === 'content') {
    return o.value.map((x) => (x.type === 'text' ? x.text : '')).join('')
  }
  return JSON.stringify(o)
}

function dataUrlFromImagePart(p: { image: unknown; mediaType?: string }): string {
  const img = p.image
  if (typeof img === 'string') {
    return img.startsWith('data:') ? img : img
  }
  if (img instanceof URL) {
    return img.toString()
  }
  if (Buffer.isBuffer(img)) {
    return `data:${p.mediaType || 'image/png'};base64,${img.toString('base64')}`
  }
  const buf = img as ArrayBuffer | Uint8Array
  const b = Buffer.from(buf as ArrayBuffer)
  return `data:${p.mediaType || 'image/png'};base64,${b.toString('base64')}`
}

function userMessageToOpenAI(msg: UserModelMessage): OpenAIChatMessage {
  const c = msg.content
  if (typeof c === 'string') {
    return { role: 'user', content: c }
  }
  const parts: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  > = []
  for (const p of c) {
    if (p.type === 'text') {
      parts.push({ type: 'text', text: p.text })
    } else if (p.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: dataUrlFromImagePart(p) } })
    }
  }
  if (parts.length === 0) {
    return { role: 'user', content: '' }
  }
  if (parts.length === 1 && parts[0].type === 'text') {
    return { role: 'user', content: parts[0].text }
  }
  return { role: 'user', content: parts as Array<Record<string, unknown>> }
}

function assistantMessageToOpenAI(msg: AssistantModelMessage): OpenAIChatMessage {
  const c = msg.content
  if (typeof c === 'string') {
    return { role: 'assistant', content: c }
  }
  const textChunks: string[] = []
  const toolCalls: ToolCallPart[] = []
  for (const p of c) {
    if (p.type === 'text') textChunks.push(p.text)
    if (p.type === 'tool-call') toolCalls.push(p)
  }
  const textJoined = textChunks.join('')
  const tool_calls =
    toolCalls.length > 0
      ? toolCalls.map((tc) => ({
          id: tc.toolCallId,
          type: 'function' as const,
          function: {
            name: tc.toolName,
            arguments: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input ?? {})
          }
        }))
      : undefined

  if (tool_calls?.length) {
    return {
      role: 'assistant',
      content: textJoined.length > 0 ? textJoined : null,
      tool_calls
    }
  }
  return { role: 'assistant', content: textJoined || null }
}

function toolMessageToOpenAIMessages(msg: ToolModelMessage): OpenAIChatMessage[] {
  return msg.content
    .filter((p): p is ToolResultPart => p.type === 'tool-result')
    .map((p) => ({
      role: 'tool' as const,
      tool_call_id: p.toolCallId,
      content: toolResultOutputToString(p)
    }))
}

export function modelMessagesToOpenAIChat(messages: ModelMessage[]): OpenAIChatMessage[] {
  const out: OpenAIChatMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    if (msg.role === 'user') {
      out.push(userMessageToOpenAI(msg))
      continue
    }
    if (msg.role === 'assistant') {
      out.push(assistantMessageToOpenAI(msg))
      continue
    }
    if (msg.role === 'tool') {
      out.push(...toolMessageToOpenAIMessages(msg))
    }
  }
  return out
}
