import type { AssistantModelMessage, ModelMessage } from '@ai-sdk/provider-utils'

/**
 * Drop reasoning parts from assistant messages before sending to OpenAI-compatible APIs.
 */
export function stripReasoningFromModelMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') {
      return msg
    }
    const content = msg.content.filter((p) => p.type !== 'reasoning')
    return { ...(msg as AssistantModelMessage), content } as ModelMessage
  })
}
