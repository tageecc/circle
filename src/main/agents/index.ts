import { CODING_AGENT } from './coding-agent'
import { TRANSLATOR } from './translator'
import { DATA_ANALYST } from './data-analyst'
import { createMastraAgentFromConfig, type SystemAgentConfig } from './types'

/**
 * 所有系统 Agent 配置
 */
export const SYSTEM_AGENTS: SystemAgentConfig[] = [CODING_AGENT, TRANSLATOR, DATA_ANALYST]

/**
 * 创建 Mastra Agent 实例
 */
export async function createSystemMastraAgent(
  systemAgentId: string,
  toolsMap: Record<string, any>,
  memory?: any
) {
  const config = SYSTEM_AGENTS.find((a) => a.id === systemAgentId)
  if (!config) {
    throw new Error(`System agent not found: ${systemAgentId}`)
  }

  // 为 coding agent 注入项目上下文
  if (systemAgentId === 'system-coding-agent') {
    const { ProjectContextService } = await import('../services/project-context.service')
    const contextService = ProjectContextService.getInstance()
    const projectContext = await contextService.getProjectContext()

    if (projectContext) {
      const configWithContext = {
        ...config,
        instructions: contextService.injectProjectContext(config.instructions, projectContext)
      }
      return createMastraAgentFromConfig(configWithContext, toolsMap, memory)
    }
  }

  return createMastraAgentFromConfig(config, toolsMap, memory)
}

/**
 * 获取所有系统 Agent 配置
 */
export function getSystemAgentsConfig(): SystemAgentConfig[] {
  return SYSTEM_AGENTS
}

/**
 * 根据 ID 获取系统 Agent 配置
 */
export function getSystemAgentConfig(id: string): SystemAgentConfig | undefined {
  return SYSTEM_AGENTS.find((agent) => agent.id === id)
}
