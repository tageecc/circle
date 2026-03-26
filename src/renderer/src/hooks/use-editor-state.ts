import { useState, useCallback, useRef } from 'react'
import { MarkdownMode } from '@/types/ide'
import { EditorDiagnostic } from '@/components/features/editor/monaco-code-editor'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { eventBus } from '@/lib/event-bus'

/**
 * 编辑器状态 Hook
 * 管理编辑器的 UI 状态（光标位置、Markdown 模式）
 *
 * 注意：diagnostics 已迁移到 useWorkspaceStore，避免状态重复
 */
export function useEditorState() {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>('edit')
  const diagnosticsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ✅ 使用 Zustand store 管理 diagnostics，避免状态重复
  const addDiagnostics = useWorkspaceStore((state) => state.addDiagnostics)

  const updateCursorPosition = useCallback((position: { line: number; column: number }) => {
    setCursorPosition(position)
  }, [])

  // ✅ 使用 Zustand 的 addDiagnostics，防抖 300ms
  const updateDiagnostics = useCallback(
    (filePath: string, diagnostics: EditorDiagnostic[]) => {
      if (diagnosticsUpdateTimerRef.current) {
        clearTimeout(diagnosticsUpdateTimerRef.current)
      }

      diagnosticsUpdateTimerRef.current = setTimeout(() => {
        addDiagnostics(filePath, diagnostics)
      }, 300)
    },
    [addDiagnostics]
  )

  const handleDiagnosticClick = useCallback(
    (diagnostic: EditorDiagnostic, activeFile: string | null, openFile: (path: string) => void) => {
      if (diagnostic.filePath !== activeFile) {
        openFile(diagnostic.filePath)
      }

      setTimeout(() => {
        eventBus.emit('editor-goto-line', {
          filePath: diagnostic.filePath,
          line: diagnostic.line,
          column: diagnostic.column
        })
      }, 100)
    },
    []
  )

  return {
    cursorPosition,
    markdownMode,
    setMarkdownMode,
    updateCursorPosition,
    updateDiagnostics,
    handleDiagnosticClick
  }
}
