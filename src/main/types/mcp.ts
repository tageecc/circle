/**
 * 主进程 MCP 类型定义
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface MCPServer {
  id: string
  name: string
  configJson: {
    type?: string
    url?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    headers?: Record<string, string>
    requiresAuth?: boolean
  }
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown> // 改进：使用更具体的类型
  annotations?: Record<string, string>
}

export interface MCPServerDetail {
  name: string
  displayName: string
  description?: string
  avatarUrl?: string
  creator?: string
  modifier?: string
  gmtModified?: string
  readme?: string
  status?: string
  type?: string
  tools?: MCPTool[]
  scopes?: Array<{
    deptNo?: string
    deptName?: string
    deptNoPathList?: string[]
  }>
}
