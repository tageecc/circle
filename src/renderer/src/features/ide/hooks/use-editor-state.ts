import { useState, useCallback, useRef } from 'react'
import { MarkdownMode } from '../types'
import { EditorDiagnostic } from '@/components/code/MonacoCodeEditor'

export function useEditorState() {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [allDiagnostics, setAllDiagnostics] = useState<EditorDiagnostic[]>([])
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>('edit')
  const diagnosticsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)

  const updateCursorPosition = useCallback((position: { line: number; column: number }) => {
    setCursorPosition(position)
  }, [])

  const updateDiagnostics = useCallback((filePath: string, diagnostics: EditorDiagnostic[]) => {
    if (diagnosticsUpdateTimerRef.current) {
      clearTimeout(diagnosticsUpdateTimerRef.current)
    }

    diagnosticsUpdateTimerRef.current = setTimeout(() => {
      setAllDiagnostics((prev) => {
        const filtered = prev.filter((d) => d.filePath !== filePath)
        return [...filtered, ...diagnostics]
      })
    }, 300)
  }, [])

  const handleDiagnosticClick = useCallback(
    (diagnostic: EditorDiagnostic, activeFile: string | null, openFile: (path: string) => void) => {
      if (diagnostic.filePath !== activeFile) {
        openFile(diagnostic.filePath)
      }

      setTimeout(() => {
        const editor = document.querySelector('.monaco-editor')
        if (editor) {
          const event = new CustomEvent('goto-line', {
            detail: { line: diagnostic.line, column: diagnostic.column }
          })
          editor.dispatchEvent(event)
        }
      }, 100)
    },
    []
  )

  return {
    cursorPosition,
    allDiagnostics,
    markdownMode,
    setMarkdownMode,
    updateCursorPosition,
    updateDiagnostics,
    handleDiagnosticClick
  }
}
