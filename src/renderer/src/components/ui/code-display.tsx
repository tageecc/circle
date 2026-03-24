import { cn } from '@/lib/utils'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './button'
import { MonacoCodeEditor } from '../code/MonacoCodeEditor'
import { useMonaco } from '@monaco-editor/react'
import type * as MonacoType from 'monaco-editor'

export type CodeDisplayProps = {
  code: string
  language?: string
  className?: string
  showHeader?: boolean
  showCopy?: boolean
  maxHeight?: string
  // Diff 相关
  originalCode?: string // 提供则显示 diff 对比
  showDiff?: boolean // 是否启用 diff 模式
}

// Monaco 主题背景色配置
const MONACO_THEME_BG = {
  'one-dark-pro': '#282c34',
  'one-light': '#fafafa'
} as const

// Monaco 编辑器尺寸配置
const EDITOR_CONFIG = {
  fontSize: 12,
  lineHeight: 18,
  paddingVertical: 12
} as const

// 只读展示的编辑器配置（精简配置，禁用IDE功能）
// @ts-ignore - Monaco types compatibility
const DISPLAY_EDITOR_SETTINGS: any = {
  fontSize: EDITOR_CONFIG.fontSize,
  lineHeight: EDITOR_CONFIG.lineHeight,
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
  minimap: { enabled: false },
  wordWrap: 'off',
  lineNumbers: 'off',
  gitBlame: false,
  // 增强：完全静态化配置，隐藏光标和交互
  readOnly: true,
  domReadOnly: true, // 禁止获取焦点
  renderLineHighlight: 'none', // 禁用当前行高亮
  hover: { enabled: false }, // 禁用悬停提示
  contextmenu: false, // 禁用右键菜单
  matchBrackets: 'never', // 禁用括号匹配
  cursorStyle: 'line',
  cursorWidth: 0, // 隐藏光标
  folding: false, // 禁用折叠
  scrollBeyondLastLine: false,
  scrollbar: {
    vertical: 'hidden',
    horizontal: 'auto',
    useShadows: false,
    handleMouseWheel: true
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  occurrencesHighlight: 'off',
  selectionHighlight: false,
  renderWhitespace: 'none',
  links: false
}

/**
 * 计算代码编辑器的实际高度
 * 根据代码行数自适应，但不超过最大高度
 */
function calculateEditorHeight(code: string | undefined, maxHeight: string): string {
  if (!code || code.trim() === '') {
    return '60px'
  }

  const lines = code.split('\n').length
  const padding = EDITOR_CONFIG.paddingVertical * 2
  const calculatedHeight = lines * EDITOR_CONFIG.lineHeight + padding
  const maxHeightNum = parseInt(maxHeight)

  return `${Math.min(calculatedHeight, maxHeightNum)}px`
}

/**
 * 简单的逐行 diff 计算
 * 返回修改和新增行的行号
 */
function calculateSimpleDiff(
  original: string,
  modified: string
): {
  modifiedLines: number[]
  insertedLines: number[]
} {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')

  const changedLines: number[] = []
  const insertedLines: number[] = []

  const maxLen = Math.max(originalLines.length, modifiedLines.length)

  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i]
    const modLine = modifiedLines[i]

    if (origLine === undefined && modLine !== undefined) {
      // 新增行
      insertedLines.push(i + 1)
    } else if (origLine !== modLine && modLine !== undefined) {
      // 修改行
      changedLines.push(i + 1)
    }
  }

  return { modifiedLines: changedLines, insertedLines }
}

/**
 * 统一的代码展示组件
 * 基于 Monaco Editor 实现只读代码展示
 */
