import type { Tool, ToolExecutionOptions } from '@ai-sdk/provider-utils'
import type { z } from 'zod'

/**
 * Circle tool definition without the Vercel AI SDK `tool()` helper — same wire shape for native loops.
 */
export function defineTool<TSchema extends z.ZodType>(def: {
  description: string
  inputSchema: TSchema
  execute: (input: z.infer<TSchema>, options: ToolExecutionOptions) => Promise<unknown>
}): Tool<z.infer<TSchema>, unknown> {
  return {
    description: def.description,
    inputSchema: def.inputSchema,
    execute: def.execute
  }
}
