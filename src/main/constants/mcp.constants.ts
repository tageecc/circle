/**
 * MCP 主进程配置常量
 * 
 * 注意：敏感信息（如 SECRET）应该从环境变量或安全存储读取
 */

export const MCP_CONFIG = {
  /** 阿里云 MCP 服务基础 URL */
  BASE_URL: process.env.MCP_BASE_URL || 'https://mcp.alibaba-inc.com',

  /** 阿里云网关配置 */
  GATEWAY: {
    CLIENT: process.env.MCP_GATEWAY_CLIENT || 'sui-kit.default.primary',
    SECRET: process.env.MCP_GATEWAY_SECRET || '43upt7h525teo4ir4caoclu3f7r3c6il',
    CLIENT_ID: process.env.MCP_GATEWAY_CLIENT_ID || 'sui-kit'
  },

  /** API 端点 */
  API: {
    SERVERS:
      process.env.MCP_API_SERVERS ||
      'https://gateway.aone.alibaba-inc.com/aone/open/open-api/mcp/servers'
  }
} as const

/**
 * 生成 MCP 服务 URL
 */
export function getMCPServerUrl(serverCode: string): string {
  return `${MCP_CONFIG.BASE_URL}/${serverCode}/mcp`
}

/**
 * 从 URL 中提取服务代码
 */
export function extractServerCode(url: string): string | null {
  const match = url.match(/\/([^/]+)\/mcp$/)
  return match ? match[1] : null
}

/**
 * 生成阿里云员工头像 URL
 */
export function getEmployeeAvatarUrl(empId: string): string {
  return `https://work.alibaba-inc.com/photo/${empId}.140x140.jpg`
}

/**
 * 生成阿里云员工主页 URL
 */
export function getEmployeeProfileUrl(empId: string): string {
  return `https://work.alibaba-inc.com/nwpipe/u/${empId}`
}
