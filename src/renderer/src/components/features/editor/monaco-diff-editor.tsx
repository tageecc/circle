import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { DiffEditor, loader } from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { ChevronUp, ChevronDown, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useSettings } from '@/contexts/settings-context'
import { configureMonacoLanguages } from '@/config/monaco-languages'
import { registerMonacoThemes } from '@/config/monaco-themes'
import { defaultDiffEditorOptions } from '@/config/monaco-editor-options'
import type { MonacoDiffEditorProps, DiffAction, ToolbarPosition } from './monaco-editor.types'
import { defaultToolbarConfig } from './monaco-editor.types'
import { useTranslation } from 'react-i18next'

loader.config({ monaco })

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
  options: propOptions,
  onChange,
  onAllDiffsResolved,
  onNextFile,
  onDiffChange,
  onCurrentDiffChange,
  onMount
}: MonacoDiffEditorProps) {
  const { t } = useTranslation()
  const { editorOptions: globalOptions } = useSettings()

  const mergedOptions = useMemo(
    () => ({
      ...defaultDiffEditorOptions,
      ...globalOptions,
      ...propOptions,
      readOnly,
      renderSideBySide
    }),
    [globalOptions, propOptions, readOnly, renderSideBySide]
  )

  const [currentValue, setCurrentValue] = useState(value)
  const [currentOriginalValue, setCurrentOriginalValue] = useState(originalValue)
  const [theme, setTheme] = useState<'one-dark-pro' | 'one-light'>(() =>
    document.documentElement.classList.contains('dark') ? 'one-dark-pro' : 'one-light'
  )
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition | null>(null)
  const [diffActions, setDiffActions] = useState<DiffAction[]>([])
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(0)

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const isToolbarHoveredRef = useRef(false)
  const diffActionsRef = useRef<DiffAction[]>([])
  const currentDiffIndexRef = useRef(0)
  const onAllDiffsResolvedRef = useRef(onAllDiffsResolved)

  // 初始化语言配置
  useEffect(() => {
    configureMonacoLanguages()
  }, [])

  // 主题同步
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'one-dark-pro' : 'one-light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // 同步外部 props
  useEffect(() => {
    setCurrentValue(value)
    setCurrentOriginalValue(originalValue)
  }, [value, originalValue])

  // 保持回调 ref 最新
  useEffect(() => {
    onAllDiffsResolvedRef.current = onAllDiffsResolved
  }, [onAllDiffsResolved])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (diffEditorRef.current) {
        try {
          diffEditorRef.current.setModel(null)
        } catch {
          // 忽略
        }
        diffEditorRef.current = null
      }
    }
  }, [])

  const toolbarConfig = useMemo(
    () => ({
      ...defaultToolbarConfig,
      ...toolbar,
      acceptLabel: toolbar.acceptLabel || 'Keep',
      rejectLabel: toolbar.rejectLabel || 'Undo',
      acceptAllLabel: toolbar.acceptAllLabel || 'Keep All',
      undoAllLabel: toolbar.undoAllLabel || 'Undo All'
    }),
    [toolbar]
  )

  useEffect(() => {
    currentDiffIndexRef.current = currentDiffIndex
    onCurrentDiffChange?.(currentDiffIndex)
  }, [currentDiffIndex, onCurrentDiffChange])

  // 计算工具栏位置
  const calculateToolbarPosition = useCallback(
    (modifiedEditor: editor.ICodeEditor, action: DiffAction): ToolbarPosition | null => {
      if (!action.modifiedRange) return null
      const startTop = modifiedEditor.getTopForLineNumber(action.modifiedRange.startLineNumber)
      const endTop = modifiedEditor.getTopForLineNumber(action.modifiedRange.endLineNumber)
      return {
        top: startTop,
        height: endTop - startTop + 19,
        scrollTop: modifiedEditor.getScrollTop()
      }
    },
    []
  )

  // 更新工具条位置
  const updateToolbarForCurrentDiff = useCallback(
    (index: number = 0) => {
      if (!diffEditorRef.current || diffActionsRef.current.length === 0) {
        setToolbarPosition(null)
        return
      }
      const validIndex = Math.min(index, diffActionsRef.current.length - 1)
      const action = diffActionsRef.current[validIndex]
      if (action) {
        setCurrentDiffIndex(validIndex)
        setToolbarPosition(
          calculateToolbarPosition(diffEditorRef.current.getModifiedEditor(), action)
        )
      }
    },
    [calculateToolbarPosition]
  )

  // 更新 diff 列表（用于悬浮工具条位置和导航）
  const updateDiffActions = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      const lineChanges = editor.getLineChanges()
      if (lineChanges) {
        const actions: DiffAction[] = lineChanges.map((change) => ({
          type: !change.originalEndLineNumber
            ? 'add'
            : !change.modifiedEndLineNumber
              ? 'delete'
              : 'modify',
          // 使用 > 0 检查，避免行号 0 被当作 falsy
          originalRange:
            change.originalStartLineNumber > 0
              ? {
                  startLineNumber: change.originalStartLineNumber,
                  endLineNumber: change.originalEndLineNumber || change.originalStartLineNumber
                }
              : undefined,
          modifiedRange:
            change.modifiedStartLineNumber > 0
              ? {
                  startLineNumber: change.modifiedStartLineNumber,
                  endLineNumber: change.modifiedEndLineNumber || change.modifiedStartLineNumber
                }
              : undefined
        }))
        diffActionsRef.current = actions
        setDiffActions(actions)
        onDiffChange?.(actions)

        if (actions.length > 0 && toolbarConfig.enabled) {
          setTimeout(() => updateToolbarForCurrentDiff(currentDiffIndexRef.current), 50)
        } else {
          setToolbarPosition(null)
        }
      }
    },
    [onDiffChange, toolbarConfig.enabled, updateToolbarForCurrentDiff]
  )

  const handleBeforeMount = useCallback(
    (monacoInstance: Monaco) => {
      registerMonacoThemes(monacoInstance)
      monacoInstance.editor.setTheme(theme)
    },
    [theme]
  )

  const handleDiffEditorDidMount = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      diffEditorRef.current = editor
      const modifiedEditor = editor.getModifiedEditor()
      editor.getOriginalEditor().updateOptions({ lineNumbers: 'off' })
      onMount?.(editor)

      modifiedEditor.onDidChangeModelContent(() => {
        const newValue = modifiedEditor.getValue()
        setCurrentValue(newValue)
        onChange?.(newValue)
      })

      editor.onDidUpdateDiff(() => updateDiffActions(editor))
      updateDiffActions(editor)

      if (!toolbarConfig.enabled) return

      // 鼠标移动切换工具栏
      modifiedEditor.onMouseMove((e) => {
        if (isToolbarHoveredRef.current || !e.target.position) return
        const lineNumber = e.target.position.lineNumber
        const actionIndex = diffActionsRef.current.findIndex(
          (a) =>
            a.modifiedRange &&
            lineNumber >= a.modifiedRange.startLineNumber - 3 &&
            lineNumber <= a.modifiedRange.endLineNumber + 3
        )
        if (actionIndex !== -1 && actionIndex !== currentDiffIndexRef.current) {
          setCurrentDiffIndex(actionIndex)
          setToolbarPosition(
            calculateToolbarPosition(modifiedEditor, diffActionsRef.current[actionIndex])
          )
        }
      })

      // 滚动时更新位置
      modifiedEditor.onDidScrollChange(() => {
        const action = diffActionsRef.current[currentDiffIndexRef.current]
        if (action) setToolbarPosition(calculateToolbarPosition(modifiedEditor, action))
      })
    },
    [updateDiffActions, calculateToolbarPosition, toolbarConfig.enabled, onChange, onMount]
  )

  const scrollToDiff = useCallback((index: number) => {
    if (!diffEditorRef.current || index < 0 || index >= diffActionsRef.current.length) return
    const action = diffActionsRef.current[index]
    if (action?.modifiedRange) {
      setCurrentDiffIndex(index)
      diffEditorRef.current
        .getModifiedEditor()
        .revealLineInCenter(action.modifiedRange.startLineNumber)
    }
  }, [])

  const handlePrevDiff = useCallback(() => {
    if (currentDiffIndex > 0) scrollToDiff(currentDiffIndex - 1)
  }, [currentDiffIndex, scrollToDiff])

  const handleNextDiff = useCallback(() => {
    if (currentDiffIndex < diffActionsRef.current.length - 1) scrollToDiff(currentDiffIndex + 1)
  }, [currentDiffIndex, scrollToDiff])

  /**
   * 处理单个 diff（接受或拒绝）
   * @param mode 'accept' 将 modified 内容应用到 original；'reject' 将 original 内容应用到 modified
   */
  const handleDiffAction = useCallback(
    (mode: 'accept' | 'reject') => {
      if (!diffEditorRef.current) return

      const originalEditor = diffEditorRef.current.getOriginalEditor()
      const modifiedEditor = diffEditorRef.current.getModifiedEditor()
      const originalModel = originalEditor.getModel()
      const modifiedModel = modifiedEditor.getModel()
      if (!originalModel || !modifiedModel) return

      // 直接从 Monaco 获取最新的 diff（避免缓存过期）
      const lineChanges = diffEditorRef.current.getLineChanges()
      if (!lineChanges || lineChanges.length === 0) {
        setToolbarPosition(null)
        onAllDiffsResolvedRef.current?.(modifiedModel.getValue())
        return
      }

      const safeIndex = Math.min(currentDiffIndex, lineChanges.length - 1)
      const change = lineChanges[safeIndex]
      if (!change) return

      const isAdd = !change.originalEndLineNumber || change.originalEndLineNumber === 0
      const isDelete = !change.modifiedEndLineNumber || change.modifiedEndLineNumber === 0

      try {
        if (mode === 'accept') {
          // Accept: 让 original 与 modified 一致
          if (isAdd) {
            // 在 original 插入 modified 的新增内容
            const lines: string[] = []
            for (let i = change.modifiedStartLineNumber; i <= change.modifiedEndLineNumber; i++) {
              lines.push(modifiedModel.getLineContent(i))
            }
            originalModel.pushEditOperations(
              [],
              [
                {
                  range: {
                    startLineNumber: change.modifiedStartLineNumber,
                    startColumn: 1,
                    endLineNumber: change.modifiedStartLineNumber,
                    endColumn: 1
                  },
                  text: lines.join('\n') + '\n'
                }
              ],
              () => null
            )
          } else if (isDelete) {
            // 在 original 删除对应行
            const endLine = change.originalEndLineNumber
            const totalLines = originalModel.getLineCount()
            originalModel.pushEditOperations(
              [],
              [
                {
                  range:
                    endLine >= totalLines
                      ? {
                          startLineNumber: change.originalStartLineNumber,
                          startColumn: 1,
                          endLineNumber: endLine,
                          endColumn: originalModel.getLineMaxColumn(endLine)
                        }
                      : {
                          startLineNumber: change.originalStartLineNumber,
                          startColumn: 1,
                          endLineNumber: endLine + 1,
                          endColumn: 1
                        },
                  text: ''
                }
              ],
              () => null
            )
          } else {
            // 修改：用 modified 内容替换 original
            const lines: string[] = []
            for (let i = change.modifiedStartLineNumber; i <= change.modifiedEndLineNumber; i++) {
              lines.push(modifiedModel.getLineContent(i))
            }
            originalModel.pushEditOperations(
              [],
              [
                {
                  range: {
                    startLineNumber: change.originalStartLineNumber,
                    startColumn: 1,
                    endLineNumber: change.originalEndLineNumber,
                    endColumn: originalModel.getLineMaxColumn(change.originalEndLineNumber)
                  },
                  text: lines.join('\n')
                }
              ],
              () => null
            )
          }
          setCurrentOriginalValue(originalModel.getValue())
        } else {
          // Reject: 让 modified 与 original 一致
          if (isAdd) {
            // 删除 modified 中新增的行
            const endLine = change.modifiedEndLineNumber
            const totalLines = modifiedModel.getLineCount()
            modifiedModel.pushEditOperations(
              [],
              [
                {
                  range:
                    endLine >= totalLines
                      ? {
                          startLineNumber: change.modifiedStartLineNumber,
                          startColumn: 1,
                          endLineNumber: endLine,
                          endColumn: modifiedModel.getLineMaxColumn(endLine)
                        }
                      : {
                          startLineNumber: change.modifiedStartLineNumber,
                          startColumn: 1,
                          endLineNumber: endLine + 1,
                          endColumn: 1
                        },
                  text: ''
                }
              ],
              () => null
            )
          } else if (isDelete) {
            // 在 modified 插入 original 的内容
            const lines: string[] = []
            for (let i = change.originalStartLineNumber; i <= change.originalEndLineNumber; i++) {
              lines.push(originalModel.getLineContent(i))
            }
            modifiedModel.pushEditOperations(
              [],
              [
                {
                  range: {
                    startLineNumber: change.modifiedStartLineNumber,
                    startColumn: 1,
                    endLineNumber: change.modifiedStartLineNumber,
                    endColumn: 1
                  },
                  text: lines.join('\n') + '\n'
                }
              ],
              () => null
            )
          } else {
            // 修改：用 original 内容替换 modified
            const lines: string[] = []
            for (let i = change.originalStartLineNumber; i <= change.originalEndLineNumber; i++) {
              lines.push(originalModel.getLineContent(i))
            }
            modifiedModel.pushEditOperations(
              [],
              [
                {
                  range: {
                    startLineNumber: change.modifiedStartLineNumber,
                    startColumn: 1,
                    endLineNumber: change.modifiedEndLineNumber,
                    endColumn: modifiedModel.getLineMaxColumn(change.modifiedEndLineNumber)
                  },
                  text: lines.join('\n')
                }
              ],
              () => null
            )
          }
        }

        // 检查是否所有 diff 都已解决（直接比较内容，不依赖异步 API）
        if (originalModel.getValue() === modifiedModel.getValue()) {
          setToolbarPosition(null)
          setDiffActions([])
          diffActionsRef.current = []
          onAllDiffsResolvedRef.current?.(modifiedModel.getValue())
          // 如果有下一个文件的回调，延迟调用
          if (onNextFile) {
            setTimeout(() => onNextFile(), 100)
          }
          return
        }

        // 导航到下一个 diff
        setTimeout(() => {
          const remaining = diffEditorRef.current?.getLineChanges()
          if (remaining && remaining.length > 0) {
            scrollToDiff(0)
          } else {
            setToolbarPosition(null)
            onAllDiffsResolvedRef.current?.(modifiedModel.getValue())
            // 如果有下一个文件的回调，延迟调用
            if (onNextFile) {
              setTimeout(() => onNextFile(), 100)
            }
          }
        }, 100)
      } catch (error) {
        console.error(`处理 diff 失败 (${mode}):`, error)
      }
    },
    [currentDiffIndex, scrollToDiff, onNextFile]
  )

  const handleAccept = useCallback(() => handleDiffAction('accept'), [handleDiffAction])
  const handleReject = useCallback(() => handleDiffAction('reject'), [handleDiffAction])

  /**
   * Accept All: 接受所有更改，让 original 完全等于 modified
   */
  const handleAcceptAll = useCallback(() => {
    if (!diffEditorRef.current) return
    const modifiedEditor = diffEditorRef.current.getModifiedEditor()
    const originalEditor = diffEditorRef.current.getOriginalEditor()
    const modifiedModel = modifiedEditor.getModel()
    const originalModel = originalEditor.getModel()
    if (!modifiedModel || !originalModel) return

    const finalContent = modifiedModel.getValue()
    originalModel.setValue(finalContent)
    setCurrentOriginalValue(finalContent)
    setToolbarPosition(null)
    setDiffActions([])
    diffActionsRef.current = []
    onAllDiffsResolvedRef.current?.(finalContent)
    // 如果有下一个文件的回调，延迟调用
    if (onNextFile) {
      setTimeout(() => onNextFile(), 100)
    }
  }, [onNextFile])

  /**
   * Undo All: 撤销所有更改，让 modified 完全等于 original
   */
  const handleUndoAll = useCallback(() => {
    if (!diffEditorRef.current) return
    const originalEditor = diffEditorRef.current.getOriginalEditor()
    const modifiedEditor = diffEditorRef.current.getModifiedEditor()
    const originalModel = originalEditor.getModel()
    const modifiedModel = modifiedEditor.getModel()
    if (!originalModel || !modifiedModel) return

    const originalContent = originalModel.getValue()
    modifiedModel.setValue(originalContent)
    setCurrentValue(originalContent)
    onChange?.(originalContent)
    setToolbarPosition(null)
    setDiffActions([])
    diffActionsRef.current = []
    // Undo All 后不需要跳转到下一个文件，只是清理状态
  }, [onChange])

  return (
    <div className="w-full h-full relative">
      <DiffEditor
        height={height}
        width={width}
        language={language}
        theme={theme}
        original={currentOriginalValue}
        modified={currentValue}
        beforeMount={handleBeforeMount}
        onMount={handleDiffEditorDidMount}
        options={mergedOptions}
      />

      {/* Diff 操作工具条 - 右侧悬浮 */}
      {toolbarConfig.enabled && diffActions.length > 0 && toolbarPosition && (
        <div
          className={cn(
            'absolute right-3 flex items-center gap-1.5 px-2.5 py-1.5',
            'bg-card/98 backdrop-blur-xl rounded-lg z-50 animate-toolbar-fade-in',
            toolbarConfig.className
          )}
          style={{
            top: `${toolbarPosition.top - toolbarPosition.scrollTop}px`
          }}
          onMouseEnter={() => {
            isToolbarHoveredRef.current = true
          }}
          onMouseLeave={() => {
            isToolbarHoveredRef.current = false
          }}
        >
          {/* 导航按钮：只在有多个 diff 时显示 */}
          {toolbarConfig.showNavigation && diffActions.length > 1 && (
            <>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-muted/40 rounded">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-5 w-5 hover:bg-muted/60"
                  onClick={handlePrevDiff}
                  disabled={currentDiffIndex === 0}
                  title={t('editor.prev_change')}
                >
                  <ChevronUp className="size-3" />
                </Button>
                <span className="text-[11px] text-muted-foreground font-mono px-1.5 min-w-[45px] text-center whitespace-nowrap">
                  {currentDiffIndex + 1}/{diffActions.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-5 w-5 hover:bg-muted/60"
                  onClick={handleNextDiff}
                  disabled={currentDiffIndex === diffActions.length - 1}
                  title={t('editor.next_change')}
                >
                  <ChevronDown className="size-3" />
                </Button>
              </div>

              {(toolbarConfig.showReject || toolbarConfig.showAccept) && (
                <Separator orientation="vertical" className="h-5" />
              )}
            </>
          )}

          {toolbarConfig.showReject && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] gap-1 px-2.5 border-destructive/40 text-destructive/90 hover:bg-destructive/10 hover:border-destructive/60"
              onClick={handleReject}
              title={t('editor.undo_current_change')}
            >
              <X className="size-3" />
              <span>{toolbarConfig.rejectLabel}</span>
            </Button>
          )}

          {toolbarConfig.showAccept && (
            <Button
              variant="default"
              size="sm"
              className="h-6 text-[11px] gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm"
              onClick={handleAccept}
              title={t('editor.accept_current_change')}
            >
              <Check className="size-3" />
              <span>{toolbarConfig.acceptLabel}</span>
            </Button>
          )}

          {(toolbarConfig.showUndoAll || toolbarConfig.showAcceptAll) && (
            <Separator orientation="vertical" className="h-6" />
          )}

          {toolbarConfig.showUndoAll && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleUndoAll}
              title={t('editor.undo_all_changes')}
            >
              <span>{toolbarConfig.undoAllLabel}</span>
            </Button>
          )}

          {toolbarConfig.showAcceptAll && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={handleAcceptAll}
              title={t('editor.accept_all_changes')}
            >
              <span>{toolbarConfig.acceptAllLabel}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
