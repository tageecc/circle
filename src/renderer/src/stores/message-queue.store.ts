import { create } from 'zustand'
import type { PastedImage, Attachment } from '@/components/features/chat/chat-input'

/**
 * 队列消息项
 */
export interface QueuedMessage {
  id: string
  content: string
  images: PastedImage[]
  attachments?: Attachment[]
  modelId: string
  sessionId: string | null
  timestamp: number
}

/**
 * 消息队列状态接口
 */
interface MessageQueueState {
  // 队列数据
  queue: QueuedMessage[]

  // 队列操作
  enqueue: (message: Omit<QueuedMessage, 'id' | 'timestamp'>) => void
  dequeue: (sessionId: string | null) => QueuedMessage | undefined
  removeFromQueue: (messageId: string) => void
  clearQueue: (sessionId?: string | null) => void
  getSessionQueue: (sessionId: string | null) => QueuedMessage[]
}

export const useMessageQueueStore = create<MessageQueueState>((set, get) => ({
  queue: [],

  enqueue: (message) =>
    set((state) => ({
      queue: [
        ...state.queue,
        {
          ...message,
          id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now()
        }
      ]
    })),

  dequeue: (sessionId) => {
    const state = get()

    const sessionQueue = state.queue.filter((msg) => msg.sessionId === sessionId)
    if (sessionQueue.length === 0) return undefined

    const targetMessage = sessionQueue[0]
    const remainingQueue = state.queue.filter((msg) => msg.id !== targetMessage.id)

    set({ queue: remainingQueue })
    return targetMessage
  },

  removeFromQueue: (messageId) =>
    set((state) => ({
      queue: state.queue.filter((msg) => msg.id !== messageId)
    })),

  clearQueue: (sessionId) =>
    set((state) => ({
      queue: sessionId !== undefined ? state.queue.filter((msg) => msg.sessionId !== sessionId) : []
    })),

  getSessionQueue: (sessionId) => {
    const state = get()
    return state.queue.filter((msg) => msg.sessionId === sessionId)
  }
}))
