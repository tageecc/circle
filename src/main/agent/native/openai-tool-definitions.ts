import type { Tool } from '@ai-sdk/provider-utils'
import type { CircleToolSet } from '../../types/circle-tool-set'
import { toolEntryToJsonSchema } from './tool-json-schema'

export type OpenAIFunctionTool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export async function toolsToOpenAIFunctions(
  tools: CircleToolSet
): Promise<OpenAIFunctionTool[]> {
  const out: OpenAIFunctionTool[] = []
  for (const [name, t] of Object.entries(tools)) {
    const parameters = await toolEntryToJsonSchema(t as Tool)
    out.push({
      type: 'function',
      function: {
        name,
        description: t.description,
        parameters
      }
    })
  }
  return out
}
