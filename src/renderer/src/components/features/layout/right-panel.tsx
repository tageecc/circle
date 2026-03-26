import { useEffect, memo } from 'react'
import { ChatSidebar } from '../chat/chat-sidebar'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useFileManager } from '@/hooks/use-file-manager'
import { usePendingEditsActions } from '@/hooks/use-pending-edits-actions'

interface RightPanelProps {
  workspaceRoot: string
}

export const RightPanel = memo(function RightPanel({ workspaceRoot }: RightPanelProps) {
  // Store - 精确订阅
  const setChatInitialized = useWorkspaceUIStore((state) => state.setChatInitialized)
  const setPendingTerminalCommand = useWorkspaceUIStore((state) => state.setPendingTerminalCommand)
  const refreshFileTree = useWorkspaceUIStore((state) => state.refreshFileTree)

  const fileManager = useFileManager(workspaceRoot)

  const {
    pendingFileEdits,
    addEdit,
    handleAcceptFileEdit,
    handleRejectFileEdit,
    handleAcceptAllFileEdits,
    handleRejectAllFileEdits,
    handleClearSessionPendingEdits
  } = usePendingEditsActions({ workspaceRoot, fileManager, refreshFileTree })

  // Terminal: run-command requests from tools
  useEffect(() => {
    const cleanup = window.api.terminal.onRunCommand((command) => {
      setPendingTerminalCommand(command)
    })
    return cleanup
  }, [setPendingTerminalCommand])

  return (
    <ChatSidebar
      workspaceRoot={workspaceRoot}
      pendingFileEdits={pendingFileEdits}
      onOpenFile={(filePath) => fileManager.openFile(filePath)}
      onAddPendingFileEdit={(edit) => {
        addEdit(edit)
        fileManager.openFile(edit.absolutePath)
      }}
      onAcceptFileEdit={handleAcceptFileEdit}
      onRejectFileEdit={handleRejectFileEdit}
      onAcceptAllFileEdits={handleAcceptAllFileEdits}
      onRejectAllFileEdits={handleRejectAllFileEdits}
      onClearSessionPendingEdits={handleClearSessionPendingEdits}
      onInitialized={() => setChatInitialized(true)}
    />
  )
})
