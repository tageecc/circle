import type { Tool, ToolExecutionOptions } from '@ai-sdk/provider-utils'
import type { z } from 'zod'

/**
 * Circle tool definition without the `ai` package `tool()` helper — same wire shape as provider-utils `Tool`.
 */
export function defineTool<TSchema extends z.ZodType>(def: {
  description: string
  inputSchema: TSchema
  execute: (input: z.infer<TSchema>, options: ToolExecutionOptions) => Promise<unknown>
}): Tool<any, any> {
  return {
    description: def.description,
    inputSchema: def.inputSchema,
    execute: def.execute
  }
}
