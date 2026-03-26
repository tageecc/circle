/**
 * 渲染进程 Todo 类型定义
 */

export interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: number
  updatedAt: number
}

export type TodoStatus = Todo['status']
