import type { ModelMessage } from '@ai-sdk/provider-utils'

export function lastPreparedMessageRole(messages: ModelMessage[]): string | undefined {
  const m = messages[messages.length - 1]
  return m?.role
}
