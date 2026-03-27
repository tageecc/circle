import { useState, useCallback, useMemo, DragEvent, useRef, useEffect, memo } from 'react'
import { FileTab, MarkdownMode, PendingFileEdit } from '@/types/ide'
import { TabBar } from './tab-bar'
import { EditorContent } from './editor-content'
import { EditorDiagnostic } from './monaco-code-editor'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffAction } from './monaco-editor.types'
import type { editor } from 'monaco-editor'
import { usePendingEditsStore } from '@/stores/pending-edits.store'
import { useTranslation } from 'react-i18next'

interface EditorAreaProps {
  openFiles: FileTab[]
  activeFile: string | null
  currentFile: FileTab | undefined
  workspaceRoot: string
  autoSave: boolean
  isMarkdown: boolean
  isImage: boolean
  markdownMode?: MarkdownMode
  pendingFileEdits?: PendingFileEdit[] // Cursor 风格：用于 TabBar 显示标记 + diff 视图
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseToRight: (path: string) => void
  onCloseAll: () => void
  onMarkdownModeChange?: (mode: MarkdownMode) => void
  onContentChange: (path: string, content: string) => void
  onSave: (path: string, content: string) => void
  onDiagnosticsChange: (filePath: string, diagnostics: EditorDiagnostic[]) => void
  onCursorPositionChange: (position: { line: number; column: number }) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  onGitRefresh?: () => void
  onResolveConflict?: (path: string, resolvedContent: string) => void
  onCancelConflict?: () => void
  /** Cursor 风格：接受 pending diff（保留 AI 修改） */
  onAcceptPendingDiff?: (absolutePath: string) => void
  /** Cursor 风格：拒绝 pending diff（恢复原始内容） */
  onRejectPendingDiff?: (absolutePath: string, options?: { silent?: boolean }) => void
  /** 打开指定文件 */
  onOpenFile?: (absolutePath: string) => void
}

