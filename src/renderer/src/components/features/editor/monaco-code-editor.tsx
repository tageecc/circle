import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Editor, loader } from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor, IDisposable } from 'monaco-editor'
import { Loader2 } from 'lucide-react'
import * as monaco from 'monaco-editor'
import { useSettings } from '@/contexts/settings-context'
import { useLanguageServiceProviders } from '@/hooks/use-language-service-providers'
import { configureMonacoLanguages } from '@/config/monaco-languages'
import { registerMonacoThemes } from '@/config/monaco-themes'
import { defaultEditorOptions } from '@/config/monaco-editor-options'
import type { MonacoCodeEditorProps, GitBlameLine } from './monaco-editor.types'
import { MONACO_ACTIONS_MAP, parseMonacoKeybinding } from '@/lib/monaco-keybindings'
import { registerInlineCompletionProvider } from '@/services/inline-completion-provider'
import { eventBus } from '@/lib/event-bus'
import { useTranslation } from 'react-i18next'

// ⭐ 配置 Monaco 使用本地导入的实例 + Web Workers
loader.config({
  monaco,
  // ✅ Monaco Editor Web Worker 配置（性能优化）
  // 所有语言服务（语法高亮、代码提示、诊断）都在 Worker 中运行
  // 这样可以避免阻塞主线程，提升编辑器响应速度
  'vs/nls': {
    availableLanguages: {}
  }
})

/**
 * Monaco 代码编辑器组件
 */
