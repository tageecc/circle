import { z } from 'zod'

/**
 * 记忆管理工具
 * 用于 Agent 创建、更新、删除长期记忆
 */
export const updateMemoryTool = {
  description: `Creates, updates, or deletes a memory in a persistent knowledge base for future reference by the AI.

Rules:
- If the user augments an existing memory, you MUST use action 'update'
- If the user contradicts an existing memory, use action 'delete', not 'update'
- To update or delete, you MUST provide the existing_knowledge_id parameter
- If the user asks to remember something, use action 'create'
- Unless the user explicitly asks to remember something, DO NOT use this tool with action 'create'
- NEVER create memories related to implementation plans or task-specific information`,

  parameters: z.object({
    action: z
      .enum(['create', 'update', 'delete'])
      .default('create')
      .describe('The action to perform'),
    title: z
      .string()
      .optional()
      .describe('The title of the memory (required for create and update)'),
    knowledge_to_store: z
      .string()
      .optional()
      .describe('The memory content (required for create and update)'),
    existing_knowledge_id: z
      .string()
      .optional()
      .describe('The ID of existing memory (required for update and delete)')
  }),

  execute: async ({
    action,
    title,
    knowledge_to_store,
    existing_knowledge_id
  }: {
    action: 'create' | 'update' | 'delete'
    title?: string
    knowledge_to_store?: string
    existing_knowledge_id?: string
  }) => {
    try {
      const { MemoryService } = await import('../services/memory.service')
      const memoryService = MemoryService.getInstance()

      switch (action) {
        case 'create':
          if (!title || !knowledge_to_store) {
            throw new Error('title and knowledge_to_store are required for create action')
          }
          const ctx = (
            this as unknown as {
              context?: { projectId?: string; agentId?: string }
            }
          ).context
          const created = await memoryService.createMemory({
            title,
            content: knowledge_to_store,
            projectId: ctx?.projectId,
            agentId: ctx?.agentId
          })
          return {
            success: true,
            action: 'create',
            memory: created,
            message: `Memory created: ${title}`
          }

        case 'update':
          if (!existing_knowledge_id) {
            throw new Error('existing_knowledge_id is required for update action')
          }
          if (!title || !knowledge_to_store) {
            throw new Error('title and knowledge_to_store are required for update action')
          }
          const updated = await memoryService.updateMemory(existing_knowledge_id, {
            title,
            content: knowledge_to_store
          })
          return {
            success: true,
            action: 'update',
            memory: updated,
            message: `Memory updated: ${title}`
          }

        case 'delete':
          if (!existing_knowledge_id) {
            throw new Error('existing_knowledge_id is required for delete action')
          }
          await memoryService.deleteMemory(existing_knowledge_id)
          return {
            success: true,
            action: 'delete',
            memoryId: existing_knowledge_id,
            message: 'Memory deleted successfully'
          }

        default:
          throw new Error(`Unknown action: ${action}`)
      }
    } catch (error: any) {
      throw new Error(`Memory operation failed: ${error.message}`)
    }
  }
}
