import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DiffEditor } from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { ChevronUp, ChevronDown, X, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { cn } from '@/lib/utils'
import { useSettings } from '../../contexts/SettingsContext'
import { configureMonacoLanguages } from '../../config/monaco-languages'
import { registerMonacoThemes } from '../../config/monaco-themes'
import { createDiffEditorOptions } from '../../config/monaco-editor-options'
import type { MonacoDiffEditorProps, DiffAction, ToolbarPosition } from './monaco-editor.types'
import { defaultToolbarConfig } from './monaco-editor.types'

/**
 * Monaco Diff 编辑器组件
 * 支持代码差异对比、接受/拒绝更改、导航等功能
 */
export function MonacoDiffEditor({
  value,
  originalValue,
  language = 'javascript',
  height = '100%',
  width = '100%',
  readOnly = false,
  renderSideBySide = false,
  toolbar = {},
  wholeFileAcceptReject = false,
  onChange,
  onAccept,
  onReject,
  onDiffChange,
  onCurrentDiffChange,
  onMount
}: MonacoDiffEditorProps) {
  const { t } = useTranslation('editor')
  const { editorSettings } = useSettings()

  const [currentValue, setCurrentValue] = useState(value)
  const [currentOriginalValue, setCurrentOriginalValue] = useState(originalValue)
  const [theme, setTheme] = useState<'one-dark-pro' | 'one-light'>(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'one-dark-pro' : 'one-light'
  })
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition | null>(null)
  const [diffActions, setDiffActions] = useState<DiffAction[]>([])
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(0)

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const isToolbarHoveredRef = useRef<boolean>(false)
  const isProgrammaticChangeRef = useRef<boolean>(false)
  const diffActionsRef = useRef<DiffAction[]>([])
  const themesRegisteredRef = useRef<boolean>(false)

  // 初始化 Monaco 语言配置
  useEffect(() => {
    configureMonacoLanguages()
  }, [])

  // 主题管理
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'one-dark-pro' : 'one-light')
    }

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // 同步外部 props
  useEffect(() => {
    setCurrentValue(value)
    setCurrentOriginalValue(originalValue)
  }, [value, originalValue])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  // 工具栏配置
  const toolbarConfig = useMemo(() => {
    const merged = { ...defaultToolbarConfig, ...toolbar }
    return {
      ...merged,
      acceptLabel: toolbar.acceptLabel ?? t('diff.accept'),
      rejectLabel: toolbar.rejectLabel ?? t('diff.reject')
    }
  }, [toolbar, t])

  // Diff 编辑器选项
  const diffEditorOptions = useMemo(
    () => createDiffEditorOptions(editorSettings, readOnly, renderSideBySide),
    [editorSettings, readOnly, renderSideBySide]
  )

  // 通知外部 diff 索引变化
  useEffect(() => {
    onCurrentDiffChange?.(currentDiffIndex)
  }, [currentDiffIndex, onCurrentDiffChange])

  // 计算工具栏位置
  const calculateToolbarPosition = useCallback(
    (modifiedEditor: editor.ICodeEditor, action: DiffAction): ToolbarPosition | null => {
      if (!action.modifiedRange) return null
      const startLine = action.modifiedRange.startLineNumber
      const endLine = action.modifiedRange.endLineNumber
      const startTop = modifiedEditor.getTopForLineNumber(startLine)
      const endTop = modifiedEditor.getTopForLineNumber(endLine)
      const lineHeight = endTop - startTop + 19
      const scrollTop = modifiedEditor.getScrollTop()
      return { top: startTop, height: lineHeight, scrollTop }
    },
    []
  )

  // 更新 diff 列表
  const updateDiffActions = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      const lineChanges = editor.getLineChanges()
      if (lineChanges) {
        const actions: DiffAction[] = lineChanges.map((change: editor.ILineChange) => ({
          type: !change.originalEndLineNumber
            ? 'add'
            : !change.modifiedEndLineNumber
              ? 'delete'
              : 'modify',
          originalRange: change.originalStartLineNumber
            ? {
                startLineNumber: change.originalStartLineNumber,
                endLineNumber: change.originalEndLineNumber || change.originalStartLineNumber
              }
            : undefined,
          modifiedRange: change.modifiedStartLineNumber
            ? {
                startLineNumber: change.modifiedStartLineNumber,
                endLineNumber: change.modifiedEndLineNumber || change.modifiedStartLineNumber
              }
            : undefined
        }))
        diffActionsRef.current = actions // 同步更新 ref，避免闭包问题
        setDiffActions(actions)
        onDiffChange?.(actions)
      }
    },
    [onDiffChange]
  )

  // Diff 编辑器挂载
  const handleDiffEditorDidMount = useCallback(
    (editor: editor.IStandaloneDiffEditor, monacoInstance: Monaco) => {
      diffEditorRef.current = editor
      const modifiedEditor = editor.getModifiedEditor()

      // 注册主题
      if (!themesRegisteredRef.current) {
        registerMonacoThemes(monacoInstance)
        themesRegisteredRef.current = true
      }

      monacoInstance.editor.setTheme(theme)
      onMount?.(editor)

      // 监听内容变化
      modifiedEditor.onDidChangeModelContent(() => {
        const newValue = modifiedEditor.getValue()
        setCurrentValue(newValue)

        if (!isProgrammaticChangeRef.current) {
          onChange?.(newValue)
        }
      })

      // 监听 diff 更新
      editor.onDidUpdateDiff(() => updateDiffActions(editor))
      updateDiffActions(editor)

      if (!toolbarConfig.enabled) return

      // 鼠标移动：显示工具栏
      modifiedEditor.onMouseMove((e: editor.IEditorMouseEvent) => {
        if (hideTimerRef.current) {
          window.clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }

        if (isToolbarHoveredRef.current) return

        if (e.target.position) {
          const lineNumber = e.target.position.lineNumber
          const BUFFER_LINES = 3

          // 使用 ref 而不是闭包中的 state，确保获取最新值
          const actionIndex = diffActionsRef.current.findIndex(
            (a) =>
              a.modifiedRange &&
              lineNumber >= a.modifiedRange.startLineNumber - BUFFER_LINES &&
              lineNumber <= a.modifiedRange.endLineNumber + BUFFER_LINES
          )

          if (actionIndex !== -1) {
            const action = diffActionsRef.current[actionIndex]
            if (action) {
              setCurrentDiffIndex(actionIndex)
              const position = calculateToolbarPosition(modifiedEditor, action)
              setToolbarPosition(position)
            }
          } else {
            setToolbarPosition(null)
          }
        }
      })

      // 鼠标离开：延迟隐藏工具栏
      modifiedEditor.onMouseLeave(() => {
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = window.setTimeout(() => {
          if (!isToolbarHoveredRef.current) setToolbarPosition(null)
        }, 100)
      })

      // 滚动：隐藏工具栏
      modifiedEditor.onDidScrollChange(() => {
        if (hideTimerRef.current) {
          window.clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
        setToolbarPosition(null)
        isToolbarHoveredRef.current = false
      })
    },
    [theme, updateDiffActions, calculateToolbarPosition, toolbarConfig.enabled, onChange, onMount]
  )

  // 导航到指定 diff
  const scrollToDiff = useCallback(
    (index: number) => {
      if (!diffEditorRef.current || index < 0 || index >= diffActionsRef.current.length) return

      const action = diffActionsRef.current[index]
      const modifiedEditor = diffEditorRef.current.getModifiedEditor()

      if (action?.modifiedRange) {
        const startLine = action.modifiedRange.startLineNumber
        setCurrentDiffIndex(index)
        modifiedEditor.revealLineInCenter(startLine)

        setTimeout(() => {
          const position = calculateToolbarPosition(modifiedEditor, action)
          setToolbarPosition(position)
        }, 100)
      }
    },
    [calculateToolbarPosition]
  )

  const handlePrevDiff = useCallback(() => {
    const prevIndex = currentDiffIndex - 1
    if (prevIndex >= 0) scrollToDiff(prevIndex)
  }, [currentDiffIndex, scrollToDiff])

  const handleNextDiff = useCallback(() => {
    const nextIndex = currentDiffIndex + 1
    if (nextIndex < diffActionsRef.current.length) scrollToDiff(nextIndex)
  }, [currentDiffIndex, scrollToDiff])

  // 接受当前 diff：更新 original model 使其与 modified 一致（或整文件模式仅回调）
  const handleAccept = useCallback(() => {
    if (wholeFileAcceptReject) {
      onAccept?.()
      return
    }
    if (!diffEditorRef.current || !toolbarPosition) return

    const originalEditor = diffEditorRef.current.getOriginalEditor()
    const modifiedEditor = diffEditorRef.current.getModifiedEditor()
    const action = diffActionsRef.current[currentDiffIndex]
    const originalModel = originalEditor.getModel()
    const modifiedModel = modifiedEditor.getModel()

    if (!originalModel || !modifiedModel || !action) return

    try {
      if (action.type === 'add' && action.modifiedRange) {
        // 新增：在 original 中插入新内容
        const linesToAdd: string[] = []
        for (
          let i = action.modifiedRange.startLineNumber;
          i <= action.modifiedRange.endLineNumber;
          i++
        ) {
          linesToAdd.push(modifiedModel.getLineContent(i))
        }
        const textToAdd = linesToAdd.join('\n') + '\n'

        const insertLine = action.modifiedRange.startLineNumber
        originalModel.pushEditOperations(
          [],
          [
            {
              range: {
                startLineNumber: insertLine,
                startColumn: 1,
                endLineNumber: insertLine,
                endColumn: 1
              },
              text: textToAdd
            }
          ],
          () => null
        )
      } else if (action.type === 'delete' && action.originalRange) {
        // 删除：在 original 中删除对应行
        const startLine = action.originalRange.startLineNumber
        const endLine = action.originalRange.endLineNumber
        const totalLines = originalModel.getLineCount()

        const deleteRange =
          endLine >= totalLines
            ? {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine,
                endColumn: originalModel.getLineMaxColumn(endLine)
              }
            : {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine + 1,
                endColumn: 1
              }

        originalModel.pushEditOperations([], [{ range: deleteRange, text: '' }], () => null)
      } else if (action.type === 'modify' && action.modifiedRange && action.originalRange) {
        // 修改：用 modified 的内容替换 original
        const modifiedLines: string[] = []
        for (
          let i = action.modifiedRange.startLineNumber;
          i <= action.modifiedRange.endLineNumber;
          i++
        ) {
          modifiedLines.push(modifiedModel.getLineContent(i))
        }
        const modifiedText = modifiedLines.join('\n')

        originalModel.pushEditOperations(
          [],
          [
            {
              range: {
                startLineNumber: action.originalRange.startLineNumber,
                startColumn: 1,
                endLineNumber: action.originalRange.endLineNumber,
                endColumn: originalModel.getLineMaxColumn(action.originalRange.endLineNumber)
              },
              text: modifiedText
            }
          ],
          () => null
        )
      }

      // 更新状态
      setCurrentOriginalValue(originalModel.getValue())
      onAccept?.(currentDiffIndex, action)
      setToolbarPosition(null)

      // 自动导航到下一个 diff
      setTimeout(() => {
        const remainingDiffs = diffEditorRef.current?.getLineChanges()
        if (remainingDiffs && remainingDiffs.length > 0) {
          scrollToDiff(0)
        }
      }, 150)
    } catch (error) {
      console.error(t('diff.acceptFailed'), error)
    }
  }, [wholeFileAcceptReject, toolbarPosition, currentDiffIndex, onAccept, scrollToDiff, t])

  // 拒绝当前 diff：更新 modified model 使其与 original 一致（或整文件模式仅回调）
  const handleReject = useCallback(() => {
    if (wholeFileAcceptReject) {
      onReject?.()
      return
    }
    if (!diffEditorRef.current || !toolbarPosition) return

    const modifiedEditor = diffEditorRef.current.getModifiedEditor()
    const originalEditor = diffEditorRef.current.getOriginalEditor()
    const action = diffActionsRef.current[currentDiffIndex]
    const originalModel = originalEditor.getModel()
    const modifiedModel = modifiedEditor.getModel()

    if (!originalModel || !modifiedModel || !action) return

    try {
      isProgrammaticChangeRef.current = true

      if (action.type === 'add' && action.modifiedRange) {
        // 新增：删除新增的行
        const startLine = action.modifiedRange.startLineNumber
        const endLine = action.modifiedRange.endLineNumber
        const totalLines = modifiedModel.getLineCount()

        const deleteRange =
          endLine >= totalLines
            ? {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine,
                endColumn: modifiedModel.getLineMaxColumn(endLine)
              }
            : {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine + 1,
                endColumn: 1
              }

        modifiedModel.pushEditOperations([], [{ range: deleteRange, text: '' }], () => null)
      } else if (action.type === 'delete' && action.originalRange && action.modifiedRange) {
        // 删除：恢复被删除的行
        const originalLines: string[] = []
        for (
          let i = action.originalRange.startLineNumber;
          i <= action.originalRange.endLineNumber;
          i++
        ) {
          originalLines.push(originalModel.getLineContent(i))
        }
        const originalText = originalLines.join('\n') + '\n'

        const insertLine = action.modifiedRange.startLineNumber

        modifiedModel.pushEditOperations(
          [],
          [
            {
              range: {
                startLineNumber: insertLine,
                startColumn: 1,
                endLineNumber: insertLine,
                endColumn: 1
              },
              text: originalText
            }
          ],
          () => null
        )
      } else if (action.type === 'modify' && action.modifiedRange && action.originalRange) {
        // 修改：恢复为原始内容
        const originalLines: string[] = []
        for (
          let i = action.originalRange.startLineNumber;
          i <= action.originalRange.endLineNumber;
          i++
        ) {
          originalLines.push(originalModel.getLineContent(i))
        }
        const originalText = originalLines.join('\n')

        modifiedModel.pushEditOperations(
          [],
          [
            {
              range: {
                startLineNumber: action.modifiedRange.startLineNumber,
                startColumn: 1,
                endLineNumber: action.modifiedRange.endLineNumber,
                endColumn: modifiedModel.getLineMaxColumn(action.modifiedRange.endLineNumber)
              },
              text: originalText
            }
          ],
          () => null
        )
      }

      isProgrammaticChangeRef.current = false
      onReject?.(currentDiffIndex, action)
      setToolbarPosition(null)

      // 自动导航到下一个 diff
      setTimeout(() => {
        const remainingDiffs = diffEditorRef.current?.getLineChanges()
        if (remainingDiffs && remainingDiffs.length > 0) {
          scrollToDiff(0)
        }
      }, 150)
    } catch (error) {
      console.error(t('diff.rejectFailed'), error)
      isProgrammaticChangeRef.current = false
    }
  }, [wholeFileAcceptReject, toolbarPosition, currentDiffIndex, onReject, scrollToDiff, t])

  return (
    <div className="w-full h-full relative">
      <DiffEditor
        height={height}
        width={width}
        language={language}
        theme={theme}
        original={currentOriginalValue}
        modified={currentValue}
        onMount={handleDiffEditorDidMount}
        options={diffEditorOptions}
      />

      {/* Diff 悬浮工具条 */}
      {toolbarConfig.enabled && toolbarPosition !== null && (
        <div
          className={cn(
            'absolute right-4 flex items-center gap-2 px-2 py-1.5',
            'bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl',
            'z-50 animate-toolbar-fade-in',
            toolbarConfig.className
          )}
          style={{
            top:
              toolbarConfig.position === 'top'
                ? `${toolbarPosition.top - toolbarPosition.scrollTop - 40}px`
                : `${toolbarPosition.top - toolbarPosition.scrollTop + toolbarPosition.height + 8}px`
          }}
          onMouseEnter={() => {
            if (hideTimerRef.current) {
              window.clearTimeout(hideTimerRef.current)
              hideTimerRef.current = null
            }
            isToolbarHoveredRef.current = true
          }}
          onMouseLeave={() => {
            isToolbarHoveredRef.current = false
            setToolbarPosition(null)
          }}
        >
          {/* 导航按钮组 */}
          {toolbarConfig.showNavigation && diffActions.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded-md border border-border/50">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                onClick={handlePrevDiff}
                disabled={currentDiffIndex === 0}
                title={t('diff.prevChange')}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground font-mono px-1 min-w-[50px] text-center">
                {currentDiffIndex + 1} / {diffActions.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                onClick={handleNextDiff}
                disabled={currentDiffIndex === diffActions.length - 1}
                title={t('diff.nextChange')}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </div>
          )}

          {/* 分隔线 */}
          {toolbarConfig.showNavigation &&
            (toolbarConfig.showReject || toolbarConfig.showAccept) && (
              <Separator orientation="vertical" className="h-6" />
            )}

          {/* 拒绝按钮 */}
          {toolbarConfig.showReject && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleReject}
              title={t('diff.rejectCurrent')}
            >
              <X className="size-3.5" />
              <span>{toolbarConfig.rejectLabel}</span>
            </Button>
          )}

          {/* 接受按钮 */}
          {toolbarConfig.showAccept && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 hover:border-green-500/50 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              onClick={handleAccept}
              title={t('diff.acceptCurrent')}
            >
              <Check className="size-3.5" />
              <span>{toolbarConfig.acceptLabel}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
