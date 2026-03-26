/**
 * MCP helpers — no remote registry; servers are user-configured (stdio / HTTP URL).
 */

export function getMCPServerUrlFromBase(baseUrl: string, serverCode: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  return `${trimmed}/${serverCode}/mcp`
}

export function extractServerCode(url: string): string | null {
  const match = url.match(/\/([^/]+)\/mcp$/)
  return match ? match[1] : null
}
