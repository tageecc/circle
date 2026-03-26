import { create } from 'zustand'
import type { GitFileStatus as GitFileStatusType } from '@/types/ide'

// 重新导出类型供其他模块使用
export type GitFileStatus = GitFileStatusType

/**
 * Git 状态接口
 */
interface GitState {
  // Git 仓库状态
  isGitRepo: boolean
  currentBranch: string | null
  gitFileStatus: GitFileStatus | null

  // 检查状态（防止并发）
  isChecking: boolean

  // 分支比较状态
  branchCompare: {
    baseBranch: string
    compareBranch: string
  } | null

  // 操作
  setIsGitRepo: (isRepo: boolean) => void
  setCurrentBranch: (branch: string | null) => void
  setGitFileStatus: (status: GitFileStatus | null) => void
  setIsChecking: (isChecking: boolean) => void
  setBranchCompare: (compare: { baseBranch: string; compareBranch: string } | null) => void

  // 批量更新（性能优化）
  updateGitStatus: (updates: {
    isGitRepo?: boolean
    currentBranch?: string | null
    gitFileStatus?: GitFileStatus | null
  }) => void

  // 重置所有状态
  resetGitState: () => void
}

/**
 * Git 状态 Store
 *
 * 职责：
 * - 管理 Git 仓库状态
 * - 跟踪文件变更状态
 * - 管理分支信息
 * - 优化渲染性能
 */
export const useGitStore = create<GitState>((set) => ({
  // ============================================================================
  // 初始状态
  // ============================================================================
  isGitRepo: false,
  currentBranch: null,
  gitFileStatus: null,
  isChecking: false,
  branchCompare: null,

  // ============================================================================
  // 基础操作
  // ============================================================================

  setIsGitRepo: (isRepo) => set({ isGitRepo: isRepo }),

  setCurrentBranch: (branch) => set({ currentBranch: branch }),

  setGitFileStatus: (status) => set({ gitFileStatus: status }),

  setIsChecking: (isChecking) => set({ isChecking }),

  setBranchCompare: (compare) => set({ branchCompare: compare }),

  // ============================================================================
  // 批量更新（性能优化）
  // ============================================================================

  updateGitStatus: (updates) =>
    set((state) => ({
      ...state,
      ...updates
    })),

  // ============================================================================
  // 重置状态
  // ============================================================================

  resetGitState: () =>
    set({
      isGitRepo: false,
      currentBranch: null,
      gitFileStatus: null,
      isChecking: false,
      branchCompare: null
    })
}))

/**
 * 选择器：获取文件的 Git 状态
 */
export const selectFileGitStatus = (state: GitState, filePath: string): string | null => {
  if (!state.gitFileStatus) return null

  const status = state.gitFileStatus
  if (status.modified.includes(filePath)) return 'M'
  if (status.added.includes(filePath)) return 'A'
  if (status.deleted.includes(filePath)) return 'D'
  if (status.renamed.includes(filePath)) return 'R'
  if (status.conflicted.includes(filePath)) return 'C'
  if (status.untracked.includes(filePath)) return 'U'

  return null
}

/**
 * 选择器：检查文件是否有未提交的更改
 */
export const selectHasUncommittedChanges = (state: GitState): boolean => {
  const status = state.gitFileStatus
  if (!status) return false

  return (
    status.modified.length > 0 ||
    status.added.length > 0 ||
    status.deleted.length > 0 ||
    status.renamed.length > 0
  )
}

/**
 * 选择器：获取变更文件总数
 */
export const selectChangedFilesCount = (state: GitState): number => {
  const status = state.gitFileStatus
  if (!status) return 0

  return (
    status.modified.length +
    status.added.length +
    status.deleted.length +
    status.renamed.length +
    status.untracked.length
  )
}

/**
 * 辅助函数：批量更新 Git 状态（性能优化）
 * 直接调用，不需要通过 hook
 */
export function batchUpdateGitStatus(updates: {
  isGitRepo?: boolean
  currentBranch?: string | null
  gitFileStatus?: GitFileStatus | null
  isChecking?: boolean
}): void {
  useGitStore.setState(updates)
}
