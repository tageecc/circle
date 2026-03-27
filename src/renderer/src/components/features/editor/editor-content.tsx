import { FileTab, MarkdownMode, PendingFileEdit } from '@/types/ide'
import { MonacoCodeEditor, EditorDiagnostic } from './monaco-code-editor'
import { MonacoDiffEditor } from './monaco-diff-editor'
import { GitDiffEditor } from './git-diff-editor'
import { GitMergeEditor } from './git-merge-editor'
import { MarkdownPreview } from './markdown-preview'
import { ImagePreview } from './image-preview'
import { MCPDetailView } from '../mcp/mcp-detail-view'
import { File } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffAction } from './monaco-editor.types'
import type { editor } from 'monaco-editor'
import { useTranslation } from 'react-i18next'

interface EditorContentProps {
  currentFile: FileTab | undefined
  workspaceRoot: string
  isMarkdown: boolean
  isImage: boolean
  markdownMode?: MarkdownMode
  /** Cursor 风格：当前文件的 pending edit（用于显示 diff 视图） */
  pendingEdit?: PendingFileEdit
  onContentChange: (path: string, content: string) => void
  onSave: (path: string, content: string) => void
  onDiagnosticsChange: (filePath: string, diagnostics: EditorDiagnostic[]) => void
  onCursorPositionChange: (position: { line: number; column: number }) => void
  onGitRefresh?: () => void
  onResolveConflict?: (path: string, resolvedContent: string) => void
  onCancelConflict?: () => void
  /** Cursor 风格：接受 pending diff（保留 AI 修改） */
  onAcceptPendingDiff?: (absolutePath: string) => void
  /** Diff 变化回调（传递给 EditorArea 用于工具条） */
  onDiffChange?: (actions: DiffAction[]) => void
  /** 当前 diff 索引变化回调 */
  onCurrentDiffChange?: (index: number) => void
  /** Diff 编辑器挂载回调 */
  onDiffEditorMount?: (editor: editor.IStandaloneDiffEditor) => void
}

