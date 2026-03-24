import { getDatabase, getSchema } from '../database/client'
import type { Agent, NewAgent } from '../database/schema.sqlite'
import { eq, asc } from 'drizzle-orm'
import { getSystemAgentsConfig, getSystemAgentConfig } from '../agents'

export class AgentService {
  private get db() {
    return getDatabase()
  }
  private get agents() {
    return getSchema().agents
  }

  async getAllAgents(): Promise<Agent[]> {
    const dbAgents = (await this.db.select().from(this.agents as any)) as Agent[]
    const systemAgents = getSystemAgentsConfig()

    const iso = () => new Date().toISOString()
    const mappedSystemAgents: Agent[] = systemAgents.map((sa) => ({
      id: sa.id,
      name: sa.name,
      description: sa.description || null,
      model: sa.model,
      provider: sa.provider,
      apiKey: null,
      instructions: sa.instructions || null,
      temperature: sa.temperature ?? 7,
      maxTokens: sa.maxTokens ?? 2048,
      enableReasoning: sa.enableReasoning ?? 0,
      thinkingBudget: sa.thinkingBudget ?? null,
      tools: JSON.stringify(sa.tools ?? []),
      metadata: sa.metadata ? JSON.stringify(sa.metadata) : null,
      createdAt: iso(),
      updatedAt: iso()
    }))

    return [...mappedSystemAgents, ...dbAgents]
  }

  async getAgentById(id: string): Promise<Agent | undefined> {
    if (id.startsWith('system-')) {
      const systemConfig = getSystemAgentConfig(id)
      if (!systemConfig) return undefined

      const iso = new Date().toISOString()
      return {
        id: systemConfig.id,
        name: systemConfig.name,
        description: systemConfig.description || null,
        model: systemConfig.model,
        provider: systemConfig.provider,
        apiKey: null,
        instructions: systemConfig.instructions || null,
        temperature: systemConfig.temperature ?? 7,
        maxTokens: systemConfig.maxTokens ?? 2048,
        enableReasoning: systemConfig.enableReasoning ?? 0,
        thinkingBudget: systemConfig.thinkingBudget ?? null,
        tools: JSON.stringify(systemConfig.tools ?? []),
        metadata: systemConfig.metadata ? JSON.stringify(systemConfig.metadata) : null,
        createdAt: iso,
        updatedAt: iso
      }
    }

    const result = (await this.db
      .select()
      .from(this.agents as any)
      .where(eq(this.agents.id, id))) as Agent[]
    console.log(
      '[AgentService] Get agent by ID:',
      id,
      'enableReasoning:',
      result[0]?.enableReasoning
    )
    return result[0]
  }

  async createAgent(data: NewAgent): Promise<Agent> {
    const result = (await this.db
      .insert(this.agents as any)
      .values(data)
      .returning()) as Agent[]
    return result[0]!
  }

  async updateAgent(id: string, data: Partial<NewAgent>): Promise<Agent> {
    console.log('[AgentService] Updating agent:', id, 'with data:', data)
    const result = (await this.db
      .update(this.agents as any)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(this.agents.id, id))
      .returning()) as Agent[]
    console.log('[AgentService] Update result:', result[0])
    return result[0]!
  }

  async deleteAgent(id: string): Promise<void> {
    await this.db.delete(this.agents as any).where(eq(this.agents.id, id))
  }

  /**
   * 确保至少存在一个默认 Agent（IDE 单模型模式：仅用此 Agent）
   */
  async ensureDefaultAgent(): Promise<Agent> {
    const list = (await this.db
      .select()
      .from(this.agents as any)
      .orderBy(asc(this.agents.createdAt))
      .limit(1)) as Agent[]
    if (list.length > 0) return list[0]!

    const values: Record<string, unknown> = {
      name: 'Default',
      description: 'Default assistant for coding',
      model: 'gpt-4o',
      provider: 'openai',
      instructions:
        "You are a helpful AI coding assistant. Follow the user's requests and use the available tools when needed.",
      temperature: 7,
      maxTokens: 4096,
      tools: '[]'
    }
    const defaultAgent = (await this.db
      .insert(this.agents as any)
      .values(values)
      .returning()) as Agent[]
    console.log('✅ Created default agent:', defaultAgent[0]?.id)
    return defaultAgent[0]!
  }

  /**
   * 获取默认 Agent（IDE 单模型：聊天与设置均使用此 Agent）
   */
  async getDefaultAgent(): Promise<Agent> {
    const list = (await this.db
      .select()
      .from(this.agents as any)
      .orderBy(asc(this.agents.createdAt))
      .limit(1)) as Agent[]
    if (list.length > 0) return list[0]!
    return this.ensureDefaultAgent()
  }

  async initializeDefaultAgents(): Promise<void> {
    await this.ensureDefaultAgent()
  }
}
