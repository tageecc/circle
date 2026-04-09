import { create } from 'zustand'
import type { Session, Message } from '@/types/chat'

interface ChatState {
  sessions: Session[]
  currentSessionId: string | null
  loadedSessions: Set<string>
  openSessionIds: string[]

  setSessions: (sessionsOrUpdater: Session[] | ((prev: Session[]) => Session[])) => void
  mergeSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  removeSession: (sessionId: string) => void
  markSessionAsLoaded: (sessionId: string) => void
  openSession: (sessionId: string) => void
  closeSessionTab: (sessionId: string) => void
  resetState: () => void
  addMessage: (sessionId: string, message: Message) => void
  updateLastAssistantMessage: (sessionId: string, updates: Partial<Message>) => void
  batchUpdateSession: (
    sessionId: string,
    updates: {
      messages?: Message[]
      title?: string
      metadata?: Record<string, unknown>
    }
  ) => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  currentSessionId: null,
  loadedSessions: new Set<string>(),
  openSessionIds: [],

  setSessions: (sessionsOrUpdater) =>
    set((state) => {
      const sessions =
        typeof sessionsOrUpdater === 'function'
          ? sessionsOrUpdater(state.sessions)
          : sessionsOrUpdater

      const validIds = new Set(sessions.map((session) => session.id))
      const openSessionIds = state.openSessionIds.filter((id) => validIds.has(id))
      const loadedSessions = new Set(
        Array.from(state.loadedSessions).filter((id) => validIds.has(id))
      )
      const currentSessionId =
        state.currentSessionId && validIds.has(state.currentSessionId)
          ? state.currentSessionId
          : openSessionIds[0] || null

      return {
        sessions,
        currentSessionId,
        loadedSessions,
        openSessionIds
      }
    }),

  mergeSessions: (incomingSessions) =>
    set((state) => {
      const sessionMap = new Map(state.sessions.map((session) => [session.id, session]))

      incomingSessions.forEach((incoming) => {
        const existing = sessionMap.get(incoming.id)
        if (!existing) {
          sessionMap.set(incoming.id, incoming)
          return
        }

        sessionMap.set(incoming.id, {
          ...incoming,
          messages: existing.messages.length > 0 ? existing.messages : incoming.messages,
          metadata: {
            ...(incoming.metadata || {}),
            ...(existing.metadata || {})
          }
        })
      })

      const sessions = Array.from(sessionMap.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )
      const validIds = new Set(sessions.map((session) => session.id))
      const openSessionIds = state.openSessionIds.filter((id) => validIds.has(id))
      const loadedSessions = new Set(
        Array.from(state.loadedSessions).filter((id) => validIds.has(id))
      )

      const fallbackSessionId = sessions[0]?.id || null
      const currentSessionId =
        state.currentSessionId && validIds.has(state.currentSessionId)
          ? state.currentSessionId
          : openSessionIds[0] || fallbackSessionId

      return {
        sessions,
        currentSessionId,
        loadedSessions,
        openSessionIds: openSessionIds.length > 0 || !fallbackSessionId ? openSessionIds : [fallbackSessionId]
      }
    }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((existing) => existing.id !== session.id)],
      currentSessionId: session.id,
      openSessionIds: [session.id, ...state.openSessionIds.filter((id) => id !== session.id)]
    })),

  updateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, ...updates } : s))
    })),

  removeSession: (sessionId) =>
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId)
      const newOpenIds = state.openSessionIds.filter((id) => id !== sessionId)
      const newLoadedSessions = new Set(state.loadedSessions)
      newLoadedSessions.delete(sessionId)
      const newCurrentId =
        state.currentSessionId === sessionId ? newOpenIds[0] || null : state.currentSessionId
      return {
        sessions: newSessions,
        loadedSessions: newLoadedSessions,
        openSessionIds: newOpenIds,
        currentSessionId: newCurrentId
      }
    }),

  markSessionAsLoaded: (sessionId) =>
    set((state) => {
      const newLoadedSessions = new Set(state.loadedSessions)
      newLoadedSessions.add(sessionId)
      return { loadedSessions: newLoadedSessions }
    }),

  openSession: (sessionId) =>
    set((state) => {
      if (state.openSessionIds.includes(sessionId)) {
        return { currentSessionId: sessionId }
      }
      return {
        openSessionIds: [...state.openSessionIds, sessionId],
        currentSessionId: sessionId
      }
    }),

  closeSessionTab: (sessionId) =>
    set((state) => {
      const newOpenIds = state.openSessionIds.filter((id) => id !== sessionId)
      const newCurrentId =
        state.currentSessionId === sessionId ? newOpenIds[0] || null : state.currentSessionId
      return {
        openSessionIds: newOpenIds,
        currentSessionId: newCurrentId
      }
    }),

  resetState: () =>
    set({
      sessions: [],
      currentSessionId: null,
      loadedSessions: new Set<string>(),
      openSessionIds: []
    }),

  addMessage: (sessionId, message) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, messages: [...s.messages, message] } : s
      )
    })),

  updateLastAssistantMessage: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const messages = [...s.messages]
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages[i] = { ...messages[i], ...updates }
            break
          }
        }
        return { ...s, messages }
      })
    })),

  batchUpdateSession: (sessionId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              ...(updates.messages && { messages: updates.messages }),
              ...(updates.title && { title: updates.title }),
              ...(updates.metadata && {
                metadata: { ...s.metadata, ...updates.metadata }
              })
            }
          : s
      )
    }))
}))

export const selectCurrentSession = (state: ChatState): Session | undefined => {
  if (!state.currentSessionId) return undefined
  return state.sessions.find((s) => s.id === state.currentSessionId)
}

export const selectCurrentMessages = (state: ChatState): Message[] => {
  const currentSession = selectCurrentSession(state)
  return currentSession?.messages || []
}

export const selectIsSessionLoaded = (state: ChatState, sessionId: string): boolean => {
  return state.loadedSessions.has(sessionId)
}
