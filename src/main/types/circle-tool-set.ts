import type { Tool } from '@ai-sdk/provider-utils'

/**
 * Built-in + MCP tools for the native agent (`defineTool`, MCP `jsonSchema`, `execute`).
 */
export type CircleToolSet = Record<string, Tool<any, any>>
