import type { Tool as AnthropicAPITool } from '@anthropic-ai/sdk/resources/messages'
import type { Tool } from '@ai-sdk/provider-utils'
import type { CircleToolSet } from '../../types/circle-tool-set'
import { toolEntryToJsonSchema } from './tool-json-schema'

export async function toolsToAnthropicAPI(tools: CircleToolSet): Promise<AnthropicAPITool[]> {
  const out: AnthropicAPITool[] = []
  for (const [name, t] of Object.entries(tools)) {
    const input_schema = (await toolEntryToJsonSchema(t as Tool)) as AnthropicAPITool['input_schema']
    out.push({
      name,
      description: t.description,
      input_schema
    })
  }
  return out
}