export const EditorArea = memo(function EditorArea({
  openFiles,
  activeFile,
  currentFile,
  workspaceRoot,
  autoSave,
  isMarkdown,
  isImage,
  markdownMode,
  pendingFileEdits,
  onTabClick,
  onTabClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onMarkdownModeChange,
  onContentChange,
  onSave,
  onDiagnosticsChange,
  onCursorPositionChange,
  onReorder,
  onGitRefresh,
  onResolveConflict,
  onCancelConflict,
  onAcceptPendingDiff,
  onRejectPendingDiff,
  onOpenFile
}: EditorAreaProps) {
  const { t } = useTranslation()
  // 跟踪是否有 tab 拖拽进入编辑器区域
  const [isTabDragging, setIsTabDragging] = useState(false)

  // Diff 编辑器状态
  const [diffActions, setDiffActions] = useState<DiffAction[]>([])
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0)
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  // Cursor 风格：查找当前文件对应的 pending edit（用于显示 diff 视图）
  const currentPendingEdit = useMemo(() => {
    if (!currentFile || !pendingFileEdits?.length) return undefined
    return pendingFileEdits.find((e) => e.absolutePath === currentFile.path)
  }, [currentFile, pendingFileEdits])

  // 当前文件切换时，重置 diff 状态
  useEffect(() => {
    setDiffActions([])
    setCurrentDiffIndex(0)
    diffEditorRef.current = null
  }, [currentFile?.path])

  // 当 pending edits 列表变空时，清理状态
  useEffect(() => {
    if (!pendingFileEdits || pendingFileEdits.length === 0) {
      setDiffActions([])
      setCurrentDiffIndex(0)
      diffEditorRef.current = null
    }
  }, [pendingFileEdits])

  // 当前文件在 pending edits 中的索引
  const currentPendingIndex = useMemo(() => {
    if (!currentFile || !pendingFileEdits?.length) return -1
    return pendingFileEdits.findIndex((e) => e.absolutePath === currentFile.path)
  }, [currentFile, pendingFileEdits])

  // 是否显示全局导航工具条
  const showGlobalToolbar = pendingFileEdits && pendingFileEdits.length > 0

  // 辅助函数：尝试打开文件，如果不存在则清理并跳过
  const tryOpenFile = useCallback(
    async (absolutePath: string) => {
      try {
        const exists = await window.api.files.exists(absolutePath)
        if (!exists) {
          console.warn(`文件不存在，自动清理: ${absolutePath}`)
          await onRejectPendingDiff?.(absolutePath, { silent: true })
          return false
        }
        onOpenFile?.(absolutePath)
        return true
      } catch (error) {
        console.error('Failed to check file existence:', error)
        // 检查失败时，不要尝试打开，避免 ENOENT 错误
        return false
      }
    },
    [onOpenFile, onRejectPendingDiff]
  )

  // 导航到上一个 pending edit（带文件存在性检查）
  const handlePrevFile = useCallback(async () => {
    // 直接从 store 获取最新状态，避免闭包陷阱
    if (!workspaceRoot) return

    const store = usePendingEditsStore.getState()
    const latestEdits = store.getEdits(workspaceRoot)
    if (latestEdits.length === 0) return

    let attempts = 0
    let currentIdx = currentPendingIndex
    const maxAttempts = latestEdits.length

    while (attempts < maxAttempts) {
      // 每次循环重新获取最新的列表（可能已被清理）
      const freshEdits = store.getEdits(workspaceRoot)
      if (freshEdits.length === 0) break

      const prevIdx = currentIdx <= 0 ? freshEdits.length - 1 : currentIdx - 1
      const targetFile = freshEdits[prevIdx]
      if (!targetFile) break

      const success = await tryOpenFile(targetFile.absolutePath)
      if (success) {
        break
      }

      // 文件不存在，继续尝试下一个
      currentIdx = prevIdx
      attempts++
    }
  }, [currentPendingIndex, workspaceRoot, tryOpenFile])

  // 导航到下一个 pending edit（带文件存在性检查）
  const handleNextFile = useCallback(async () => {
    // 直接从 store 获取最新状态，避免闭包陷阱
    if (!workspaceRoot) return

    const store = usePendingEditsStore.getState()
    const latestEdits = store.getEdits(workspaceRoot)
    if (latestEdits.length === 0) return

    let attempts = 0
    let currentIdx = currentPendingIndex
    const maxAttempts = latestEdits.length

    while (attempts < maxAttempts) {
      // 每次循环重新获取最新的列表（可能已被清理）
      const freshEdits = store.getEdits(workspaceRoot)
      if (freshEdits.length === 0) break

      const nextIdx = currentIdx >= freshEdits.length - 1 ? 0 : currentIdx + 1
      const targetFile = freshEdits[nextIdx]
      if (!targetFile) break

      const success = await tryOpenFile(targetFile.absolutePath)
      if (success) {
        break
      }

      // 文件不存在，继续尝试下一个
      currentIdx = nextIdx
      attempts++
    }
  }, [currentPendingIndex, workspaceRoot, tryOpenFile])

  // Diff 导航
  const handlePrevDiff = useCallback(() => {
    if (currentDiffIndex > 0 && diffEditorRef.current) {
      const newIndex = currentDiffIndex - 1
      const action = diffActions[newIndex]
      if (action?.modifiedRange) {
        setCurrentDiffIndex(newIndex)
        diffEditorRef.current
          .getModifiedEditor()
          .revealLineInCenter(action.modifiedRange.startLineNumber)
      }
    }
  }, [currentDiffIndex, diffActions])

  const handleNextDiff = useCallback(() => {
    if (currentDiffIndex < diffActions.length - 1 && diffEditorRef.current) {
      const newIndex = currentDiffIndex + 1
      const action = diffActions[newIndex]
      if (action?.modifiedRange) {
        setCurrentDiffIndex(newIndex)
        diffEditorRef.current
          .getModifiedEditor()
          .revealLineInCenter(action.modifiedRange.startLineNumber)
      }
    }
  }, [currentDiffIndex, diffActions])

  // Keep All: 接受所有更改
  const handleAcceptAll = useCallback(async () => {
    if (!currentPendingEdit || !currentFile) return

    try {
      // 如果有 diff 编辑器，使用其内容
      if (diffEditorRef.current) {
        const modifiedEditor = diffEditorRef.current.getModifiedEditor()
        const modifiedModel = modifiedEditor.getModel()
        if (modifiedModel) {
          const finalContent = modifiedModel.getValue()
          await window.api.files.write(currentFile.path, finalContent)
          onContentChange(currentFile.path, finalContent)
        }
      }

      onGitRefresh?.()
      setDiffActions([])
      await onAcceptPendingDiff?.(currentPendingEdit.absolutePath)
      // Zustand 同步更新，直接跳转
      handleNextFile()
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }, [
    currentPendingEdit,
    currentFile,
    onContentChange,
    onGitRefresh,
    onAcceptPendingDiff,
    handleNextFile
  ])

  // Undo All: 撤销所有更改
  const handleUndoAll = useCallback(async () => {
    if (!currentPendingEdit) return
    try {
      // 使用 silent 模式，不显示 toast
      await onRejectPendingDiff?.(currentPendingEdit.absolutePath, { silent: true })
      // Zustand 同步更新，直接跳转
      handleNextFile()
    } catch (error) {
      console.error('Failed to reject edit:', error)
    }
  }, [currentPendingEdit, onRejectPendingDiff, handleNextFile])

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-tab-reorder')) {
      setIsTabDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsTabDragging(false)
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      {/* macOS 窗口拖动区域 - 编辑器顶部（无文件时，高度与 TabBar 一致） */}
      {openFiles.length === 0 && (
        <div className="h-[42px] w-full window-drag-region shrink-0 border-b border-border/30" />
      )}
      {openFiles.length > 0 && (
        <TabBar
          openFiles={openFiles}
          activeFile={activeFile}
          autoSave={autoSave}
          isMarkdownFile={isMarkdown}
          markdownMode={markdownMode}
          pendingFileEdits={pendingFileEdits}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onCloseOthers={onCloseOthers}
          onCloseToRight={onCloseToRight}
          onCloseAll={onCloseAll}
          onMarkdownModeChange={onMarkdownModeChange}
          onReorder={onReorder}
        />
      )}

      <div
        className="relative flex-1 overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {/* Tab 拖拽时的遮罩层，阻止 Monaco 接收拖拽 */}
        {isTabDragging && (
          <div
            className="absolute inset-0 z-50"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'none'
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsTabDragging(false)
            }}
          />
        )}
        {/* Cursor 风格：如果有 pending edit，显示 diff 视图 */}
        <EditorContent
          currentFile={currentFile}
          workspaceRoot={workspaceRoot}
          isMarkdown={isMarkdown}
          isImage={isImage}
          markdownMode={markdownMode}
          pendingEdit={currentPendingEdit}
          onContentChange={onContentChange}
          onSave={onSave}
          onDiagnosticsChange={onDiagnosticsChange}
          onCursorPositionChange={onCursorPositionChange}
          onGitRefresh={onGitRefresh}
          onResolveConflict={onResolveConflict}
          onCancelConflict={onCancelConflict}
          onAcceptPendingDiff={onAcceptPendingDiff}
          onDiffChange={setDiffActions}
          onCurrentDiffChange={setCurrentDiffIndex}
          onDiffEditorMount={(editor) => {
            diffEditorRef.current = editor
          }}
        />

        {/* 统一的底部工具条 - 集成文件导航、diff 导航和批量操作 */}
        {showGlobalToolbar && currentFile && (
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-1.5 px-2.5 py-1.5',
              'bg-card/98 backdrop-blur-xl rounded-lg shadow-2xl',
              'z-40 animate-toolbar-fade-in'
            )}
          >
            {/* 当前文件有 diff：显示工具条 */}
            {currentPendingIndex >= 0 && diffActions.length > 0 ? (
              <>
                {/* Diff 导航：只在有多个 diff 时显示 */}
                {diffActions.length > 1 && (
                  <>
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-muted/40 rounded border border-border/40">
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

                    <Separator orientation="vertical" className="h-5" />
                  </>
                )}

                {/* 批量操作 - 当前文件级别 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] gap-1 px-2.5 border-destructive/40 text-destructive/90 hover:bg-destructive/10 hover:border-destructive/60"
                  onClick={handleUndoAll}
                  title={t('editor.undo_all_in_file')}
                >
                  <span>{t('editor.undo_all')}</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-[11px] gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm"
                  onClick={handleAcceptAll}
                  title={t('editor.accept_all_in_file')}
                >
                  <span>{t('editor.keep_all')}</span>
                </Button>

                {/* 文件导航：只在有多个文件时显示 */}
                {pendingFileEdits && pendingFileEdits.length > 1 && (
                  <>
                    <Separator orientation="vertical" className="h-6" />

                    <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded-md border border-border/50">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6"
                        onClick={handlePrevFile}
                        title={t('editor.prev_file')}
                      >
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-mono px-1 min-w-[50px] text-center">
                        {currentPendingIndex + 1} / {pendingFileEdits.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6"
                        onClick={handleNextFile}
                        title={t('editor.next_file')}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : currentPendingIndex >= 0 ? (
              /* 当前文件在 pending edits 但没有 diff：显示批量操作 */
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] gap-1 px-2.5 border-destructive/40 text-destructive/90 hover:bg-destructive/10 hover:border-destructive/60"
                  onClick={handleUndoAll}
                  title={t('editor.undo_all_in_file')}
                >
                  <span>{t('editor.undo_all')}</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-[11px] gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm"
                  onClick={handleAcceptAll}
                  title={t('editor.accept_all_in_file')}
                >
                  <span>{t('editor.keep_all')}</span>
                </Button>

                {/* 文件导航：只在有多个文件时显示 */}
                {pendingFileEdits && pendingFileEdits.length > 1 && (
                  <>
                    <Separator orientation="vertical" className="h-5" />

                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-muted/40 rounded border border-border/40">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-5 w-5 hover:bg-muted/60"
                        onClick={handlePrevFile}
                        title={t('editor.prev_file')}
                      >
                        <ChevronLeft className="size-3" />
                      </Button>
                      <span className="text-[11px] text-muted-foreground font-mono px-1.5 min-w-[45px] text-center whitespace-nowrap">
                        {currentPendingIndex + 1}/{pendingFileEdits.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-5 w-5 hover:bg-muted/60"
                        onClick={handleNextFile}
                        title={t('editor.next_file')}
                      >
                        <ChevronRight className="size-3" />
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* 当前文件不在 pending edits：只显示 Review next file */
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px] gap-1 px-2.5"
                onClick={handleNextFile}
              >
                <span>{t('editor.review_next_file')}</span>
                <ChevronRight className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
