/**
 * Pure helpers for MCP URL parsing and construction.
 */

export function extractServerCode(url: string): string | null {
  return url.match(/\/([^/]+)\/mcp$/)?.[1] ?? null
}

export function getMCPServerUrl(serverCode: string): string {
  const baseUrl = import.meta.env.MCP_BASE_URL || 'https://mcp.alibaba-inc.com'
  return `${baseUrl}/${serverCode}/mcp`
}
