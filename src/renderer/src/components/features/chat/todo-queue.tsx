import { memo, useEffect, useState } from 'react'
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent
} from '@/components/ai-elements/queue'
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'
import type { Todo } from '@/types/todo'

interface TodoQueueProps {
  sessionId: string | null
}

export const TodoQueue = memo(function TodoQueue({ sessionId }: TodoQueueProps) {
  const [todos, setTodos] = useState<Todo[]>([])

  // 初始化加载：当 sessionId 改变时，加载现有 todos
  useEffect(() => {
    if (!sessionId) {
      setTodos([])
      return
    }

    window.api.todo
      .get(sessionId)
      .then((loadedTodos) => {
        setTodos(loadedTodos)
      })
      .catch((error) => {
        console.error('[TodoQueue] Failed to load todos:', error)
        setTodos([])
      })
  }, [sessionId])

  // 监听 todo 更新事件（AI 调用 todo_write 时）
  useEffect(() => {
    const unsubscribe = window.api.todo.onUpdate((event) => {
      // 只更新当前 session 的 todos
      if (event.sessionId === sessionId) {
        setTodos(event.todos)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sessionId])

  // 没有 todos 时不显示
  if (todos.length === 0) {
    return null
  }

  // 统计各状态数量
  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.status === 'completed').length,
    in_progress: todos.filter((t) => t.status === 'in_progress').length,
    pending: todos.filter((t) => t.status === 'pending').length,
    cancelled: todos.filter((t) => t.status === 'cancelled').length
  }

  // 获取状态图标
  const getStatusIcon = (status: Todo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-400" />
      default:
        return <Circle className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <Queue className="mb-4">
      <QueueSection defaultOpen={true}>
        <QueueSectionTrigger>
          <QueueSectionLabel
            label="Tasks"
            count={stats.total}
            icon={
              stats.completed === stats.total ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : stats.in_progress > 0 ? (
                <Clock className="h-4 w-4 text-blue-500" />
              ) : (
                <Circle className="h-4 w-4" />
              )
            }
          />
        </QueueSectionTrigger>
        <QueueSectionContent>
          <QueueList>
            {todos.map((todo) => (
              <QueueItem key={todo.id}>
                <QueueItemIndicator completed={todo.status === 'completed'}>
                  {getStatusIcon(todo.status)}
                </QueueItemIndicator>
                <QueueItemContent
                  completed={todo.status === 'completed' || todo.status === 'cancelled'}
                >
                  {todo.content}
                </QueueItemContent>
              </QueueItem>
            ))}
          </QueueList>
        </QueueSectionContent>
      </QueueSection>
    </Queue>
  )
})
