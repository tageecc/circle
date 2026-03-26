import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode
} from 'react'
import { setGlobalNotificationHandler } from '@/components/ui/sonner'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  description?: string
  timestamp: number
  read: boolean
}

interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const MAX_NOTIFICATIONS = 100 // 最多保存100条通知

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 从 SQLite 加载通知
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await window.api.notifications.getAll()
        setNotifications(
          data.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            description: n.description ?? undefined,
            timestamp: new Date(n.timestamp).getTime(),
            read: n.read
          }))
        )
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        setIsLoaded(true)
      }
    }
    loadNotifications()
  }, [])

  const addNotification = useCallback(
    async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
      const newNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false
      }

      // 立即更新 UI
      setNotifications((prev) => {
        const updated = [newNotification, ...prev]
        if (updated.length > MAX_NOTIFICATIONS) {
          return updated.slice(0, MAX_NOTIFICATIONS)
        }
        return updated
      })

      // 异步保存到 SQLite
      try {
        await window.api.notifications.add({
          id: newNotification.id,
          type: newNotification.type,
          title: newNotification.title,
          description: newNotification.description,
          timestamp: new Date(newNotification.timestamp)
        })
      } catch (error) {
        console.error('Failed to save notification:', error)
      }
    },
    []
  )

  // 设置全局通知处理函数，让 toast 能够将通知保存到历史
  useEffect(() => {
    if (!isLoaded) return

    setGlobalNotificationHandler(addNotification)
    return () => setGlobalNotificationHandler(null)
  }, [addNotification, isLoaded])

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await window.api.notifications.markAsRead(id)
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await window.api.notifications.markAllAsRead()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }, [])

  const removeNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await window.api.notifications.remove(id)
    } catch (error) {
      console.error('Failed to remove notification:', error)
    }
  }, [])

  const clearAll = useCallback(async () => {
    setNotifications([])
    try {
      await window.api.notifications.clearAll()
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }, [])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    }),
    [
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    ]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
