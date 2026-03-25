import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Editor } from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor, IDisposable } from 'monaco-editor'
import { Loader2 } from 'lucide-react'
import * as monaco from 'monaco-editor'
import { useSettings } from '../../contexts/SettingsContext'
import { useLanguageServiceProviders } from '../../hooks/useLanguageServiceProviders'
import { configureMonacoLanguages } from '../../config/monaco-languages'
import { registerMonacoThemes } from '../../config/monaco-themes'
import { createEditorOptions } from '../../config/monaco-editor-options'
import type { MonacoCodeEditorProps, GitBlameLine } from './monaco-editor.types'
import { MONACO_ACTIONS_MAP, parseMonacoKeybinding } from '../../lib/monaco-keybindings'
import { registerInlineCompletionProvider } from '../../services/inline-completion-provider'

/**
 * Monaco 代码编辑器组件
 * 支持语言服务、诊断、Git Blame 等 IDE 功能
 *
 * 使用 Model 管理机制避免文件切换时的内容混淆问题：
 * - 每个文件对应一个独立的 Monaco Model
 * - 切换文件时切换 Model，而不是 setValue
 * - 这样可以保留每个文件的编辑历史、undo/redo 状态
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
  editorSettings: propEditorSettings,
  theme: propTheme,
  onChange,
  onSave,
  onDiagnosticsChange,
  onCursorPositionChange,
  onMount
}: MonacoCodeEditorProps) {
  const { t } = useTranslation('editor')
  const { editorSettings: globalEditorSettings, keymapSettings } = useSettings()

  // 合并配置，优先使用传入的配置（用于预览等场景）
  const editorSettings = useMemo(() => {
    return { ...globalEditorSettings, ...propEditorSettings }
  }, [globalEditorSettings, propEditorSettings])

  const shouldEnableGitBlame = enableGitBlame && editorSettings.gitBlame

  const [internalTheme, setInternalTheme] = useState<'one-dark-pro' | 'one-light'>(() => {
    const savedTheme = localStorage.getItem('circle-theme')
    if (savedTheme) return savedTheme === 'dark' ? 'one-dark-pro' : 'one-light'
    return document.documentElement.classList.contains('dark') ? 'one-dark-pro' : 'one-light'
  })

  // 如果传入了 theme 则使用传入的，否则使用内部管理的 theme
  const theme = propTheme || internalTheme

  const [themesRegistered, setThemesRegistered] = useState(false)
  const [blameInfo, setBlameInfo] = useState<GitBlameLine[]>([])
  const [currentLine, setCurrentLine] = useState<number>(1)

  const codeEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const modelsMapRef = useRef<Map<string, editor.ITextModel>>(new Map())
  const modelLRURef = useRef<string[]>([]) // LRU队列
  const decorationsRef = useRef<string[]>([])
  const diagnosticsTimerRef = useRef<NodeJS.Timeout | null>(null)
  const onDiagnosticsChangeRef = useRef(onDiagnosticsChange)
  const currentPathRef = useRef<string | undefined>(path)
  const keybindingDisposablesRef = useRef<IDisposable[]>([])
  const inlineCompletionDisposableRef = useRef<{ dispose: () => void } | null>(null)

  const MAX_CACHED_MODELS = 50 // 最多缓存50个Model

  useEffect(() => {
    onDiagnosticsChangeRef.current = onDiagnosticsChange
  }, [onDiagnosticsChange])

  useEffect(() => {
    return () => {
      inlineCompletionDisposableRef.current?.dispose()
      inlineCompletionDisposableRef.current = null
    }
  }, [])

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
        console.log(`[Editor] Updating existing model content: ${filePath}`)
        model.setValue(content)
      }

      // 更新LRU：移到队尾（最近使用）
      const lruIndex = modelLRURef.current.indexOf(filePath)
      if (lruIndex > -1) {
        modelLRURef.current.splice(lruIndex, 1)
      }
      modelLRURef.current.push(filePath)

      // 同步到本地Map
      modelsMapRef.current.set(filePath, model)
      return model
    }

    // LRU清理：如果超过最大缓存数，移除最旧的Model
    if (modelsMapRef.current.size >= MAX_CACHED_MODELS) {
      const oldestPath = modelLRURef.current.shift()
      if (oldestPath) {
        const oldModel = modelsMapRef.current.get(oldestPath)
        if (oldModel && !oldModel.isDisposed()) {
          console.log(`[Editor] Disposing old model (LRU): ${oldestPath}`)
          oldModel.dispose()
        }
        modelsMapRef.current.delete(oldestPath)
      }
    }

    // Model不存在，创建新的
    console.log(
      `[Editor] Creating new model: ${filePath} (${modelsMapRef.current.size + 1}/${MAX_CACHED_MODELS})`
    )
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
    // 当workspaceRoot变化时（切换项目），清理所有Models
    return () => {
      console.log('[Editor] Cleaning up models for workspace change')
      modelsMapRef.current.forEach((model, filePath) => {
        if (!model.isDisposed()) {
          console.log(`[Editor] Disposing model: ${filePath}`)
          model.dispose()
        }
      })
      modelsMapRef.current.clear()
      modelLRURef.current = [] // 清空LRU队列
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
  const formatTimeAgo = useCallback(
    (timestamp: number): string => {
      const diff = Date.now() - timestamp * 1000
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      const months = Math.floor(days / 30)
      const years = Math.floor(days / 365)

      if (years > 0) return t('timeAgo.years', { count: years })
      if (months > 0) return t('timeAgo.months', { count: months })
      if (days > 6) return t('timeAgo.weeks', { count: Math.floor(days / 7) })
      if (days > 0) return t('timeAgo.days', { count: days })
      if (hours > 0) return t('timeAgo.hours', { count: hours })
      if (minutes > 0) return t('timeAgo.minutes', { count: minutes })
      return t('timeAgo.justNow')
    },
    [t]
  )

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
    const text = `${blame.author}, ${timeAgo} · ${summary}`
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
  }, [blameInfo, shouldEnableGitBlame, currentLine, formatTimeAgo])

  useEffect(() => {
    updateBlameDecorations()
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
    const timer = setTimeout(() => updateDiagnostics(path, value), 1000)
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
    if (!codeEditorRef.current || !monacoRef.current || !path) return

    const pathChanged = currentPathRef.current !== path

    if (pathChanged) {
      console.log(`[Editor] Switching file: ${currentPathRef.current} -> ${path}`)

      // 获取或创建新文件的Model
      const model = getOrCreateModel(path, value, language)

      if (model) {
        // 切换到新Model
        codeEditorRef.current.setModel(model)

        // 重置视图状态
        codeEditorRef.current.setPosition({ lineNumber: 1, column: 1 })
        codeEditorRef.current.setScrollTop(0)

        currentPathRef.current = path
        console.log(`[Editor] Switched to file: ${path}`)
      }
    } else {
      // 同一文件，但内容可能从外部更新（如文件被外部修改）
      const model = codeEditorRef.current.getModel()
      if (model && model.getValue() !== value) {
        console.log(`[Editor] External content change for: ${path}`)
        model.setValue(value)
      }
    }
  }, [value, path, language, getOrCreateModel])

  // 注册快捷键
  useEffect(() => {
    if (!codeEditorRef.current || !keymapSettings.bindings) return

    const editor = codeEditorRef.current
    const bindings = keymapSettings.bindings

    // 清理旧的快捷键绑定
    keybindingDisposablesRef.current.forEach((d) => {
      if (typeof d === 'string') return // editor.addCommand returns string in some versions/contexts, but usually IDisposable
      if (d && typeof d.dispose === 'function') {
        d.dispose()
      }
    })
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
          label: t('file.save'),
          keybindings: [keybinding],
          run: (ed) => {
            const currentModel = ed.getModel()
            if (!currentModel) return

            const currentValue = currentModel.getValue()
            const currentFilePath = currentModel.uri.fsPath

            console.log(`[Editor] Save triggered for: ${currentFilePath}`)
            onChange?.(currentValue, currentFilePath)
            onSave(currentValue, currentFilePath)
          }
        })
        if (disposable) keybindingDisposablesRef.current.push(disposable)
        return
      }

      // 2. 处理文件全部保存
      if (commandId === 'file.saveAll') {
        // 暂时复用保存逻辑，或者后续实现
        return
      }

      // 3. 处理 Monaco 内置 Action 映射
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
      keybindingDisposablesRef.current.forEach((d) => {
        if (d && typeof d.dispose === 'function') {
          d.dispose()
        }
      })
      keybindingDisposablesRef.current = []
    }
  }, [keymapSettings.bindings, onSave, onChange, t])

  // 编辑器挂载
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
      codeEditorRef.current = editor
      monacoRef.current = monacoInstance

      console.log(`[Editor] Mounted, initializing model for: ${path}`)

      // 为当前文件创建或获取 Model
      if (path) {
        const model = getOrCreateModel(path, value, language)
        if (model) {
          editor.setModel(model)
          currentPathRef.current = path
        }
      }

      // 注册主题
      if (!themesRegistered) {
        registerMonacoThemes(monacoInstance)
        setThemesRegistered(true)
      }

      monacoInstance.editor.setTheme(theme)

      // 内容变化监听 - 关键：从Model URI获取路径，避免闭包陷阱
      editor.onDidChangeModelContent(() => {
        const currentModel = editor.getModel()
        if (!currentModel) return

        const currentFilePath = currentModel.uri.fsPath
        const newValue = currentModel.getValue()

        console.log(`[Editor] Content changed for: ${currentFilePath}`)
        // ✅ 传递Model的真实路径，而不是依赖外部props
        onChange?.(newValue, currentFilePath)
      })

      // 光标位置监听
      editor.onDidChangeCursorPosition((e) => {
        setCurrentLine(e.position.lineNumber)
        onCursorPositionChange?.({ line: e.position.lineNumber, column: e.position.column })
      })

      editor.focus()

      setTimeout(() => {
        editor.layout()
        const position = editor.getPosition()
        if (position) setCurrentLine(position.lineNumber)
        updateBlameDecorations()
      }, 100)

      inlineCompletionDisposableRef.current?.dispose()
      void window.api.config
        .get()
        .then((cfg: { completionSettings?: { enabled?: boolean; enableValidation?: boolean } }) => {
          if (cfg.completionSettings?.enabled === false) return
          inlineCompletionDisposableRef.current = registerInlineCompletionProvider(monacoInstance, {
            enableValidation: cfg.completionSettings?.enableValidation === true
          })
        })

      const km = monacoInstance.KeyMod
      const kc = monacoInstance.KeyCode
      editor.addAction({
        id: 'circle.inlineSuggest.trigger',
        label: t('inlineSuggest.triggerAction'),
        keybindings: [km.Alt | kc.Backslash, km.CtrlCmd | km.Shift | kc.Space],
        run: (ed) => {
          ed.trigger('keyboard', 'editor.action.inlineSuggest.trigger', null)
        }
      })

      // 调用外部传入的 onMount
      onMount?.(editor, monacoInstance)
    },
    [
      path,
      value,
      language,
      theme,
      themesRegistered,
      onChange,
      onCursorPositionChange,
      updateBlameDecorations,
      getOrCreateModel,
      onMount,
      t
    ]
  )

  // 编辑器选项
  const editorOptions = useMemo(
    () => createEditorOptions(editorSettings, readOnly),
    [editorSettings, readOnly]
  )

  return (
    <Editor
      height={height}
      width={width}
      // 不传 path 和 value，因为我们通过 model 管理
      language={language}
      theme={theme}
      onMount={handleEditorDidMount}
      options={editorOptions}
      loading={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t('loading')}</span>
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
