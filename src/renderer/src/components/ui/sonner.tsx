import { useEffect, useState, ReactNode, useRef } from 'react'
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  Copy,
  Check
} from 'lucide-react'
import { Toaster as Sonner, toast as sonnerToast, ExternalToast, ToasterProps } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { NotificationType } from '@/contexts/notification-context'
import { cn } from '@/lib/utils'

// 全局通知添加函数的引用，由 NotificationProvider 设置
let globalAddNotification:
  | ((notification: { type: NotificationType; title: string; description?: string }) => void)
  | null = null

// 供 NotificationProvider 调用，设置全局通知添加函数
export function setGlobalNotificationHandler(handler: typeof globalAddNotification) {
  globalAddNotification = handler
}

// 包装后的 toast 函数，同时发送到 sonner 和通知历史
type ToastOptions = ExternalToast & {
  description?: string
}

// Copy button component for toast
function ToastCopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'group-hover/toast:opacity-100 opacity-0 transition-opacity',
        'absolute right-2 top-2 flex items-center justify-center',
        'h-7 w-7 rounded-md hover:bg-black/5 dark:hover:bg-white/5',
        'text-muted-foreground hover:text-foreground transition-colors',
        'z-50'
      )}
      title={t('common.copy')}
    >
      {copied ? (
        <Check className="size-4 text-green-500" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  )
}

// 提取文本内容（如果是 ReactNode，尝试提取文本；否则返回原始字符串）
function extractTextContent(message: ReactNode): string {
  if (typeof message === 'string') return message
  if (typeof message === 'number') return String(message)
  // 对于复杂的 ReactNode，返回一个简单描述
  return i18n.t('toast.completed_fallback')
}

function createWrappedToast() {
  const wrappedToast = (message: ReactNode, options?: ToastOptions) => {
    const result = sonnerToast(message, options)
    // 默认类型的 toast 不保存到通知历史（通常是临时提示）
    return result
  }

  wrappedToast.success = (message: ReactNode, options?: ToastOptions) => {
    const result = sonnerToast.success(message, options)
    globalAddNotification?.({
      type: 'success',
      title: extractTextContent(message),
      description: options?.description
    })
    return result
  }

  wrappedToast.error = (message: ReactNode, options?: ToastOptions) => {
    const textContent = extractTextContent(message)
    const fullText = options?.description
      ? `${textContent}\n\n${options.description}`
      : textContent
    
    const result = sonnerToast.error(
      <div className="group/toast relative pr-10">
        <div>{message}</div>
        {options?.description && (
          <div className="text-xs opacity-80 mt-1">{options.description}</div>
        )}
        <ToastCopyButton text={fullText} />
      </div>,
      {
        ...options,
        description: undefined
      }
    )
    globalAddNotification?.({
      type: 'error',
      title: textContent,
      description: options?.description
    })
    return result
  }

  wrappedToast.warning = (message: ReactNode, options?: ToastOptions) => {
    const textContent = extractTextContent(message)
    const fullText = options?.description
      ? `${textContent}\n\n${options.description}`
      : textContent
    
    const result = sonnerToast.warning(
      <div className="group/toast relative pr-10">
        <div>{message}</div>
        {options?.description && (
          <div className="text-xs opacity-80 mt-1">{options.description}</div>
        )}
        <ToastCopyButton text={fullText} />
      </div>,
      {
        ...options,
        description: undefined
      }
    )
    globalAddNotification?.({
      type: 'warning',
      title: textContent,
      description: options?.description
    })
    return result
  }

  wrappedToast.info = (message: ReactNode, options?: ToastOptions) => {
    const result = sonnerToast.info(message, options)
    globalAddNotification?.({
      type: 'info',
      title: extractTextContent(message),
      description: options?.description
    })
    return result
  }

  // 透传其他方法
  wrappedToast.loading = sonnerToast.loading
  wrappedToast.promise = sonnerToast.promise
  wrappedToast.custom = sonnerToast.custom
  wrappedToast.message = sonnerToast.message
  wrappedToast.dismiss = sonnerToast.dismiss

  return wrappedToast
}

export const toast = createWrappedToast()

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    // 检测当前主题
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark' : 'light')
    }

    checkTheme()

    // 监听主题变化
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)'
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
