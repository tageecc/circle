import { asSchema, type Tool } from '@ai-sdk/provider-utils'

export type OpenAIFunctionTool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

async function parametersForToolEntry(
  t: Tool | Record<string, unknown>
): Promise<Record<string, unknown>> {
  const x = t as Record<string, unknown>
  if (x.inputSchema != null) {
    const schema = asSchema(x.inputSchema as Tool['inputSchema'])
    return (await schema.jsonSchema) as Record<string, unknown>
  }
  if (x.parameters != null && typeof x.parameters === 'object') {
    return x.parameters as Record<string, unknown>
  }
  return { type: 'object', properties: {} }
}

export async function toolsToOpenAIFunctions(
  tools: Record<string, Tool | Record<string, unknown>>
): Promise<OpenAIFunctionTool[]> {
  const out: OpenAIFunctionTool[] = []
  for (const [name, t] of Object.entries(tools)) {
    const parameters = await parametersForToolEntry(t)
    const desc = (t as { description?: string }).description
    out.push({
      type: 'function',
      function: {
        name,
        description: desc,
        parameters
      }
    })
  }
  return out
}
