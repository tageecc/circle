import type { Tool as AnthropicAPITool } from '@anthropic-ai/sdk/resources/messages'
import { asSchema, type Tool } from '@ai-sdk/provider-utils'

async function inputSchemaFor(
  t: Tool | Record<string, unknown>
): Promise<AnthropicAPITool['input_schema']> {
  const x = t as Record<string, unknown>
  if (x.inputSchema != null) {
    const schema = asSchema(x.inputSchema as Tool['inputSchema'])
    return (await schema.jsonSchema) as AnthropicAPITool['input_schema']
  }
  if (x.parameters != null && typeof x.parameters === 'object') {
    return x.parameters as AnthropicAPITool['input_schema']
  }
  return { type: 'object', properties: {} } as AnthropicAPITool['input_schema']
}

export async function toolsToAnthropicAPI(
  tools: Record<string, Tool | Record<string, unknown>>
): Promise<AnthropicAPITool[]> {
  const out: AnthropicAPITool[] = []
  for (const [name, t] of Object.entries(tools)) {
    const input_schema = await inputSchemaFor(t)
    const desc = (t as { description?: string }).description
    out.push({
      name,
      description: desc,
      input_schema
    })
  }
  return out
}