export function EditorContent({
  currentFile,
  workspaceRoot,
  isMarkdown,
  isImage,
  markdownMode,
  pendingEdit,
  onContentChange,
  onSave,
  onDiagnosticsChange,
  onCursorPositionChange,
  onGitRefresh,
  onResolveConflict,
  onCancelConflict,
  onAcceptPendingDiff,
  onDiffChange,
  onCurrentDiffChange,
  onDiffEditorMount
}: EditorContentProps) {
  const { t } = useTranslation()

  if (!currentFile) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <File className="mx-auto mb-2 size-12 opacity-20" />
          <p className="text-sm">{t('editor.no_file_open')}</p>
          <p className="mt-1 text-xs">{t('editor.select_file_to_edit')}</p>
        </div>
      </div>
    )
  }

  if (isImage) {
    return <ImagePreview path={currentFile.path} />
  }

  // MCP 详情页视图
  if (currentFile.isMCPDetail && currentFile.mcpServerId) {
    return (
      <MCPDetailView serverId={currentFile.mcpServerId} usageCount={currentFile.mcpUsageCount} />
    )
  }

  // Git 冲突解决视图（三方合并）
  if (
    currentFile.showConflict &&
    currentFile.oursContent !== undefined &&
    currentFile.theirsContent !== undefined
  ) {
    return (
      <GitMergeEditor
        ours={currentFile.oursContent}
        theirs={currentFile.theirsContent}
        base={currentFile.baseContent || ''}
        language={currentFile.language}
        oursTitle={`Changes from ${currentFile.oursBranch || 'HEAD'}`}
        theirsTitle={`Changes from ${currentFile.theirsBranch || 'incoming'}`}
        resultTitle={`Result  ${currentFile.name}`}
        height="100%"
        onSave={(resolvedContent) => {
          onResolveConflict?.(currentFile.path, resolvedContent)
        }}
        onCancel={onCancelConflict}
      />
    )
  }

  // Cursor 风格：AI Pending Diff 视图（显示 AI 编辑的 diff）
  // 内置工具栏：单个 diff 的 Accept/Reject（悬浮在 diff 旁边）
  // 全局工具栏：文件导航、Keep All、Undo All（在 EditorArea 底部）
  if (pendingEdit) {
    // 使用 toolName 区分删除和清空（都是 newContent 为空）
    const isDelete = pendingEdit.toolName === 'delete_file'

    return (
      <MonacoDiffEditor
        originalValue={pendingEdit.oldContent}
        value={pendingEdit.newContent} // 直接使用 newContent（删除和清空时都为空字符串）
        language={currentFile.language}
        height="100%"
        onChange={(newValue) => {
          if (newValue !== undefined && !isDelete) {
            // 删除操作不允许编辑（清空操作可以编辑）
            onContentChange(currentFile.path, newValue)
          }
        }}
        onAllDiffsResolved={async (finalContent) => {
          // 所有 diff 都处理完后，保存最终内容到磁盘，然后清理 pending 状态
          try {
            if (!isDelete) {
              await window.api.files.write(currentFile.path, finalContent)
              onContentChange(currentFile.path, finalContent)
            }
            onGitRefresh?.()
          } catch (error) {
            console.error('Failed to save file after resolving diffs:', error)
          }
          onAcceptPendingDiff?.(pendingEdit.absolutePath)
        }}
        onDiffChange={onDiffChange}
        onCurrentDiffChange={onCurrentDiffChange}
        onMount={onDiffEditorMount}
      />
    )
  }

  // Git Diff 视图（从 Changes 面板点击的 modified/deleted 文件，或从 Stash 面板点击的文件，或分支比较）
  if (currentFile.originalContent !== undefined) {
    const isStashDiff = currentFile.stashIndex !== undefined
    const isBranchCompare = currentFile.baseBranch && currentFile.compareBranch

    // Apply 变更：直接保存文件（stash diff 和分支比较不支持 apply，因为是只读对比）
    const handleApplyChange =
      !currentFile.isDeleted && !isStashDiff && !isBranchCompare
        ? async (newContent: string) => {
            try {
              await window.api.files.write(currentFile.path, newContent)
              // 更新内容以刷新 diff 视图
              onContentChange(currentFile.path, newContent)
              // 刷新 git 状态
              onGitRefresh?.()
            } catch (error) {
              console.error('Failed to apply change:', error)
            }
          }
        : undefined

    // 确定标题
    let originalTitle: string
    let modifiedTitle: string

    if (isBranchCompare) {
      // 分支比较：显示分支名称
      originalTitle = currentFile.baseBranch!
      modifiedTitle = currentFile.compareBranch!
    } else if (isStashDiff) {
      // 截断过长的 stash 消息
      const message = currentFile.stashMessage || `Stash #${currentFile.stashIndex}`
      const truncatedMessage = message.length > 40 ? message.slice(0, 40) + '...' : message
      originalTitle = t('editor.git_stash_title', { message: truncatedMessage })
      modifiedTitle = t('editor.git_diff_current_version')
    } else if (currentFile.isDeleted) {
      originalTitle = t('editor.git_diff_deleted_head')
      modifiedTitle = t('editor.git_diff_file_deleted')
    } else {
      originalTitle = t('editor.git_diff_original_head')
      modifiedTitle = t('editor.git_diff_workspace')
    }

    return (
      <GitDiffEditor
        original={currentFile.originalContent}
        modified={currentFile.content}
        language={currentFile.language}
        originalTitle={originalTitle}
        modifiedTitle={modifiedTitle}
        height="100%"
        onApplyChange={handleApplyChange}
      />
    )
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
              readOnly={currentFile.readOnly}
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
      readOnly={currentFile.readOnly}
      onChange={(value, filePath) => onContentChange(filePath, value || '')}
      onSave={(content, filePath) => onSave(filePath, content)}
      onDiagnosticsChange={(diagnostics) => onDiagnosticsChange(currentFile.path, diagnostics)}
      onCursorPositionChange={onCursorPositionChange}
      workspaceRoot={workspaceRoot}
    />
  )
}
