import { create } from 'zustand'

/**
 * 最近项目类型
 */
export interface RecentProject {
  path: string
  name: string
  lastOpened: string | Date
}

/**
 * 项目状态接口
 */
interface ProjectState {
  // 最近项目列表
  recentProjects: RecentProject[]

  // 加载状态
  loading: boolean

  // 操作
  setRecentProjects: (projects: RecentProject[]) => void
  addRecentProject: (project: RecentProject) => void
  removeRecentProject: (path: string) => void
  setLoading: (loading: boolean) => void
}

/**
 * 项目状态 Store
 *
 * 职责：
 * - 管理最近打开的项目列表
 * - 管理项目加载状态
 *
 * 注意：工作区根路径 (workspaceRoot) 由 workspace.store.ts 管理
 */
export const useProjectStore = create<ProjectState>((set) => ({
  // ============================================================================
  // 初始状态
  // ============================================================================
  recentProjects: [],
  loading: true,

  // ============================================================================
  // 操作
  // ============================================================================

  setRecentProjects: (projects) => set({ recentProjects: projects }),

  addRecentProject: (project) =>
    set((state) => {
      // 去重并添加到最前面
      const filtered = state.recentProjects.filter((p) => p.path !== project.path)
      return { recentProjects: [project, ...filtered] }
    }),

  removeRecentProject: (path) =>
    set((state) => ({
      recentProjects: state.recentProjects.filter((p) => p.path !== path)
    })),

  setLoading: (loading) => set({ loading })
}))
