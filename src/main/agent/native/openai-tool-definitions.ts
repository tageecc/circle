import type { Tool } from '@ai-sdk/provider-utils'
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
  tools: Record<string, Tool>
): Promise<OpenAIFunctionTool[]> {
  const out: OpenAIFunctionTool[] = []
  for (const [name, t] of Object.entries(tools)) {
    const parameters = await toolEntryToJsonSchema(t)
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