export function CodeDisplay({
  code,
  language = 'plaintext',
  className,
  showHeader = true,
  showCopy = true,
  maxHeight = '400px',
  originalCode,
  showDiff = false
}: CodeDisplayProps) {
  const monaco = useMonaco()
  const [theme, setTheme] = useState<'one-dark-pro' | 'one-light'>(() => {
    const savedTheme = localStorage.getItem('circle-theme')
    if (savedTheme) {
      return savedTheme === 'dark' ? 'one-dark-pro' : 'one-light'
    }
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'one-dark-pro' : 'one-light'
  })

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<string[]>([])

  // 使用 useMemo 缓存高度计算，避免每次渲染都重新计算
  const editorHeight = useMemo(() => calculateEditorHeight(code, maxHeight), [code, maxHeight])

  // 计算 diff（如果启用）
  const diffInfo = useMemo(() => {
    if (!showDiff || !originalCode) return null
    return calculateSimpleDiff(originalCode, code)
  }, [showDiff, originalCode, code])

  // 监听主题变化
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'one-dark-pro' : 'one-light')
    }

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  // 应用 diff 装饰器（红绿高亮）
  useEffect(() => {
    if (!editorRef.current || !diffInfo || !monaco) return

    const editor = editorRef.current
    const decorations: MonacoType.editor.IModelDeltaDecoration[] = []

    // 修改的行（绿色背景）
    diffInfo.modifiedLines.forEach((lineNumber) => {
      decorations.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: 'diff-line-modified',
          linesDecorationsClassName: 'diff-line-gutter-modified'
        }
      })
    })

    // 新增的行（绿色背景）
    diffInfo.insertedLines.forEach((lineNumber) => {
      decorations.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: 'diff-line-inserted',
          linesDecorationsClassName: 'diff-line-gutter-inserted'
        }
      })
    })

    // 应用装饰器
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations)

    return () => {
      if (editorRef.current) {
        editorRef.current.deltaDecorations(decorationsRef.current, [])
      }
    }
  }, [diffInfo, monaco])

  // Editor 挂载回调
  const handleEditorMount = (editor: MonacoType.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
  }

  // 纯代码模式 - 无 UI
  if (!showHeader) {
    return (
      <div
        className={cn('overflow-hidden', className)}
        style={{ backgroundColor: MONACO_THEME_BG[theme] }}
      >
        <MonacoCodeEditor
          value={code}
          language={language}
          height={editorHeight}
          readOnly={true}
          enableLanguageService={false}
          enableGitBlame={false}
          theme={theme}
          editorSettings={DISPLAY_EDITOR_SETTINGS}
          onMount={handleEditorMount}
        />
      </div>
    )
  }

  // 完整 UI 模式 - 带标题栏和复制按钮
  return (
    <CodeDisplayWithHeader
      code={code}
      language={language}
      theme={theme}
      editorHeight={editorHeight}
      showCopy={showCopy}
      className={className}
      onEditorMount={handleEditorMount}
    />
  )
}

// 带标题栏的代码展示（拆分组件避免不必要的状态初始化）
function CodeDisplayWithHeader({
  code,
  language,
  theme,
  editorHeight,
  showCopy,
  className,
  onEditorMount
}: {
  code: string
  language: string
  theme: 'one-dark-pro' | 'one-light'
  editorHeight: string
  showCopy: boolean
  className?: string
  onEditorMount?: (editor: MonacoType.editor.IStandaloneCodeEditor) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <div
      className={cn(
        'not-prose flex w-full flex-col overflow-clip border',
        'border-border bg-card text-card-foreground rounded-xl',
        className
      )}
    >
      <div className="flex items-center justify-between px-2 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wide">
          {language}
        </span>
        {showCopy && (
          <Button variant="link" size="icon" className="h-4 w-4" onClick={handleCopy}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>
        )}
      </div>

      <div className={cn('overflow-hidden')} style={{ backgroundColor: MONACO_THEME_BG[theme] }}>
        <MonacoCodeEditor
          value={code}
          language={language}
          height={editorHeight}
          readOnly={true}
          enableLanguageService={false}
          enableGitBlame={false}
          theme={theme}
          editorSettings={DISPLAY_EDITOR_SETTINGS}
          onMount={onEditorMount}
        />
      </div>
    </div>
  )
}
