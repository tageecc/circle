import { Agent } from '@mastra/core/agent'
import { AgentService } from './agent.service'
import { ContextEnrichmentService } from './context-enrichment.service'
import { getMastra, getSharedMemory } from '../mastra.config'
import type { Agent as DBAgent } from '../database/schema.sqlite'
import type { ConfigService } from './config.service'
import type { CoreMessage } from 'ai'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: any[]
}

export interface ChatOptions {
  agentId: string
  threadId?: string
  resourceId?: string
  message: string
  workspaceRoot?: string | null
  configService?: ConfigService
}

function parseAgentTools(tools: DBAgent['tools']): string[] {
  if (tools == null) return []
  if (Array.isArray(tools)) return tools
  if (typeof tools === 'string') {
    try {
      const parsed = JSON.parse(tools) as unknown
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

export class ChatService {
  private agentService = new AgentService()
  private get memory() {
    return getSharedMemory()
  }
  private contextService = ContextEnrichmentService.getInstance()

  // 确保有 threadId，没有则创建
  private async ensureThread(
    threadId: string | undefined,
    resourceId: string,
    message: string
  ): Promise<string> {
    if (threadId) return threadId

    const newThread = await this.memory.createThread({
      resourceId,
      title: message.slice(0, 50)
    })
    return newThread.id
  }

  async chat(options: ChatOptions): Promise<{
    threadId: string
    response: string
    toolCalls?: any[]
  }> {
    const { agentId, threadId, resourceId, message } = options

    const agent = await this.agentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    try {
      const mastraAgent = await this.createMastraAgentFromDB(agent)
      const actualResourceId = resourceId || agentId
      const actualThreadId = await this.ensureThread(threadId, actualResourceId, message)

      const response = await mastraAgent.generate(message, {
        threadId: actualThreadId,
        resourceId: actualResourceId
      })

      const responseText = response.text || ''
      const toolCalls = response.toolCalls || []

      return {
        threadId: actualThreadId,
        response: responseText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      }
    } catch (error) {
      console.error('Chat error:', error)
      throw new Error(
        `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async streamChat(
    options: ChatOptions & {
      abortSignal?: AbortSignal
      onStream?: (chunk: {
        type: 'text' | 'reasoning' | 'tool-call' | 'tool-result'
        content?: string
        toolCall?: { id: string; name: string; args: any }
        toolResult?: {
          id: string
          result: any
          isError?: boolean
          isPending?: boolean
          pendingAction?: any
        }
      }) => void
      onError?: (error: Error) => void
    }
  ): Promise<{
    threadId: string
  }> {
    const {
      agentId,
      threadId,
      resourceId,
      message,
      workspaceRoot,
      configService,
      abortSignal,
      onStream,
      onError
    } = options

    const agent = await this.agentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    try {
      const mastraAgent = await this.createMastraAgentFromDB(agent)
      const actualResourceId = resourceId || agentId
      const actualThreadId = await this.ensureThread(threadId, actualResourceId, message)

      // 检查是否为首次对话：查询 thread 是否存在历史消息
      const threadHistory = threadId ? await this.memory.getThreadById({ threadId }) : null
      const isFirstMessage = !threadHistory

      // 构建消息（完全像 Cursor 和 Mastra 示例）
      let messagesToSend: CoreMessage[] | string

      if (isFirstMessage) {
        // 首次对话：发送系统上下文消息 + 用户消息
        const contextInfo = await this.contextService.getContextInfo({
          workspaceRoot,
          configService,
          includeProjectLayout: true,
          includeOpenFiles: true,
          maxProjectDepth: 2
        })

        messagesToSend = []

        // 作为 user 消息发送上下文（像 Cursor）
        if (contextInfo) {
          messagesToSend.push({
            role: 'user',
            content: contextInfo
          })
        }

        // 用户问题
        messagesToSend.push({
          role: 'user',
          content: `<user_query>\n${message}\n</user_query>`
        })
      } else {
        // 后续对话：只发送用户消息字符串
        // Mastra 会自动从 threadId 加载历史消息（包括第一次的上下文）
        messagesToSend = `<user_query>\n${message}\n</user_query>`
      }

      const stream = await mastraAgent.stream(messagesToSend, {
        threadId: actualThreadId,
        resourceId: actualResourceId,
        providerOptions: {
          'alibaba-cn': {
            enable_thinking: agent.enableReasoning === 1,
            ...(agent.thinkingBudget && { thinking_budget: agent.thinkingBudget })
          }
        }
      })

      for await (const chunk of stream.fullStream) {
        // 检查是否被中止
        if (abortSignal?.aborted) {
          const abortError = new Error('流式响应被用户停止')
          abortError.name = 'AbortError'
          throw abortError
        }

        if (chunk.type === 'text-delta') {
          onStream?.({ type: 'text', content: chunk.payload.text })
        } else if (chunk.type === 'reasoning-delta') {
          onStream?.({ type: 'reasoning', content: chunk.payload.text })
        } else if (chunk.type === 'tool-call') {
          // 立即发送 tool-call（流式体验）
          onStream?.({
            type: 'tool-call',
            toolCall: {
              id: chunk.payload.toolCallId,
              name: chunk.payload.toolName,
              args: chunk.payload.args
            }
          })
        } else if (chunk.type === 'tool-result') {
          // Tool 调用结果（完全按照 Mastra 的定义）
          const result = chunk.payload.result as any
          const toolCallId = chunk.payload.toolCallId

          onStream?.({
            type: 'tool-result',
            toolResult: {
              id: toolCallId,
              result: chunk.payload.result,
              isError: chunk.payload.isError || false,
              isPending: result?.isPending,
              pendingAction: result?.pendingAction
            }
          })
        }
      }

      return {
        threadId: actualThreadId
      }
    } catch (error) {
      console.error('Stream chat error:', error)
      onError?.(error instanceof Error ? error : new Error('Unknown error'))
      throw new Error(
        `Failed to stream response: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async createMastraAgentFromDB(agent: DBAgent): Promise<Agent> {
    if (agent.id.startsWith('system-')) {
      const { ToolService } = await import('./tool.service')
      const { createSystemMastraAgent } = await import('../agents')

      const selectedToolNames = parseAgentTools(agent.tools)
      let toolsMap = {}

      if (selectedToolNames.length > 0) {
        toolsMap = await ToolService.getToolsForAgent(selectedToolNames)
      }

      return await createSystemMastraAgent(agent.id, toolsMap, this.memory)
    }

    let selectedToolNames: string[] = parseAgentTools(agent.tools)
    if (selectedToolNames.length === 0) {
      const { ToolService } = await import('./tool.service')
      selectedToolNames = await ToolService.getEnabledToolNames()
    }

    const modelConfig = this.buildModelConfig(agent)

    // 关联到 Mastra 实例以启用 AI Tracing
    const agentConfig: any = {
      name: agent.name.replace(/\s+/g, '_').toLowerCase(),
      instructions: agent.instructions || 'You are a helpful AI assistant.',
      model: modelConfig,
      memory: this.memory,
      mastra: getMastra() // 关联 Mastra 实例以启用 observability
    }

    if (agent.enableReasoning === 1) {
      agentConfig.experimental_reasoning = true
    }

    if (selectedToolNames.length === 0) {
      return new Agent(agentConfig)
    }

    let selectedTools = {}
    try {
      const { ToolService } = await import('./tool.service')
      selectedTools = await ToolService.getToolsForAgent(selectedToolNames)

      const wrappedTools: Record<string, any> = {}
      for (const [toolName, tool] of Object.entries(selectedTools)) {
        wrappedTools[toolName] = this.wrapToolWithStats(tool as any, toolName, agent.id)
      }

      return new Agent({
        ...agentConfig,
        tools: wrappedTools
      })
    } catch (error) {
      console.error('[ChatService] Failed to load tools:', error)
      return new Agent(agentConfig)
    }
  }

  private buildModelConfig(agent: DBAgent): any {
    if (!agent.model || !agent.provider) {
      throw new Error(`[Agent:${agent.name}] - Missing model or provider configuration`)
    }

    const provider = agent.provider
    const modelId = agent.model.includes('/') ? agent.model : `${provider}/${agent.model}`

    let config: any = modelId

    if (agent.apiKey) {
      config = { model: modelId, apiKey: agent.apiKey }
    }

    return config
  }

  private wrapToolWithStats(tool: any, toolName: string, agentId: string): any {
    const originalExecute = tool.execute || tool

    return {
      ...tool,
      execute: async (params: any) => {
        const startTime = Date.now()
        let success = false

        try {
          const result = await (typeof originalExecute === 'function'
            ? originalExecute(params)
            : originalExecute.execute(params))

          success = true
          return result
        } catch (error) {
          success = false
          throw error
        } finally {
          const executionTime = Date.now() - startTime

          import('./tool.service').then(({ ToolService }) => {
            ToolService.recordToolUsage(toolName, agentId, success, executionTime).catch((err) =>
              console.error('Failed to record tool usage:', err)
            )
          })
        }
      }
    }
  }

  async getThreadHistory(threadId: string): Promise<{
    thread: any
    messages: any[]
  } | null> {
    try {
      const thread = await this.memory.getThreadById({ threadId })
      if (!thread) {
        return null
      }

      const { messages } = await this.memory.query({ threadId })

      return {
        thread,
        messages
      }
    } catch (error) {
      console.error('Failed to get thread history:', error)
      throw error
    }
  }

  async getAgentThreads(agentId: string): Promise<any[]> {
    try {
      const threads = await this.memory.getThreadsByResourceId({ resourceId: agentId })
      return threads
    } catch (error) {
      console.error('Failed to get agent threads:', error)
      throw error
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    try {
      const { messages } = await this.memory.query({ threadId })
      if (messages && messages.length > 0) {
        const messageIds = messages.map((msg: any) => msg.id).filter(Boolean)
        if (messageIds.length > 0) {
          await this.memory.deleteMessages(messageIds)
        }
      }
    } catch (error) {
      console.error('Failed to delete thread:', error)
      throw error
    }
  }
}
