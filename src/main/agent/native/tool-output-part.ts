import type { ToolResultPart } from '@ai-sdk/provider-utils'
import type { JSONValue } from '@ai-sdk/provider'

/**
 * Map tool execute() return value to AI SDK tool-result output (shared by all native loops).
 */
export function toolOutputToResultPart(output: unknown): ToolResultPart['output'] {
  if (typeof output === 'string') {
    return { type: 'text', value: output }
  }
  return { type: 'json', value: output as JSONValue }
}
