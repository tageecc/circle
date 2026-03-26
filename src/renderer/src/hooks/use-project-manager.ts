import { useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useProjectStore, type RecentProject } from '@/stores/project.store'

export interface ProjectLoadResult {
  currentProject: string | null
  uiState: unknown
  projectNotFound?: boolean
  notFoundPath?: string
}

// 过滤有效的项目（目录存在的）
async function filterValidProjects(projects: RecentProject[]): Promise<RecentProject[]> {
  const results = await Promise.all(
    projects.map(async (project) => {
      const exists = await window.api.files.exists(project.path)
      return exists ? project : null
    })
  )
  return results.filter((p): p is RecentProject => p !== null)
}

/**
 * 项目管理 Hook
 *
 * 架构重构：
 * - workspaceRoot 由 workspace.store.ts 管理
 * - recentProjects, loading 由 project.store.ts 管理
 * - 本 Hook 提供统一的项目操作接口
 */
export function useProjectManager(): {
  workspaceRoot: string | null
  recentProjects: RecentProject[]
  loading: boolean
  loadProjectState: () => Promise<ProjectLoadResult | null>
  openProject: () => Promise<string | null>
  openRecentProject: (path: string) => Promise<{ success: boolean; notFound?: boolean }>
  closeProject: () => Promise<void>
  setWorkspaceRoot: (root: string | null) => void
} {
  // ✅ 从 Zustand Store 获取状态和操作
  const workspaceRoot = useWorkspaceStore((state) => state.workspaceRoot)
  const setWorkspaceRoot = useWorkspaceStore((state) => state.setWorkspaceRoot)

  const recentProjects = useProjectStore((state) => state.recentProjects)
  const loading = useProjectStore((state) => state.loading)
  const setRecentProjects = useProjectStore((state) => state.setRecentProjects)
  const setLoading = useProjectStore((state) => state.setLoading)

  const loadProjectState = useCallback(async (): Promise<ProjectLoadResult | null> => {
    try {
      setLoading(true)

      // ✅ 优化：并行加载，添加超时保护
      const [currentProject, recent, uiState] = await Promise.race([
        Promise.all([
          window.api.project.getCurrent(),
          window.api.project.getRecent(),
          window.api.config.getUIState()
        ]),
        new Promise<[string | null, any[], any]>((_, reject) =>
          setTimeout(() => reject(new Error('Load timeout')), 5000)
        )
      ]).catch((error) => {
        console.error('加载项目状态超时:', error)
        return [null, [], {}] as [string | null, any[], any]
      })

      // ✅ 异步验证最近项目列表，不阻塞
      filterValidProjects(recent).then((validProjects) => {
        setRecentProjects(validProjects)
      })

      if (currentProject) {
        // ✅ 同步检查项目是否存在，避免竞态条件
        const projectExists = await window.api.files.exists(currentProject)
        if (!projectExists) {
          console.warn(`当前项目路径不存在: ${currentProject}`)
          await window.api.project.setCurrent(null)
          setWorkspaceRoot(null)
          setLoading(false)
          return {
            currentProject: null,
            uiState,
            projectNotFound: true,
            notFoundPath: currentProject
          }
        }

        setWorkspaceRoot(currentProject)
        setLoading(false)
        return { currentProject, uiState }
      } else {
        setWorkspaceRoot(null)
        setLoading(false)
        return { currentProject: null, uiState }
      }
    } catch (error) {
      console.error('加载项目状态失败:', error)
      setWorkspaceRoot(null)
      setLoading(false)
      return null
    }
  }, [setLoading, setRecentProjects, setWorkspaceRoot])

  const openProject = useCallback(async (): Promise<string | null> => {
    try {
      const selectedPath = await window.api.project.openDialog()
      if (selectedPath) {
        await window.api.project.setCurrent(selectedPath)
        setWorkspaceRoot(selectedPath)
        return selectedPath
      }
      return null
    } catch (error) {
      console.error('打开项目失败:', error)
      return null
    }
  }, [setWorkspaceRoot])

  const openRecentProject = useCallback(
    async (path: string): Promise<{ success: boolean; notFound?: boolean }> => {
      try {
        const exists = await window.api.files.exists(path)
        if (!exists) {
          console.warn(`项目路径不存在: ${path}`)
          return { success: false, notFound: true }
        }

        await window.api.project.setCurrent(path)
        setWorkspaceRoot(path)
        return { success: true }
      } catch (error) {
        console.error('打开最近项目失败:', error)
        return { success: false }
      }
    },
    [setWorkspaceRoot]
  )

  const closeProject = useCallback(async (): Promise<void> => {
    try {
      await window.api.project.setCurrent(null)
      setWorkspaceRoot(null)
    } catch (error) {
      console.error('关闭项目失败:', error)
    }
  }, [setWorkspaceRoot])

  return {
    workspaceRoot,
    recentProjects,
    loading,
    loadProjectState,
    openProject,
    openRecentProject,
    closeProject,
    setWorkspaceRoot
  }
}
