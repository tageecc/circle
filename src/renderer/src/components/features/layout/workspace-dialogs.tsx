import { InputDialog } from '../common/input-dialog'
import { SettingsDialog } from '../settings/settings-dialog'
import { BugReportDialog } from '../common/bug-report-dialog'
import { QuickOpenDialog } from '../quick-open/quick-open-dialog'
import { GitStashDialog } from '../git/git-stash-dialog'
import { CloneRepositoryDialog } from '../git/clone-repository-dialog'
import { OpenProjectConfirmDialog } from '../dialogs/open-project-confirm-dialog'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useFileManager } from '@/hooks/use-file-manager'
import { useGitManager, refreshGitStatus } from '@/hooks/use-git-manager'
import { useFileTreeOperations } from '@/hooks/use-file-tree-operations'
import { useConfirm } from '../common/confirm-provider'

interface WorkspaceDialogsProps {
  workspaceRoot: string | null
  setWorkspaceRoot: (root: string) => void
  settingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
  // 项目确认对话框相关
  pendingProject: { path: string; name: string; type: 'open' | 'recent' } | null
  onProjectConfirm: (openInNewWindow: boolean, rememberChoice: boolean) => void
  onProjectConfirmCancel: () => void
}

export function WorkspaceDialogs({
  workspaceRoot,
  setWorkspaceRoot,
  settingsOpen,
  onSettingsOpenChange,
  pendingProject,
  onProjectConfirm,
  onProjectConfirmCancel
}: WorkspaceDialogsProps) {
  const confirm = useConfirm()

  // ✅ 统一从 Zustand 获取对话框状态和控制方法
  const newItemParentPath = useWorkspaceUIStore((state) => state.newItemParentPath)
  const newFileDialogOpen = useWorkspaceUIStore((state) => state.newFileDialogOpen)
  const newFolderDialogOpen = useWorkspaceUIStore((state) => state.newFolderDialogOpen)
  const quickOpenDialogOpen = useWorkspaceUIStore((state) => state.quickOpenDialogOpen)
  const cloneDialogOpen = useWorkspaceUIStore((state) => state.cloneDialogOpen)
  const showStashDialog = useWorkspaceUIStore((state) => state.showStashDialog)
  const bugReportOpen = useWorkspaceUIStore((state) => state.bugReportOpen)
  const openDialog = useWorkspaceUIStore((state) => state.openDialog)
  const closeDialog = useWorkspaceUIStore((state) => state.closeDialog)
  const refreshFileTree = useWorkspaceUIStore((state) => state.refreshFileTree)

  const fileManager = useFileManager(workspaceRoot)
  const { currentBranch } = useGitManager(workspaceRoot)
  const fileTreeOps = useFileTreeOperations({
    workspaceRoot,
    fileManager,
    confirm,
    refreshFileTree
  })

  return (
    <>
      <InputDialog
        open={newFileDialogOpen}
        onOpenChange={(open) => !open && closeDialog('newFile')}
        title="New File"
        description="Enter the name of the new file"
        label="File name"
        placeholder="example.tsx"
        onConfirm={(name) => {
          fileTreeOps.createFile(newItemParentPath, name)
          closeDialog('newFile')
        }}
      />

      <InputDialog
        open={newFolderDialogOpen}
        onOpenChange={(open) => !open && closeDialog('newFolder')}
        title="New Folder"
        description="Enter the name of the new folder"
        label="Folder name"
        placeholder="my-folder"
        onConfirm={(name) => {
          fileTreeOps.createFolder(newItemParentPath, name)
          closeDialog('newFolder')
        }}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={onSettingsOpenChange} />
      <BugReportDialog
        open={bugReportOpen}
        onOpenChange={(open) => (open ? openDialog('bugReport') : closeDialog('bugReport'))}
      />

      <QuickOpenDialog
        open={quickOpenDialogOpen}
        onOpenChange={(open) => !open && closeDialog('quickOpen')}
        workspaceRoot={workspaceRoot}
        onFileSelect={fileManager.openFile}
      />

      {workspaceRoot && (
        <>
          <GitStashDialog
            open={showStashDialog}
            workspaceRoot={workspaceRoot}
            currentBranch={currentBranch || 'main'}
            onClose={() => closeDialog('stash')}
            onSuccess={() => {
              closeDialog('stash')
              refreshGitStatus()
            }}
          />

          <CloneRepositoryDialog
            open={cloneDialogOpen}
            onClose={() => closeDialog('clone')}
            onSuccess={async (projectPath) => {
              closeDialog('clone')
              setWorkspaceRoot(projectPath)
              await window.api.project.setCurrent(projectPath)
              refreshGitStatus()
            }}
          />
        </>
      )}

      {/* 打开项目确认对话框 */}
      <OpenProjectConfirmDialog
        open={!!pendingProject}
        onOpenChange={(open) => !open && onProjectConfirmCancel()}
        onConfirm={onProjectConfirm}
        projectName={pendingProject?.name || ''}
      />
    </>
  )
}
