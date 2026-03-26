import { usePendingEdits } from './use-pending-edits'
import { usePendingEditsStore } from '@/stores/pending-edits.store'
import type { useFileManager } from './use-file-manager'

interface UsePendingEditsActionsProps {
  workspaceRoot: string | null
  fileManager: ReturnType<typeof useFileManager>
  refreshFileTree: () => void
}

export function usePendingEditsActions({
  workspaceRoot,
  fileManager,
  refreshFileTree
}: UsePendingEditsActionsProps) {
  const {
    edits: pendingFileEdits,
    addEdit,
    acceptEdit,
    rejectEdit,
    acceptAll,
    rejectAll
  } = usePendingEdits(workspaceRoot)

  const handleAcceptFileEdit = async (absolutePath: string) => {
    try {
      await acceptEdit(absolutePath)
    } catch (error) {
      console.error('Failed to accept file edit:', error)
    }
  }

  const handleRejectFileEdit = async (absolutePath: string, options?: { silent?: boolean }) => {
    try {
      const edit = pendingFileEdits.find((e) => e.absolutePath === absolutePath)

      if (edit && edit.oldContent) {
        const openFile = fileManager.openFiles.find(
          (f) => f.path === edit.absolutePath || f.path === edit.filePath
        )
        if (openFile) {
          fileManager.updateContent(openFile.path, edit.oldContent)
        }
      }

      await rejectEdit(absolutePath, { ...options, fileManager })

      if (edit && !edit.oldContent) {
        fileManager.closeFile(edit.filePath)
      }

      refreshFileTree()
    } catch (error) {
      console.error('Failed to reject file edit:', error)
    }
  }

  const handleAcceptAllFileEdits = async (sessionId?: string) => {
    try {
      await acceptAll(sessionId)
      refreshFileTree()
    } catch (error) {
      console.error('Failed to accept all file edits:', error)
    }
  }

  const handleRejectAllFileEdits = async (sessionId?: string) => {
    const editsToReject = sessionId
      ? pendingFileEdits.filter((e) => e.sessionId === sessionId)
      : pendingFileEdits

    try {
      for (const edit of editsToReject) {
        if (edit.oldContent) {
          const openFile = fileManager.openFiles.find(
            (f) => f.path === edit.absolutePath || f.path === edit.filePath
          )
          if (openFile) {
            fileManager.updateContent(openFile.path, edit.oldContent)
          }
        } else {
          fileManager.closeFile(edit.filePath)
        }
      }

      await rejectAll(sessionId, { fileManager })
      refreshFileTree()
    } catch (error) {
      console.error('Failed to reject all file edits:', error)
    }
  }

  const handleClearSessionPendingEdits = (sessionId: string) => {
    if (!workspaceRoot) return
    const store = usePendingEditsStore.getState()
    store.clearSession(workspaceRoot, sessionId)
  }

  return {
    pendingFileEdits,
    addEdit,
    handleAcceptFileEdit,
    handleRejectFileEdit,
    handleAcceptAllFileEdits,
    handleRejectAllFileEdits,
    handleClearSessionPendingEdits
  }
}
