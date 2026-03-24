import { FileMenu } from './file-menu'
import { EditMenu } from './edit-menu'
import { ViewMenu } from './view-menu'
import { HelpMenu } from './help-menu'
import { RecentProject } from '../../types'

interface MenuBarProps {
  activeFile: string | null
  hasOpenFiles: boolean
  workspaceRoot: string | null
  recentProjects: RecentProject[]
  autoSave: boolean
  onOpenProject: () => void
  onOpenRecentProject: (path: string) => void
  onSaveFile: () => void
  onCloseFile: () => void
  onCloseWorkspace: () => void
  onToggleAutoSave: (checked: boolean) => void
  onDebugConfig: () => void
}

export function MenuBar({
  activeFile,
  hasOpenFiles,
  workspaceRoot,
  recentProjects,
  autoSave,
  onOpenProject,
  onOpenRecentProject,
  onSaveFile,
  onCloseFile,
  onCloseWorkspace,
  onToggleAutoSave,
  onDebugConfig
}: MenuBarProps) {
  return (
    <div className="flex items-center gap-0">
      <FileMenu
        activeFile={activeFile}
        hasOpenFiles={hasOpenFiles}
        workspaceRoot={workspaceRoot}
        recentProjects={recentProjects}
        autoSave={autoSave}
        onOpenProject={onOpenProject}
        onOpenRecentProject={onOpenRecentProject}
        onSaveFile={onSaveFile}
        onCloseFile={onCloseFile}
        onCloseWorkspace={onCloseWorkspace}
        onToggleAutoSave={onToggleAutoSave}
      />
      <EditMenu />
      <ViewMenu />
      <HelpMenu onDebugConfig={onDebugConfig} />
    </div>
  )
}
