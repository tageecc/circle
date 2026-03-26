import { generateText } from 'ai'
import type { TextPart } from 'ai'
import { getDb } from '../database/db'
import * as schema from '../database/schema'
import { eq, desc, asc, and, gt } from 'drizzle-orm'
import type { MessageMetadata } from '../types/message'
import { nanoid } from 'nanoid'
import { createQwen } from 'qwen-ai-provider-v5'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: any
  metadata?: MessageMetadata
  timestamp: number
}

export interface ChatSession {
  id: string
  agentId: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

/**
 * 会话服务
 * 管理 AI 对话会话和消息
 */
export class SessionService {
  private db = getDb()

  async createSession(modelId: string, projectPath: string): Promise<string> {
    const db = this.db.getDb()
    const newSessionId = `session_${nanoid()}`
    const now = new Date()

    db.insert(schema.sessions)
      .values({
        id: newSessionId,
        projectPath,
        agentId: modelId,
        title: 'New Chat',
        metadata: '{}',
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now
      })
      .run()

    console.log(`[SessionService] Created session: ${newSessionId} with model: ${modelId}`)
    return newSessionId
  }

  async getProjectSessions(projectPath: string): Promise<ChatSession[]> {
    const db = this.db.getDb()

    const dbSessions = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.projectPath, projectPath))
      .orderBy(desc(schema.sessions.updatedAt))
      .all()

