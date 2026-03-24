export interface Tool {
  id: string
  name: string
  description: string
  source: 'mcp' | 'custom'
  mcpServerId?: string
  mcpServerName?: string
  status: string
  enabled: boolean
  parameters?: any
  usageStats: {
    totalCalls: number
    successCalls: number
    failedCalls: number
    lastUsedAt: string | null
    avgExecutionTime: number
  }
}

export interface MCPServer {
  id: string
  name: string
  description?: string
  status: string
  config: any
  tools: string[]
  error?: string
}
