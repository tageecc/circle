import { jsonrepair } from 'jsonrepair'

type ServerEntry = { config: any; serverName: string }

function collectServers(entries: Iterable<[string, unknown]>): ServerEntry[] {
  const servers: ServerEntry[] = []
  for (const [serverName, config] of entries) {
    if (isValidConfig(config)) servers.push({ config, serverName })
  }
  return servers
}

function packServers(servers: ServerEntry[]): ServerEntry | { servers: ServerEntry[] } | null {
  if (servers.length === 0) return null
  if (servers.length === 1) return servers[0]
  return { servers }
}

export function tryParseJson(input: string): any {
  try {
    return JSON.parse(input)
  } catch {
    try {
      const repaired = jsonrepair(input)
      return JSON.parse(repaired)
    } catch {
      const trimmed = input.trim()
      if (trimmed.startsWith('"') && !trimmed.startsWith('{')) {
        try {
          const repaired = jsonrepair(`{${input}}`)
          return JSON.parse(repaired)
        } catch {
          return null
        }
      }
      return null
    }
  }
}

export function isValidConfig(config: any): boolean {
  if (!config || typeof config !== 'object') return false
  if (config.url && typeof config.url === 'string') return true
  if (config.command && config.args && Array.isArray(config.args)) return true
  return false
}

export function extractServerName(configJson: any): string {
  if (configJson.args?.[0]) {
    const arg = configJson.args[0]
    const parts = arg.split('/')
    const lastPart = parts[parts.length - 1]
    const nameWithoutVersion = lastPart.split('@')[0]
    if (nameWithoutVersion) return nameWithoutVersion
  }
  return 'mcp-server'
}

export function parseConfigJson(
  input: string
): { config: any; serverName: string } | { servers: ServerEntry[] } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parsed = tryParseJson(trimmed)
  if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return null

  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    return packServers(collectServers(Object.entries(parsed.mcpServers)))
  }

  if (isValidConfig(parsed)) {
    return {
      config: parsed,
      serverName: extractServerName(parsed)
    }
  }

  return packServers(collectServers(Object.entries(parsed)))
}
