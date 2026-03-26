import { cn } from '@/lib/utils'
import { useEffect, useState, memo } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './button'
import { codeToHtml } from 'shiki'

export type CodeBlockProps = {
  code: string
  language?: string
  className?: string
  showCopy?: boolean
}

/**
 * 轻量级代码块组件
 * 使用 Shiki 进行语法高亮，比 Monaco Editor 更轻量
 */
export function CodeBlock({
  code,
  language = 'plaintext',
  className,
  showCopy = true
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [highlightedCode, setHighlightedCode] = useState('')
  const [theme, setTheme] = useState<'dark-plus' | 'light-plus'>(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'dark-plus' : 'light-plus'
  })

  // 监听主题变化
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark-plus' : 'light-plus')
    }

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  // 使用 Shiki 进行语法高亮
  useEffect(() => {
    if (!code) {
      setHighlightedCode('')
      return
    }

    let isMounted = true

    codeToHtml(code, {
      lang: language,
      theme,
      structure: 'inline'
    })
      .then((html) => {
        if (isMounted) {
          setHighlightedCode(html)
        }
      })
      .catch((err) => {
        console.error('Shiki highlighting failed:', err)
        // 降级：显示纯文本但保留结构
        if (isMounted) {
          const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          setHighlightedCode(`<pre><code>${escaped}</code></pre>`)
        }
      })

    return () => {
      isMounted = false
    }
  }, [code, language, theme])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  if (!code || !highlightedCode) {
    return null
  }

  return (
    <div
      className={cn(
        'not-prose relative w-full overflow-auto rounded-lg border border-border bg-muted/30 my-3 first:mt-0 last:mb-0',
        className
      )}
    >
      {/* 右上角悬浮复制按钮 */}
      {showCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 h-7 w-7 bg-background/80 hover:bg-background backdrop-blur-sm opacity-60 hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      )}

      {/* Shiki 高亮的代码 */}
      <div
        className="text-sm overflow-x-auto px-4 py-3 [&>pre]:m-0! [&>pre]:p-0! [&>pre]:bg-transparent! [&>pre>code]:bg-transparent!"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  )
}

export const MemoizedCodeBlock = memo(CodeBlock, (prev, next) => {
  return (
    prev.code === next.code && prev.language === next.language && prev.showCopy === next.showCopy
  )
})
