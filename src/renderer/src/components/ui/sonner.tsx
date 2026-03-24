import { useEffect, useState } from 'react'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

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
      theme={theme}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group toast !bg-card !text-foreground !border-border !shadow-lg',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground hover:!bg-primary/90',
          cancelButton: '!bg-secondary !text-secondary-foreground hover:!bg-secondary/80',
          success: '!bg-card !text-foreground !border-chart-2',
          error: '!bg-card !text-foreground !border-destructive',
          warning: '!bg-card !text-foreground !border-chart-3',
          info: '!bg-card !text-foreground !border-primary'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
