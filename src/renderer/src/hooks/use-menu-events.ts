import { useEffect } from 'react'
import { toast } from '@/components/ui/sonner'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { refreshGitStatus } from './use-git-manager'
import type { useFileManager } from './use-file-manager'

interface UseMenuEventsProps {
  fileManager: ReturnType<typeof useFileManager>
  handleOpenProject: () => Promise<void>
  handleOpenRecentProject: (path: string) => Promise<void>
  closeProject: () => Promise<void>
}

export function useMenuEvents({
  fileManager,
  handleOpenProject,
  handleOpenRecentProject,
  closeProject
}: UseMenuEventsProps) {
  const openDialog = useWorkspaceUIStore((state) => state.openDialog)
  const toggleFileTree = useWorkspaceUIStore((state) => state.toggleFileTree)
  const toggleChatSidebar = useWorkspaceUIStore((state) => state.toggleChatSidebar)

  useEffect(() => {
    const unsubscribers = [
      window.api.menu.onOpenProject(handleOpenProject),
      window.api.menu.onOpenRecentProject(handleOpenRecentProject),
      window.api.menu.onSaveFile(
        () =>
          fileManager.activeFile &&
          fileManager.saveFile(fileManager.activeFile, undefined, () => refreshGitStatus())
      ),
      window.api.menu.onSaveAll(() => {
        toast.info('全部保存功能开发中')
      }),
      window.api.menu.onCloseWorkspace(closeProject),
      window.api.menu.onOpenSettings(() => openDialog('settings')),
      window.api.menu.onToggleSidebar(toggleFileTree),
      window.api.menu.onToggleChat(toggleChatSidebar),
      window.api.menu.onToggleTerminal(() => {
        const { bottomPanel, setBottomPanel } = useWorkspaceUIStore.getState()
        setBottomPanel(bottomPanel === null ? 'terminal' : null)
      }),
      window.api.menu.onReportBug(() => openDialog('bugReport'))
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [
    fileManager,
    handleOpenProject,
    handleOpenRecentProject,
    closeProject,
    openDialog,
    toggleFileTree,
    toggleChatSidebar
  ])
}
