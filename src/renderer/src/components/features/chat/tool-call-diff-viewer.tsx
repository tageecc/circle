import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import { registerMonacoThemes } from '@/config/monaco-themes'

interface ToolCallDiffViewerProps {
  original: string
  modified: string
  language?: string
  maxHeight?: number
}

function getCurrentMonacoTheme(): 'one-dark-pro' | 'one-light' {
  return document.documentElement.classList.contains('dark') ? 'one-dark-pro' : 'one-light'
}

export function ToolCallDiffViewer({
  original,
  modified,
  language = 'plaintext',
  maxHeight = 360
}: ToolCallDiffViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const diffRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)
  const originalModelRef = useRef<monaco.editor.ITextModel | null>(null)
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null)
  const [theme, setTheme] = useState<'one-dark-pro' | 'one-light'>(getCurrentMonacoTheme)

  useEffect(() => {
    const syncTheme = () => {
      setTheme(getCurrentMonacoTheme())
    }

    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    registerMonacoThemes(monaco)
    monaco.editor.setTheme(theme)

    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      renderSideBySide: false,
      automaticLayout: true,
      readOnly: true,
      contextmenu: false,

      lineNumbers: 'off',
      glyphMargin: false,
      lineDecorationsWidth: 0,
      renderLineHighlight: 'none',

      folding: false,
      renderIndicators: false,
      hover: { enabled: false },
      lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.Off },

      minimap: { enabled: false },
      renderOverviewRuler: false,
      overviewRulerLanes: 0,

      scrollbar: {
        vertical: 'auto',
        useShadows: false
      },
      scrollBeyondLastLine: false
    })

    const originalModel = monaco.editor.createModel(original, language)
    const modifiedModel = monaco.editor.createModel(modified, language)

    originalModelRef.current = originalModel
    modifiedModelRef.current = modifiedModel
    editor.setModel({ original: originalModel, modified: modifiedModel })
    diffRef.current = editor

    /** 根据内容高度自动调节容器高度 */
    const modifiedEditor = editor.getModifiedEditor()

    const resizeHeight = () => {
      const model = modifiedEditor.getModel()
      if (!model || !containerRef.current) return

      const lineCount = model.getLineCount()
      const lineHeight = modifiedEditor.getOption(monaco.editor.EditorOption.lineHeight)
      const contentHeight = lineCount * lineHeight + 20

      containerRef.current.style.height =
        contentHeight > maxHeight ? `${maxHeight}px` : `${contentHeight}px`
    }

    /** layout 完成或内容变化时均调整高度 */
    const layoutListener = modifiedEditor.onDidLayoutChange(resizeHeight)
    const sizeListener = modifiedEditor.onDidContentSizeChange(resizeHeight)

    resizeHeight()

    return () => {
      layoutListener.dispose()
      sizeListener.dispose()
      // 必须先 dispose editor，再 dispose model
      editor.dispose()
      originalModel.dispose()
      modifiedModel.dispose()
      diffRef.current = null
      originalModelRef.current = null
      modifiedModelRef.current = null
    }
  }, [maxHeight])

  useEffect(() => {
    monaco.editor.setTheme(theme)
  }, [theme])

  useEffect(() => {
    const originalModel = originalModelRef.current
    const modifiedModel = modifiedModelRef.current

    if (!originalModel || !modifiedModel) return

    if (originalModel.getValue() !== original) {
      originalModel.setValue(original)
    }

    if (modifiedModel.getValue() !== modified) {
      modifiedModel.setValue(modified)
    }

    monaco.editor.setModelLanguage(originalModel, language)
    monaco.editor.setModelLanguage(modifiedModel, language)
  }, [original, modified, language])

  return (
    <>
      <style>{`
        .toolcall-diff-container .monaco-diff-editor .original,
        .toolcall-diff-container .monaco-diff-editor .editor.original {
          display: none !important;
        }
        .toolcall-diff-container .monaco-diff-editor .modified {
          margin-left: 0 !important;
        }

        .toolcall-diff-container .margin,
        .toolcall-diff-container .glyph-margin,
        .toolcall-diff-container .line-numbers {
          display: none !important;
        }

        .toolcall-diff-container .decorationsOverviewRuler,
        .toolcall-diff-container .diffViewport,
        .toolcall-diff-container .overviewRuler {
          display: none !important;
        }

        .toolcall-diff-container .char-insert,
        .toolcall-diff-container .char-delete {
          background-color: transparent !important;
        }
          
      `}</style>

      <div
        ref={containerRef}
        className="toolcall-diff-container"
        style={{
          width: '100%',
          overflow: 'auto',
          transition: 'height 0.15s'
        }}
      />
    </>
  )
}
