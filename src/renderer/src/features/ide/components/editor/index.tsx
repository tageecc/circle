import { FileTab, MarkdownMode } from '../../types'
import { TabBar } from './tab-bar'
import { EditorContent } from './editor-content'
import { EditorDiagnostic } from '@/components/code/MonacoCodeEditor'

interface EditorAreaProps {
  openFiles: FileTab[]
  activeFile: string | null
  currentFile: FileTab | undefined
  workspaceRoot: string
  autoSave: boolean
  isMarkdown: boolean
  isImage: boolean
  markdownMode?: MarkdownMode
  pendingFileEdit?: {
    toolCallId: string
    filePath: string
    absolutePath: string
    oldContent: string
    newContent: string
    language?: string
  } | null
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
  onAcceptFileEdit?: () => void
  onRejectFileEdit?: () => void
}

export function EditorArea({
  openFiles,
  activeFile,
  currentFile,
  workspaceRoot,
  autoSave,
  isMarkdown,
  isImage,
  markdownMode,
  pendingFileEdit,
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
  onAcceptFileEdit,
  onRejectFileEdit
}: EditorAreaProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {openFiles.length > 0 && (
        <TabBar
          openFiles={openFiles}
          activeFile={activeFile}
          autoSave={autoSave}
          isMarkdownFile={isMarkdown}
          markdownMode={markdownMode}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onCloseOthers={onCloseOthers}
          onCloseToRight={onCloseToRight}
          onCloseAll={onCloseAll}
          onMarkdownModeChange={onMarkdownModeChange}
        />
      )}

      <div className="flex-1 overflow-hidden">
        <EditorContent
          currentFile={currentFile}
          workspaceRoot={workspaceRoot}
          isMarkdown={isMarkdown}
          isImage={isImage}
          markdownMode={markdownMode}
          pendingFileEdit={pendingFileEdit}
          onContentChange={onContentChange}
          onSave={onSave}
          onDiagnosticsChange={onDiagnosticsChange}
          onCursorPositionChange={onCursorPositionChange}
          onAcceptFileEdit={onAcceptFileEdit}
          onRejectFileEdit={onRejectFileEdit}
        />
      </div>
    </div>
  )
}
