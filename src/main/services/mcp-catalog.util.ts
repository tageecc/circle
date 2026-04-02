/**
 * MCP tool catalog fingerprint + human-readable delta (Claude Code-style mcp_instructions_delta semantics).
 */

export function mcpCatalogSignature(tools: Record<string, unknown>): string {
  return Object.keys(tools)
    .filter((k) => k.includes('__'))
    .sort()
    .join('|')
}

export function formatMcpEnvironmentNote(
  previousSignature: string | null | undefined,
  currentSignature: string,
  totalToolNames: string[]
): string | null {
  const mcpKeys = totalToolNames.filter((k) => k.includes('__'))
  if (mcpKeys.length === 0 && !previousSignature) {
    return null
  }
  if (!previousSignature) {
    return mcpKeys.length
      ? `Connected MCP exposes ${mcpKeys.length} tool(s): ${mcpKeys.slice(0, 35).join(', ')}${mcpKeys.length > 35 ? ' …' : ''}`
      : null
  }
  if (previousSignature === currentSignature) {
    return null
  }
  const prev = new Set(previousSignature.split('|').filter(Boolean))
  const curr = new Set(currentSignature.split('|').filter(Boolean))
  const added = [...curr].filter((x) => !prev.has(x))
  const removed = [...prev].filter((x) => !curr.has(x))
  const lines: string[] = []
  if (added.length) lines.push(`MCP tools now available: ${added.join(', ')}`)
  if (removed.length)
    lines.push(`MCP tools no longer available (disconnected): ${removed.join(', ')}`)
  return lines.length > 0 ? lines.join('\n') : 'MCP tool catalog changed; refresh tool choices.'
}
