import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Folder, ChevronDown, FolderOpen, Plus, GitFork, GitBranch } from 'lucide-react'
import { RecentProject } from '../../types'

interface ProjectSwitcherProps {
  workspaceRoot: string
  recentProjects: RecentProject[]
  onNewProject: () => void
  onOpenProject: () => void
  onCloneRepository: () => void
  onOpenRecentProject: (path: string) => void
}

export function ProjectSwitcher({
  workspaceRoot,
  recentProjects,
  onNewProject,
  onOpenProject,
  onCloneRepository,
  onOpenRecentProject
}: ProjectSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs font-normal hover:bg-accent"
        >
          <Folder className="size-3.5" />
          <span className="max-w-[150px] truncate">{workspaceRoot.split('/').pop()}</span>
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px]">
        <DropdownMenuItem className="cursor-pointer" onClick={onNewProject}>
          <Plus className="mr-2 size-4" />
          <span>New Project...</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer" onClick={onOpenProject}>
          <FolderOpen className="mr-2 size-4" />
          <span>Open...</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer" onClick={onCloneRepository}>
          <GitFork className="mr-2 size-4" />
          <span>Clone Repository...</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {recentProjects.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Recent Projects
            </DropdownMenuLabel>
            {recentProjects.slice(0, 5).map((project) => (
              <DropdownMenuItem
                key={project.path}
                className="cursor-pointer"
                onClick={() => onOpenRecentProject(project.path)}
              >
                <GitBranch className="mr-2 size-4 text-muted-foreground" />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm">{project.name}</span>
                  <span className="text-xs text-muted-foreground">{project.path}</span>
                </div>
                {project.path === workspaceRoot && (
                  <span className="ml-2 text-xs text-primary">●</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
