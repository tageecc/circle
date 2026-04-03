import { asSchema, type Tool } from '@ai-sdk/provider-utils'

/**
 * JSON Schema for provider tool registration. All tools use `inputSchema` (Zod or jsonSchema()).
 */
export async function toolEntryToJsonSchema(t: Tool): Promise<Record<string, unknown>> {
  const schema = asSchema(t.inputSchema)
  return (await schema.jsonSchema) as Record<string, unknown>
}
