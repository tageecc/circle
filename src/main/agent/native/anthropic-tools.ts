import type { Tool as AnthropicAPITool } from '@anthropic-ai/sdk/resources/messages'
import type { Tool } from '@ai-sdk/provider-utils'
import { toolEntryToJsonSchema } from './tool-json-schema'

export async function toolsToAnthropicAPI(
  tools: Record<string, Tool>
): Promise<AnthropicAPITool[]> {
  const out: AnthropicAPITool[] = []
  for (const [name, t] of Object.entries(tools)) {
    const input_schema = (await toolEntryToJsonSchema(t)) as AnthropicAPITool['input_schema']
    out.push({
      name,
      description: t.description,
      input_schema
    })
  }
  return out
}
