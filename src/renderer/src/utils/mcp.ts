/**
 * Pure helpers for MCP URL parsing (no remote registry defaults).
 */

export function extractServerCode(url: string): string | null {
  return url.match(/\/([^/]+)\/mcp$/)?.[1] ?? null
}
