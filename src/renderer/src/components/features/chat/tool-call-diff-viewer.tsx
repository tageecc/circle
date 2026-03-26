import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'

interface ToolCallDiffViewerProps {
  original: string
  modified: string
  language?: string
  maxHeight?: number
}

export function ToolCallDiffViewer({
  original,
  modified,
  language = 'plaintext',
  maxHeight = 360
}: ToolCallDiffViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const diffRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (diffRef.current) {
      diffRef.current.dispose()
      diffRef.current = null
    }

    const originalModel = monaco.editor.createModel(original, language)

    const modifiedModel = monaco.editor.createModel(modified, language)

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
    }
  }, [original, modified, language, maxHeight])

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
