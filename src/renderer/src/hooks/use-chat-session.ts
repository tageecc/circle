import { useEffect, useCallback } from 'react'
import { useChatStore, selectIsSessionLoaded, selectCurrentSession } from '@/stores/chat.store'
import type { Session, Message } from '@/types/chat'
import { toast } from '@/components/ui/sonner'

export function useChatSession(workspaceRoot: string | null) {
  const sessions = useChatStore((state) => state.sessions)
  const currentSessionId = useChatStore((state) => state.currentSessionId)
  const currentSession = useChatStore(selectCurrentSession)
  const setSessions = useChatStore((state) => state.setSessions)
  const updateSession = useChatStore((state) => state.updateSession)
  const removeSession = useChatStore((state) => state.removeSession)
  const markSessionAsLoaded = useChatStore((state) => state.markSessionAsLoaded)
  const batchUpdateSession = useChatStore((state) => state.batchUpdateSession)
  const addSession = useChatStore((state) => state.addSession)
  const openSession = useChatStore((state) => state.openSession)
  const closeSessionTab = useChatStore((state) => state.closeSessionTab)
  const openSessionIds = useChatStore((state) => state.openSessionIds)

  const loadHistorySessions = useCallback(async () => {
    if (!workspaceRoot) return

    try {
      const sessionsData = await window.api.sessions.getByProject(workspaceRoot)

      if (sessionsData && sessionsData.length > 0) {
        const historySessions: Session[] = sessionsData.map((session: any) => ({
          id: session.id,
          title: session.title,
          modelId: session.modelId,
          messages: [],
          createdAt: new Date(session.createdAt),
          metadata: session.metadata
        }))

        const state = useChatStore.getState()
        const previousSessionsCount = state.sessions.length
        setSessions(historySessions)

        if (!state.currentSessionId && historySessions.length > 0 && previousSessionsCount === 0) {
          openSession(historySessions[0].id)
        }
      }
    } catch (error) {
      console.error('加载历史会话失败:', error)
    }
  }, [workspaceRoot, setSessions, openSession])

  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      try {
        const sessionData = await window.api.sessions.getWithMessages(sessionId)

        if (sessionData?.messages && sessionData.messages.length > 0) {
          const formattedMessages: Message[] = sessionData.messages.map((msg: any) => ({
            id: msg.id || `${msg.role}-${Date.now()}-${Math.random()}`,
            role: msg.role as 'user' | 'assistant' | 'tool',
            content: msg.content,
            metadata: msg.metadata,
            images: msg.images || [],
            timestamp: new Date(msg.timestamp || Date.now())
          }))

          batchUpdateSession(sessionId, {
            messages: formattedMessages,
            metadata: sessionData.metadata
          })
        }
      } catch (error) {
        console.error('加载会话消息失败:', error)
      }
    },
    [batchUpdateSession]
  )

  useEffect(() => {
    if (workspaceRoot) {
      loadHistorySessions()
    }
  }, [workspaceRoot, loadHistorySessions])

  useEffect(() => {
    const isLoaded = selectIsSessionLoaded(useChatStore.getState(), currentSessionId || '')
    if (currentSessionId && !isLoaded) {
      markSessionAsLoaded(currentSessionId)
      loadSessionMessages(currentSessionId)
    }
  }, [currentSessionId, markSessionAsLoaded, loadSessionMessages])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await window.api.sessions.delete(sessionId)
        removeSession(sessionId)
      } catch (error) {
        console.error('删除会话失败:', error)
        throw error
      }
    },
    [removeSession]
  )

  const updateTitle = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId)
      if (!session || session.messages.length === 0) return

      const firstUserMessage = session.messages.find((m) => m.role === 'user')
      if (!firstUserMessage) return

      const content =
        typeof firstUserMessage.content === 'string'
          ? firstUserMessage.content
          : firstUserMessage.content.find((p) => p.type === 'text')?.text || ''

      if (!content) return
      const newTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '')

      try {
        await window.api.sessions.update(sessionId, { title: newTitle })
        updateSession(sessionId, { title: newTitle })
      } catch (error) {
        console.error('更新标题失败:', error)
      }
    },
    [sessions, updateSession]
  )

  const createNewSession = useCallback(async (modelId: string) => {
    if (!workspaceRoot) return

    try {
      const sessionId = await window.api.sessions.create(modelId, workspaceRoot)

      const newSession: Session = {
        id: sessionId,
        title: 'New Chat',
        modelId,
        messages: [],
        createdAt: new Date()
      }

      addSession(newSession)
    } catch (error) {
      console.error('创建新会话失败:', error)
      toast.error('Failed to create session')
    }
  }, [workspaceRoot, addSession])

  return {
    sessions,
    currentSession: currentSession || null,
    currentSessionId,
    deleteSession,
    updateSessionTitle: updateTitle,
    markSessionAsLoaded,
    openSession,
    closeSessionTab,
    openSessionIds,
    createNewSession
  }
}
