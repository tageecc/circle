import { type FunctionDeclaration, type FunctionDeclarationSchema } from '@google/generative-ai'
import type { Tool } from '@ai-sdk/provider-utils'
import { toolEntryToJsonSchema } from './tool-json-schema'

export async function toolsToGeminiDeclarations(
  tools: Record<string, Tool>
): Promise<FunctionDeclaration[]> {
  const out: FunctionDeclaration[] = []
  for (const [name, t] of Object.entries(tools)) {
    const raw = await toolEntryToJsonSchema(t)
    const parameters = raw as unknown as FunctionDeclarationSchema
    out.push({
      name,
      description: t.description,
      parameters
    })
  }
  return out
}
