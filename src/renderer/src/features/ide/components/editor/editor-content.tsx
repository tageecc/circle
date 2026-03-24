import { FileTab, MarkdownMode } from '../../types'
import { MonacoCodeEditor, EditorDiagnostic } from '@/components/code/MonacoCodeEditor'
import { MonacoDiffEditor } from '@/components/code/MonacoDiffEditor'
import { MarkdownPreview } from '@/components/code/MarkdownPreview'
import { ImagePreview } from '@/components/code/ImagePreview'
import { File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorContentProps {
  currentFile: FileTab | undefined
  workspaceRoot: string
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
  onContentChange: (path: string, content: string) => void
  onSave: (path: string, content: string) => void
  onDiagnosticsChange: (filePath: string, diagnostics: EditorDiagnostic[]) => void
  onCursorPositionChange: (position: { line: number; column: number }) => void
  onAcceptFileEdit?: () => void
  onRejectFileEdit?: () => void
}

export function EditorContent({
  currentFile,
  workspaceRoot,
  isMarkdown,
  isImage,
  markdownMode,
  pendingFileEdit,
  onContentChange,
  onSave,
  onDiagnosticsChange,
  onCursorPositionChange,
  onAcceptFileEdit,
  onRejectFileEdit
}: EditorContentProps) {
  // 检查当前文件是否有 pending edit
  const hasPendingEdit =
    pendingFileEdit &&
    currentFile &&
    (pendingFileEdit.absolutePath === currentFile.path ||
      pendingFileEdit.filePath === currentFile.name)

  // Diff 预览模式
  if (hasPendingEdit && pendingFileEdit) {
    const filePath = (currentFile?.path || pendingFileEdit.absolutePath) as string

    return (
      <MonacoDiffEditor
        value={pendingFileEdit.newContent}
        originalValue={pendingFileEdit.oldContent}
        language={pendingFileEdit.language || 'plaintext'}
        height="100%"
        renderSideBySide={false}
        readOnly={false}
        wholeFileAcceptReject
        toolbar={{
          enabled: true,
          showNavigation: true,
          showAccept: true,
          showReject: true,
          acceptLabel: '接受',
          rejectLabel: '拒绝',
          position: 'bottom'
        }}
        onAccept={onAcceptFileEdit}
        onReject={onRejectFileEdit}
        onChange={(newContent) => {
          onContentChange(filePath, newContent || '')
        }}
      />
    )
  }

  if (!currentFile) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <File className="mx-auto mb-2 size-12 opacity-20" />
          <p className="text-sm">No file open</p>
          <p className="mt-1 text-xs">Select a file to start editing</p>
        </div>
      </div>
    )
  }

  if (isImage) {
    return <ImagePreview path={currentFile.path} />
  }

  if (isMarkdown && markdownMode) {
    return (
      <div className="flex h-full">
        {(markdownMode === 'edit' || markdownMode === 'split') && (
          <div className={cn('h-full', markdownMode === 'split' ? 'w-1/2 border-r' : 'w-full')}>
            <MonacoCodeEditor
              path={currentFile.path}
              value={currentFile.content}
              language={currentFile.language}
              onChange={(value, filePath) => onContentChange(filePath, value || '')}
              onSave={(content, filePath) => onSave(filePath, content)}
              onDiagnosticsChange={(diagnostics) =>
                onDiagnosticsChange(currentFile.path, diagnostics)
              }
              onCursorPositionChange={onCursorPositionChange}
              workspaceRoot={workspaceRoot}
            />
          </div>
        )}

        {(markdownMode === 'preview' || markdownMode === 'split') && (
          <div className={cn('h-full', markdownMode === 'split' ? 'w-1/2' : 'w-full')}>
            <MarkdownPreview content={currentFile.content} />
          </div>
        )}
      </div>
    )
  }

  return (
    <MonacoCodeEditor
      path={currentFile.path}
      value={currentFile.content}
      language={currentFile.language}
      onChange={(value, filePath) => onContentChange(filePath, value || '')}
      onSave={(content, filePath) => onSave(filePath, content)}
      onDiagnosticsChange={(diagnostics) => onDiagnosticsChange(currentFile.path, diagnostics)}
      onCursorPositionChange={onCursorPositionChange}
      workspaceRoot={workspaceRoot}
    />
  )
}