    return dbSessions.map((session) => ({
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      messages: [],
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: new Date(session.updatedAt).getTime()
    }))
  }

  async getSession(sessionId: string): Promise<{
    id: string
    agentId: string
    title: string
    metadata: Record<string, unknown>
    createdAt: number
    updatedAt: number
  } | null> {
    const db = this.db.getDb()

    const [session] = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1)
      .all()

    if (!session) {
      return null
    }

    return {
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      metadata: JSON.parse(session.metadata) as Record<string, unknown>,
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: new Date(session.updatedAt).getTime()
    }
  }

  async updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
    const db = this.db.getDb()
    const now = new Date()

    const [session] = db
      .select({ metadata: schema.sessions.metadata })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1)
      .all()

    const existingMetadata = session?.metadata ? JSON.parse(session.metadata) : {}
    const mergedMetadata = { ...existingMetadata, ...metadata }

    db.update(schema.sessions)
      .set({
        metadata: JSON.stringify(mergedMetadata),
        updatedAt: now
      })
      .where(eq(schema.sessions.id, sessionId))
      .run()
  }

  async getSessionHistory(sessionId: string): Promise<ChatSession | null> {
    const db = this.db.getDb()

    const [session] = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1)
      .all()

    if (!session) {
      return null
    }

    const dbMessages = await this.getMessages(sessionId)

    return {
      id: sessionId,
      agentId: session.agentId,
      title: session.title,
      messages: dbMessages,
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: new Date(session.updatedAt).getTime(),
      metadata: JSON.parse(session.metadata) as Record<string, unknown>
    }
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const db = this.db.getDb()

    const dbMessages = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.sessionId, sessionId))
      .orderBy(asc(schema.messages.id))
      .all()

    return dbMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as ChatMessage['role'],
      content: JSON.parse(msg.content) as ChatMessage['content'],
      metadata: msg.metadata ? (JSON.parse(msg.metadata) as MessageMetadata) : undefined,
      timestamp: new Date(msg.createdAt).getTime()
    }))
  }

  async saveMessage(
    sessionId: string,
    message: {
      role: string
      content: string | any[]
      metadata?: MessageMetadata
    }
  ): Promise<number> {
    const db = this.db.getDb()
    const now = new Date()

    const result = db
      .insert(schema.messages)
      .values({
        sessionId,
        role: message.role,
        content: JSON.stringify(message.content),
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
        createdAt: now
      })
      .run()

    // 更新 session 时间戳
    db.update(schema.sessions)
      .set({
        lastMessageAt: now,
        updatedAt: now
      })
      .where(eq(schema.sessions.id, sessionId))
      .run()

    return result.lastInsertRowid as number
  }

  async updateMessage(
    messageId: number,
    updates: {
      content?: string | any[]
      metadata?: MessageMetadata
    }
  ): Promise<void> {
    const db = this.db.getDb()
    const updateData: any = {}

    if (updates.content !== undefined) {
      updateData.content = JSON.stringify(updates.content)
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = JSON.stringify(updates.metadata)
    }

    if (Object.keys(updateData).length > 0) {
      db.update(schema.messages).set(updateData).where(eq(schema.messages.id, messageId)).run()
    }
  }

  async updateToolApprovalStatus(
    messageId: number,
    toolCallId: string,
    approvalData: {
      needsApproval: boolean
      approvalStatus: 'pending' | 'approved' | 'rejected' | 'skipped'
      state?: 'pending' | 'running' | 'completed' | 'error'
    }
  ): Promise<void> {
    const db = this.db.getDb()

    const [message] = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1)
      .all()

    if (!message) {
      console.warn(`[SessionService] Message not found: ${messageId}`)
      return
    }

    const metadata = message.metadata ? (JSON.parse(message.metadata) as MessageMetadata) : {}
    const toolStates = metadata.toolStates || {}

    // ✅ 简化：只存储运行时状态，移除state字段
    toolStates[toolCallId] = {
      ...toolStates[toolCallId],
      needsApproval: approvalData.needsApproval,
      approvalStatus: approvalData.approvalStatus
    }

    await this.updateMessage(messageId, {
      metadata: { ...metadata, toolStates }
    })
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = this.db.getDb()

    db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId)).run()

    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()

    console.log(`[SessionService] Deleted session: ${sessionId}`)
  }

  /**
   * 删除指定消息之后的所有消息（用于编辑历史消息并重新发送）
   */
  async deleteMessagesAfter(sessionId: string, messageId: number): Promise<number> {
    const db = this.db.getDb()

    // 删除该消息之后的所有消息（id > messageId，精确删除）
    const result = db
      .delete(schema.messages)
      .where(and(eq(schema.messages.sessionId, sessionId), gt(schema.messages.id, messageId)))
      .run()

    console.log(
      `[SessionService] Deleted ${result.changes} messages after ${messageId} in session ${sessionId}`
    )

    return result.changes
  }

  async updateSession(sessionId: string, updates: { title?: string }): Promise<void> {
    const db = this.db.getDb()
    const now = new Date()

    const updateData: any = { updatedAt: now }

    if (updates.title !== undefined) {
      updateData.title = updates.title
    }

    db.update(schema.sessions).set(updateData).where(eq(schema.sessions.id, sessionId)).run()
  }

  async maybeGenerateTitle(sessionId: string): Promise<void> {
    const sessionMessages = await this.getMessages(sessionId)
    const userMessages = sessionMessages.filter((m) => m.role === 'user')

    if (userMessages.length !== 1) {
      return
    }

    await this.generateSessionTitle(sessionId, sessionMessages)
  }

  private async generateSessionTitle(
    sessionId: string,
    sessionMessages: ChatMessage[]
  ): Promise<void> {
    try {
      const userMsg = sessionMessages.find((m) => m.role === 'user')
      const assistantMsg = sessionMessages.find((m) => m.role === 'assistant')

      const getTextFromContent = (content: ChatMessage['content']): string => {
        if (typeof content === 'string') {
          return content
        }

        return content
          .filter((part): part is TextPart => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      }

      const userContent = userMsg ? getTextFromContent(userMsg.content) : ''
      const assistantContent = assistantMsg ? getTextFromContent(assistantMsg.content) : ''

      const titlePrompt = `Summarize the following conversation with a very concise title (3-5 words maximum, in Chinese if the conversation is in Chinese).

Do NOT repeat the assistant's greeting or questions.
Do NOT use quotes.
Just provide the core topic.

User: ${userContent.slice(0, 200)}
Assistant: ${assistantContent.slice(0, 200)}

Title (3-5 words):`

      const { text } = await generateText({
        model: createQwen({
          apiKey: process.env.DASHSCOPE_API_KEY,
          baseURL: process.env.DASHSCOPE_BASE_URL
        })('qwen-plus'),
        prompt: titlePrompt
      })

      let generatedTitle = text
        .trim()
        .replace(/^["'】【《》「」『』""'']+|["'】【《》「」『』""'']+$/g, '')
        .replace(/\n/g, ' ')
        .replace(/[:：]/g, '')
        .slice(0, 50)

      if (generatedTitle && generatedTitle.length > 2) {
        const db = this.db.getDb()
        db.update(schema.sessions)
          .set({ title: generatedTitle })
          .where(eq(schema.sessions.id, sessionId))
          .run()

        console.log(`[SessionService] Generated title: ${generatedTitle}`)
      }
    } catch (error) {
      console.error('[SessionService] Failed to generate title:', error)
    }
  }
}
