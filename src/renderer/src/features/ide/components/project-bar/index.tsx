import { ProjectSwitcher } from './project-switcher'
import { RecentProject } from '../../types'

interface ProjectBarProps {
  workspaceRoot: string
  recentProjects: RecentProject[]
  onNewProject: () => void
  onOpenProject: () => void
  onCloneRepository: () => void
  onOpenRecentProject: (path: string) => void
}

/** 顶栏项目切换（分支已移至底部 StatusBar，参考 Codex） */
export function ProjectBar({
  workspaceRoot,
  recentProjects,
  onNewProject,
  onOpenProject,
  onCloneRepository,
  onOpenRecentProject
}: ProjectBarProps) {
  return (
    <div className="ml-4 flex items-center gap-2">
      <ProjectSwitcher
        workspaceRoot={workspaceRoot}
        recentProjects={recentProjects}
        onNewProject={onNewProject}
        onOpenProject={onOpenProject}
        onCloneRepository={onCloneRepository}
        onOpenRecentProject={onOpenRecentProject}
      />
    </div>
  )
}
