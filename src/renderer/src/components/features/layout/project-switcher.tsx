import { useState, useCallback, useEffect } from 'react'
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
import { RecentProject } from '@/types/ide'
import { NewProjectDialog } from '@/components/features/common/new-project-dialog'
import { CloneRepositoryDialog } from '@/components/features/git/clone-repository-dialog'

interface ProjectSwitcherProps {
  // 项目切换通知（影响全局状态，需要刷新整个 IDE）
  onProjectChange?: (projectPath: string) => void
}

export function ProjectSwitcher({ onProjectChange }: ProjectSwitcherProps) {
  // 组件自己管理状态
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('')
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)

  // 加载项目状态
  useEffect(() => {
    const loadState = async () => {
      try {
        const [current, recent] = await Promise.all([
          window.api.project.getCurrent(),
          window.api.project.getRecent()
        ])
        setWorkspaceRoot(current || '')
        setRecentProjects(recent)
      } catch (error) {
        console.error('Failed to load project state:', error)
      }
    }
    loadState()
  }, [])

  // 打开项目
  const handleOpenProject = useCallback(async () => {
    try {
      const projectPath = await window.api.project.openDialog()
      if (projectPath) {
        setWorkspaceRoot(projectPath)
        onProjectChange?.(projectPath)
      }
    } catch (error: any) {
      console.error('Failed to open project:', error)
    }
  }, [onProjectChange])

  // 打开最近项目
  const handleOpenRecentProject = useCallback(
    async (projectPath: string) => {
      try {
        await window.api.project.setCurrent(projectPath)
        setWorkspaceRoot(projectPath)
        onProjectChange?.(projectPath)
      } catch (error: any) {
        console.error('Failed to open recent project:', error)
      }
    },
    [onProjectChange]
  )

  // 项目创建成功
  const handleProjectCreated = useCallback(
    (projectPath: string) => {
      setWorkspaceRoot(projectPath)
      setShowNewProjectDialog(false)
      setShowCloneDialog(false)
      onProjectChange?.(projectPath)
    },
    [onProjectChange]
  )

  if (!workspaceRoot) return null

  return (
    <>
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
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setShowNewProjectDialog(true)}
          >
            <Plus className="mr-2 size-4" />
            <span>New Project...</span>
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer" onClick={handleOpenProject}>
            <FolderOpen className="mr-2 size-4" />
            <span>Open...</span>
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer" onClick={() => setShowCloneDialog(true)}>
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
                  onClick={() => handleOpenRecentProject(project.path)}
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

      {/* 对话框在组件内部管理 */}
      <NewProjectDialog
        open={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
        onSuccess={handleProjectCreated}
      />

      <CloneRepositoryDialog
        open={showCloneDialog}
        onClose={() => setShowCloneDialog(false)}
        onSuccess={handleProjectCreated}
      />
    </>
  )
}
