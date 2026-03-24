/**
 * 简化的 useToast hook
 * 基于 sonner 库，提供简单的 toast 通知功能
 */
import type { ReactNode } from 'react'
import { toast as sonnerToast } from 'sonner'

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    if (variant === 'destructive') {
      sonnerToast.error(title, {
        description
      })
    } else {
      sonnerToast(title, {
        description
      })
    }
  }

  return {
    toast,
    dismiss: sonnerToast.dismiss,
    toasts: [] as Array<{
      id: string
      title?: ReactNode
      description?: ReactNode
      action?: ReactNode
    }>
  }
}

export { sonnerToast as toast }
