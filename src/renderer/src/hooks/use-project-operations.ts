import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { refreshGitStatus } from './use-git-manager'
import { useSettings } from '@/contexts/settings-context'

interface UseProjectOperationsProps {
  openProject: () => Promise<string | null>
  openRecentProject: (path: string) => Promise<{ success: boolean; notFound?: boolean }>
  setWorkspaceRoot: (path: string) => void
  restoreEditorState: (projectPath: string) => Promise<void>
  currentWorkspaceRoot: string | null
}

export function useProjectOperations({
  openProject,
  openRecentProject,
  setWorkspaceRoot,
  restoreEditorState,
  currentWorkspaceRoot
}: UseProjectOperationsProps) {
  const { t } = useTranslation()
  const { generalSettings, updateGeneralSettings } = useSettings()

  const [pendingProject, setPendingProject] = useState<{
    path: string
    name: string
    type: 'open' | 'recent'
  } | null>(null)

  const openProjectInCurrentWindow = useCallback(
    async (projectPath: string) => {
      setWorkspaceRoot(projectPath)
      refreshGitStatus()
      await restoreEditorState(projectPath)
    },
    [setWorkspaceRoot, restoreEditorState]
  )

  const openProjectInNewWindow = useCallback(async (projectPath: string) => {
    try {
      const result = await window.api.project.openInNewWindow(projectPath)
      if (result.success) {
        toast.success(t('project.open_new_window_success'))
      } else {
        toast.error(t('project.open_new_window_failed'), {
          description: result.error
        })
      }
    } catch (error) {
      console.error('Failed to open project in new window:', error)
      toast.error(t('project.open_new_window_failed'))
    }
  }, [t])

  // ✅ 提取公共逻辑：根据用户偏好决定如何打开项目
  const openProjectWithBehavior = useCallback(
    async (projectPath: string, type: 'open' | 'recent' = 'open') => {
      // 没有当前项目，直接打开
      if (!currentWorkspaceRoot) {
        await openProjectInCurrentWindow(projectPath)
        return
      }

      // 有当前项目，根据用户偏好决定
      const behavior = generalSettings.openProjectBehavior

      if (behavior === 'current') {
        await openProjectInCurrentWindow(projectPath)
      } else if (behavior === 'new') {
        await openProjectInNewWindow(projectPath)
      } else {
        // 询问用户
        const projectName = projectPath.split('/').pop() || projectPath
        setPendingProject({ path: projectPath, name: projectName, type })
      }
    },
    [
      currentWorkspaceRoot,
      generalSettings.openProjectBehavior,
      openProjectInCurrentWindow,
      openProjectInNewWindow
    ]
  )

  const handleProjectSelection = useCallback(
    async (openInNewWindow: boolean, rememberChoice: boolean) => {
      if (!pendingProject) return

      // 保存项目信息并立即清空，防止重复点击
      const project = pendingProject
      setPendingProject(null)

      // 记住用户的选择
      if (rememberChoice) {
        updateGeneralSettings({
          openProjectBehavior: openInNewWindow ? 'new' : 'current'
        })
      }

      // 执行选择
      const action = openInNewWindow ? openProjectInNewWindow : openProjectInCurrentWindow
      await action(project.path)
    },
    [pendingProject, openProjectInNewWindow, openProjectInCurrentWindow, updateGeneralSettings]
  )

  const handleOpenProject = useCallback(async () => {
    const projectPath = await openProject()
    if (projectPath) {
      await openProjectWithBehavior(projectPath, 'open')
    }
  }, [openProject, openProjectWithBehavior])

  const handleOpenRecentProject = useCallback(
    async (path: string) => {
      const result = await openRecentProject(path)

      if (!result.success) {
        if (result.notFound) {
          const projectName = path.split('/').pop() || path
          toast.error(t('project.recent_missing', { name: projectName }), {
            description: t('project.recent_missing_desc')
          })
        }
        return
      }

      await openProjectWithBehavior(path, 'recent')
    },
    [openRecentProject, openProjectWithBehavior, t]
  )

  const handleProjectCreated = useCallback(
    async (projectPath: string) => {
      setWorkspaceRoot(projectPath)
      refreshGitStatus()
      await restoreEditorState(projectPath)
    },
    [setWorkspaceRoot, restoreEditorState]
  )

  const handleCloneSuccess = useCallback(
    async (projectPath: string) => {
      setWorkspaceRoot(projectPath)
      await window.api.project.setCurrent(projectPath)
      refreshGitStatus()
    },
    [setWorkspaceRoot]
  )

  return {
    handleOpenProject,
    handleOpenRecentProject,
    handleProjectCreated,
    handleCloneSuccess,
    pendingProject,
    setPendingProject,
    handleProjectSelection
  }
}