export function MonacoCodeEditor({
  value,
  language = 'javascript',
  height = '100%',
  width = '100%',
  readOnly = false,
  path,
  workspaceRoot,
  enableLanguageService = true,
  enableGitBlame = true,
  options: propOptions,
  theme: propTheme,
  onChange,
  onSave,
  onDiagnosticsChange,
  onCursorPositionChange,
  onMount
}: MonacoCodeEditorProps) {
  const { t } = useTranslation()
  const { editorOptions: globalOptions, keymapSettings } = useSettings()

  // 生成一个稳定的匿名 ID，用于在未提供 path 时作为 Model 的标识
  const [anonymousId] = useState(
    () => `inmemory-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const modelPath = path || anonymousId

  // 合并配置：默认配置 < 全局用户配置 < 组件传入配置
  const mergedOptions = useMemo(() => {
    return { ...defaultEditorOptions, ...globalOptions, ...propOptions, readOnly }
  }, [globalOptions, propOptions, readOnly])

  const shouldEnableGitBlame = enableGitBlame

  const [internalTheme, setInternalTheme] = useState<'one-dark-pro' | 'one-light'>(() => {
    const savedTheme = localStorage.getItem('circle-theme')
    if (savedTheme) return savedTheme === 'dark' ? 'one-dark-pro' : 'one-light'
    return document.documentElement.classList.contains('dark') ? 'one-dark-pro' : 'one-light'
  })

  // 如果传入了 theme 则使用传入的，否则使用内部管理的 theme
  const theme = propTheme || internalTheme

  const [blameInfo, setBlameInfo] = useState<GitBlameLine[]>([])
  const [currentLine, setCurrentLine] = useState<number>(1)

  const codeEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const modelsMapRef = useRef<Map<string, editor.ITextModel>>(new Map())
  const modelLRURef = useRef<string[]>([]) // LRU队列
  const decorationsRef = useRef<string[]>([])
  const diagnosticsTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onChangeTimerRef = useRef<NodeJS.Timeout | null>(null) // 内容变化防抖定时器
  const blameDecorationTimerRef = useRef<NodeJS.Timeout | null>(null) // Git Blame 装饰器防抖定时器
  const onDiagnosticsChangeRef = useRef(onDiagnosticsChange)
  const currentPathRef = useRef<string | undefined>(path)
  const keybindingDisposablesRef = useRef<IDisposable[]>([])
  const inlineCompletionDisposableRef = useRef<IDisposable | null>(null)

  const MAX_CACHED_MODELS = 50 // 最多缓存50个Model
  const DIAGNOSTICS_DEBOUNCE = 1000 // 诊断防抖延迟（毫秒）
  const ONCHANGE_DEBOUNCE = 150 // 内容变化防抖延迟（毫秒）- 平衡响应速度和性能
  const BLAME_DECORATION_DEBOUNCE = 250 // Git Blame 装饰器防抖延迟（毫秒）

  useEffect(() => {
    onDiagnosticsChangeRef.current = onDiagnosticsChange
  }, [onDiagnosticsChange])

  // 初始化 Monaco 语言配置
  useEffect(() => {
    configureMonacoLanguages()
  }, [])

  // Model 管理：获取或创建指定文件的 Model (带LRU清理)
  const getOrCreateModel = useCallback((filePath: string, content: string, lang: string) => {
    if (!monacoRef.current) return null

    const uri = monacoRef.current.Uri.file(filePath)

    // 优先从Monaco的全局注册表获取已存在的Model
    let model = monacoRef.current.editor.getModel(uri)

    if (model && !model.isDisposed()) {
      // Model存在，检查内容是否需要更新
      if (model.getValue() !== content) {
        model.setValue(content)
      }

      // 更新LRU：移到队尾（最近使用）
      const lruIndex = modelLRURef.current.indexOf(filePath)
      if (lruIndex > -1) {
        modelLRURef.current.splice(lruIndex, 1)
      }
      modelLRURef.current.push(filePath)

      // 同步到本地Map（防御性编程：确保Map与Monaco注册表保持一致）
      modelsMapRef.current.set(filePath, model)
      return model
    }

    // LRU清理：如果超过最大缓存数，移除最旧的Model
    if (modelsMapRef.current.size >= MAX_CACHED_MODELS) {
      const oldestPath = modelLRURef.current.shift()
      if (oldestPath) {
        const oldModel = modelsMapRef.current.get(oldestPath)
        if (oldModel && !oldModel.isDisposed()) {
          oldModel.dispose()
        }
        modelsMapRef.current.delete(oldestPath)
      }
    }

    // Model不存在，创建新的
    model = monacoRef.current.editor.createModel(content, lang, uri)
    modelsMapRef.current.set(filePath, model)
    modelLRURef.current.push(filePath)

    return model
  }, [])

  // 主题管理
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setInternalTheme(isDark ? 'one-dark-pro' : 'one-light')
    }

    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // 清理：监听workspaceRoot变化，切换项目时清理旧项目的Models
  useEffect(() => {
    // 当workspaceRoot变化时（切换项目），清理所有Models和定时器
    return () => {
      // 清理定时器
      if (diagnosticsTimerRef.current) {
        clearTimeout(diagnosticsTimerRef.current)
      }
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current)
      }
      if (blameDecorationTimerRef.current) {
        clearTimeout(blameDecorationTimerRef.current)
      }

      // 清理 Models
      modelsMapRef.current.forEach((model) => {
        if (!model.isDisposed()) {
          model.dispose()
        }
      })
      modelsMapRef.current.clear()
      modelLRURef.current = []

      // 清理 InlineCompletionProvider
      if (inlineCompletionDisposableRef.current) {
        inlineCompletionDisposableRef.current.dispose()
        inlineCompletionDisposableRef.current = null
        console.log('[MonacoCodeEditor] InlineCompletionProvider disposed')
      }
    }
  }, [workspaceRoot])

  // 语言服务集成
  useLanguageServiceProviders({
    editor: codeEditorRef.current,
    workspaceRoot: enableLanguageService ? workspaceRoot || null : null,
    filePath: enableLanguageService ? path || '' : '',
    language: enableLanguageService ? language : ''
  })

  // Git Blame 功能
  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp * 1000
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) return t('editor.git_blame.years_ago', { count: years })
    if (months > 0) return t('editor.git_blame.months_ago', { count: months })
    if (days > 6) return t('editor.git_blame.weeks_ago', { count: Math.floor(days / 7) })
    if (days > 0) return t('editor.git_blame.days_ago', { count: days })
    if (hours > 0) return t('editor.git_blame.hours_ago', { count: hours })
    if (minutes > 0) return t('editor.git_blame.minutes_ago', { count: minutes })
    return t('editor.git_blame.just_now')
  }

  useEffect(() => {
    if (!shouldEnableGitBlame || !path) return
    ;(async () => {
      const workspaceRoot = await window.api.project.getCurrent()
      if (!workspaceRoot) return
      const blameData = await window.api.git.getBlame(workspaceRoot, path)
      setBlameInfo(blameData.lines)
    })()
  }, [path, shouldEnableGitBlame])

  const updateBlameDecorations = useCallback(() => {
    if (!codeEditorRef.current || !shouldEnableGitBlame || blameInfo.length === 0) {
      if (decorationsRef.current.length > 0 && codeEditorRef.current) {
        decorationsRef.current = codeEditorRef.current.deltaDecorations(decorationsRef.current, [])
      }
      return
    }

    const model = codeEditorRef.current.getModel()
    if (!model) return

    // 如果文件有未保存的修改，完全隐藏 blame（类似 VSCode GitLens）
    const versionId = model.getVersionId()
    const alternativeVersionId = model.getAlternativeVersionId()
    if (versionId !== alternativeVersionId) {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = codeEditorRef.current.deltaDecorations(decorationsRef.current, [])
      }
      return
    }

    // ✅ 检查行号是否有效，避免切换文件时访问越界行号
    const lineCount = model.getLineCount()
    if (currentLine < 1 || currentLine > lineCount) {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = codeEditorRef.current.deltaDecorations(decorationsRef.current, [])
      }
      return
    }

    const blame = blameInfo.find((b) => b.line === currentLine)
    if (!blame) {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = codeEditorRef.current.deltaDecorations(decorationsRef.current, [])
      }
      return
    }

    const timeAgo = formatTimeAgo(blame.authorTime)
    const maxLength = 60
    let summary = blame.summary
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '...'
    }
    const text = `     ${blame.author}, ${timeAgo} · ${summary}`
    const lineLength = model.getLineContent(currentLine).length

    decorationsRef.current = codeEditorRef.current.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(currentLine, 1, currentLine, lineLength + 1),
        options: {
          after: {
            content: text,
            inlineClassName: 'git-blame-decoration'
          }
        }
      }
    ])
  }, [blameInfo, shouldEnableGitBlame, currentLine])

  // 使用防抖更新装饰器，避免光标快速移动时频繁更新
  useEffect(() => {
    if (blameDecorationTimerRef.current) {
      clearTimeout(blameDecorationTimerRef.current)
    }
    blameDecorationTimerRef.current = setTimeout(() => {
      updateBlameDecorations()
    }, BLAME_DECORATION_DEBOUNCE)

    return () => {
      if (blameDecorationTimerRef.current) {
        clearTimeout(blameDecorationTimerRef.current)
      }
    }
  }, [updateBlameDecorations])

  // 诊断功能
  const updateDiagnostics = useCallback(
    async (currentPath: string, content: string) => {
      if (!enableLanguageService || !currentPath) return

      try {
        const newDiagnostics = await window.api.diagnostics.get(currentPath, content)
        onDiagnosticsChangeRef.current?.(newDiagnostics)

        if (codeEditorRef.current) {
          const model = codeEditorRef.current.getModel()
          if (model) {
            const monacoMarkers = newDiagnostics.map((d) => ({
              startLineNumber: d.line,
              startColumn: d.column,
              endLineNumber: d.line,
              endColumn: d.column + 1,
              message: d.message,
              severity:
                d.severity === 'error'
                  ? monaco.MarkerSeverity.Error
                  : d.severity === 'warning'
                    ? monaco.MarkerSeverity.Warning
                    : monaco.MarkerSeverity.Info,
              source: d.source,
              code: d.code?.toString()
            }))
            monaco.editor.setModelMarkers(model, 'diagnostics', monacoMarkers)
          }
        }
      } catch (error) {
        console.error('Failed to update diagnostics:', error)
      }
    },
    [enableLanguageService]
  )

  useEffect(() => {
    if (!enableLanguageService || !path) return

    if (diagnosticsTimerRef.current) clearTimeout(diagnosticsTimerRef.current)
    const timer = setTimeout(() => updateDiagnostics(path, value), DIAGNOSTICS_DEBOUNCE)
    diagnosticsTimerRef.current = timer
    return () => clearTimeout(timer)
  }, [path, value, enableLanguageService, updateDiagnostics])

  useEffect(() => {
    if (!path) return
    return () => {
      window.api.diagnostics.clear(path)
    }
  }, [path])

  // 文件切换：使用 Model 切换而不是 setValue
  useEffect(() => {
    if (!codeEditorRef.current || !monacoRef.current || !modelPath) return

    const pathChanged = currentPathRef.current !== modelPath

    if (pathChanged) {
      // 获取或创建新文件的Model
      const model = getOrCreateModel(modelPath, value, language)

      if (model) {
        // 切换到新Model
        codeEditorRef.current.setModel(model)

        // 重置视图状态
        codeEditorRef.current.setPosition({ lineNumber: 1, column: 1 })
        codeEditorRef.current.setScrollTop(0)

        currentPathRef.current = modelPath
      }
    } else {
      // 同一文件，但内容可能从外部更新（如文件被外部修改）
      const model = codeEditorRef.current.getModel()
      if (model && model.getValue() !== value) {
        model.setValue(value)
      }
    }
  }, [value, modelPath, language, getOrCreateModel])

  // 监听全局的 editor-goto-line 事件（用于搜索结果点击后的定位和高亮）
  useEffect(() => {
    const handleEditorGotoLine = ({
      filePath,
      line,
      column,
      length
    }: {
      filePath: string
      line: number
      column: number
      length?: number
    }) => {
      if (!codeEditorRef.current || filePath !== path) return

      const editor = codeEditorRef.current
      const targetLine = line || 1
      const targetColumn = column || 1

      editor.revealLineInCenter(targetLine)

      // 如果有长度信息，选中匹配的文本（产生高亮效果）
      if (length) {
        editor.setSelection({
          startLineNumber: targetLine,
          startColumn: targetColumn,
          endLineNumber: targetLine,
          endColumn: targetColumn + length
        })
      } else {
        editor.setPosition({ lineNumber: targetLine, column: targetColumn })
      }

      editor.focus()
    }

    eventBus.on('editor-goto-line', handleEditorGotoLine)
    return () => eventBus.off('editor-goto-line', handleEditorGotoLine)
  }, [path])

  // 注册快捷键
  useEffect(() => {
    if (!codeEditorRef.current || !keymapSettings.bindings) return

    const editor = codeEditorRef.current
    const bindings = keymapSettings.bindings

    // 清理旧的快捷键绑定
    keybindingDisposablesRef.current.forEach((d) => d.dispose?.())
    keybindingDisposablesRef.current = []

    Object.entries(bindings).forEach(([commandId, keyStr]) => {
      if (!keyStr) return

      const keybinding = parseMonacoKeybinding(keyStr)
      if (keybinding === 0) return

      // 1. 处理文件保存
      if (commandId === 'file.save' && onSave) {
        const actionId = `circle.keymap.${commandId}`
        const disposable = editor.addAction({
          id: actionId,
          label: 'Save',
          keybindings: [keybinding],
          run: (ed) => {
            const currentModel = ed.getModel()
            if (!currentModel) return

            const currentValue = currentModel.getValue()
            const currentFilePath = currentModel.uri.path

            onChange?.(currentValue, currentFilePath)
            onSave(currentValue, currentFilePath)
          }
        })
        if (disposable) keybindingDisposablesRef.current.push(disposable)
        return
      }

      // 2. 处理 Monaco 内置 Action 映射
      const monacoActionId = MONACO_ACTIONS_MAP[commandId]
      if (monacoActionId) {
        const actionId = `circle.keymap.${commandId}`
        const disposable = editor.addAction({
          id: actionId,
          label: commandId,
          keybindings: [keybinding],
          run: (ed) => {
            ed.trigger('keyboard', monacoActionId, null)
          }
        })
        if (disposable) keybindingDisposablesRef.current.push(disposable)
      }
    })

    return () => {
      keybindingDisposablesRef.current.forEach((d) => d.dispose?.())
      keybindingDisposablesRef.current = []
    }
  }, [keymapSettings.bindings, onSave, onChange])

  // 编辑器挂载
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
      codeEditorRef.current = editor
      monacoRef.current = monacoInstance

      // 为当前文件创建或获取 Model
      if (modelPath) {
        const model = getOrCreateModel(modelPath, value, language)
        if (model) {
          editor.setModel(model)
          currentPathRef.current = modelPath
        }
      }

      // 🔥 Cursor 策略：双层补全快捷键

      // Ctrl+Space / Cmd+Space: 手动触发 LSP 补全列表
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Space, () => {
        editor.trigger('keyboard', 'editor.action.triggerSuggest', {})
      })

      // Alt+\ (或 Option+\): 手动触发 AI inline 补全
      editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.Backslash, () => {
        editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
      })

      // Ctrl+Shift+Space / Cmd+Shift+Space: 备选触发 AI 补全
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.Space,
        () => {
          editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
        }
      )

      // 内容变化监听 - 关键：从Model URI获取路径，避免闭包陷阱
      // ✅ 添加防抖，避免快速输入时频繁触发父组件更新
      editor.onDidChangeModelContent(() => {
        const currentModel = editor.getModel()
        if (!currentModel) return

        const currentFilePath = currentModel.uri.path
        const newValue = currentModel.getValue()

        // 防抖触发 onChange，避免快速输入时的卡顿
        if (onChangeTimerRef.current) {
          clearTimeout(onChangeTimerRef.current)
        }

        onChangeTimerRef.current = setTimeout(() => {
          onChange?.(newValue, currentFilePath)
        }, ONCHANGE_DEBOUNCE)
      })

      // 光标位置监听
      editor.onDidChangeCursorPosition((e) => {
        setCurrentLine(e.position.lineNumber)
        onCursorPositionChange?.({ line: e.position.lineNumber, column: e.position.column })
      })

      editor.focus()

      // 延迟执行确保DOM完全渲染后再执行布局和装饰更新
      setTimeout(() => {
        editor.layout()
        const position = editor.getPosition()
        if (position) setCurrentLine(position.lineNumber)
        updateBlameDecorations()
      }, 100)

      // 调用外部传入的 onMount
      onMount?.(editor, monacoInstance)
    },
    [
      modelPath,
      value,
      language,
      theme,
      onChange,
      onCursorPositionChange,
      updateBlameDecorations,
      getOrCreateModel,
      onMount
    ]
  )

  // 在编辑器挂载前注册主题和InlineCompletionProvider
  const handleBeforeMount = useCallback(
    (monacoInstance: Monaco) => {
      registerMonacoThemes(monacoInstance)
      // 立即设置主题，确保编辑器渲染时就是正确的主题
      monacoInstance.editor.setTheme(theme)

      // 🔥 注册 InlineCompletionProvider（AI 补全）
      if (!inlineCompletionDisposableRef.current) {
        inlineCompletionDisposableRef.current = registerInlineCompletionProvider(monacoInstance, {
          enabled: true
        })
        console.log('[MonacoCodeEditor] InlineCompletionProvider registered')
      }
    },
    [theme, workspaceRoot]
  )

  return (
    <Editor
      height={height}
      width={width}
      // 不传 path 和 value，因为我们通过 model 管理
      language={language}
      theme={theme}
      beforeMount={handleBeforeMount}
      onMount={handleEditorDidMount}
      options={mergedOptions}
      loading={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading editor...</span>
        </div>
      }
    />
  )
}

// 导出类型
export type {
  DiffType,
  CodeRange,
  DiffAction,
  ToolbarPosition,
  ToolbarConfig,
  EditorDiagnostic,
  GitBlameLine
} from './monaco-editor.types'
