import { Agent } from '@mastra/core/agent'

/**
 * 系统 Agent 配置接口
 */
export interface SystemAgentConfig {
  id: string
  name: string
  description: string
  model: string
  provider: string
  instructions: string
  temperature?: number
  maxTokens?: number
  enableReasoning?: number
  thinkingBudget?: number
  tools?: string[]
  metadata?: {
    icon?: string
    avatar?: string
    category?: string
    isSystem: true
  }
}

/**
 * 创建 Mastra Agent 实例的通用函数
 */
export async function createMastraAgentFromConfig(
  config: SystemAgentConfig,
  toolsMap: Record<string, any>,
  memory?: any
): Promise<Agent> {
  // 合并系统工具和动态工具
  const { getSystemTools } = await import('../tools')
  const systemTools = getSystemTools(config.tools || [])
  const selectedTools = { ...systemTools, ...toolsMap }

  const modelId = config.model.includes('/') ? config.model : `${config.provider}/${config.model}`

  const { getMastra } = await import('../mastra.config')

  const agentConfig: any = {
    name: config.name.replace(/\s+/g, '_').toLowerCase(),
    instructions: config.instructions,
    model: modelId,
    mastra: getMastra() // 关联 Mastra 实例以启用 observability
  }

  if (memory) {
    agentConfig.memory = memory
  }

  if (config.enableReasoning === 1) {
    agentConfig.experimental_reasoning = true
    if (config.thinkingBudget) {
      agentConfig.experimental_thinkingBudget = config.thinkingBudget
    }
  }

  if (Object.keys(selectedTools).length > 0) {
    agentConfig.tools = selectedTools
  }

  return new Agent(agentConfig)
}
