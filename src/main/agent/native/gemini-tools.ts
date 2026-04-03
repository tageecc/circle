import {
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  SchemaType
} from '@google/generative-ai'
import { asSchema, type Tool } from '@ai-sdk/provider-utils'

async function paramsFor(
  t: Tool | Record<string, unknown>
): Promise<FunctionDeclarationSchema | undefined> {
  const x = t as Record<string, unknown>
  if (x.inputSchema != null) {
    const schema = asSchema(x.inputSchema as Tool['inputSchema'])
    return (await schema.jsonSchema) as unknown as FunctionDeclarationSchema
  }
  if (x.parameters != null && typeof x.parameters === 'object') {
    return x.parameters as unknown as FunctionDeclarationSchema
  }
  return { type: SchemaType.OBJECT, properties: {} }
}

export async function toolsToGeminiDeclarations(
  tools: Record<string, Tool | Record<string, unknown>>
): Promise<FunctionDeclaration[]> {
  const out: FunctionDeclaration[] = []
  for (const [name, t] of Object.entries(tools)) {
    const parameters = await paramsFor(t)
    const desc = (t as { description?: string }).description
    out.push({
      name,
      description: desc,
      parameters
    })
  }
  return out
}
