import type { Tool } from '@ai-sdk/provider-utils'

/**
 * Built-in + MCP tools for the native agent (`defineTool`, MCP `jsonSchema`, `execute`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- uniform tool map (defineTool / MCP); widened generics
export type CircleToolSet = Record<string, Tool<any, any>>
