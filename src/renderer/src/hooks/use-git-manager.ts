import { useCallback, useEffect, useRef } from 'react'
import { useGitStore, type GitFileStatus } from '@/stores/git.store'

/**
 * Git 管理 Hook - 重构版
 *
 * 优化要点：
 * 1. ✅ 使用稳定的 store 引用，避免依赖循环
 * 2. ✅ 事件驱动机制，按需检查 Git 状态
 * 3. ✅ 批量更新，减少渲染次数
 * 4. ✅ 智能防抖，避免频繁调用
 */
export function useGitManager(workspaceRoot: string | null) {
  // ✅ 使用精确订阅，只订阅需要的状态
  const isGitRepo = useGitStore((state) => state.isGitRepo)
  const currentBranch = useGitStore((state) => state.currentBranch)
  const gitFileStatus = useGitStore((state) => state.gitFileStatus)
  const branchCompare = useGitStore((state) => state.branchCompare)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const workspaceRootRef = useRef(workspaceRoot)

  // 更新 workspaceRoot ref
  useEffect(() => {
    workspaceRootRef.current = workspaceRoot
  }, [workspaceRoot])

  /**
   * 检查 Git 状态 - 核心方法
   * ✅ 完全独立，不依赖任何 Zustand actions
   * ✅ 直接使用 getState() 和 setState()
   * ✅ 简化：只使用防抖，不使用节流
   */
  const checkGitStatus = useCallback(
    async (immediate = false) => {
      const currentWorkspaceRoot = workspaceRootRef.current

      if (!currentWorkspaceRoot) {
        // 直接调用 store 方法，不通过订阅
        useGitStore.getState().resetGitState()
        return
      }

      // ✅ 防止并发检查
      const store = useGitStore.getState()
      if (store.isChecking) {
        return // 正在检查，跳过
      }

      const doCheck = async () => {
        // 直接调用 setState，不创建闭包
        useGitStore.setState({ isChecking: true })

        try {
          const isRepo = await window.api.git.isRepository(currentWorkspaceRoot)

          if (isRepo) {
            // ✅ 并行获取数据
            const [branch, status] = await Promise.all([
              window.api.git.getCurrentBranch(currentWorkspaceRoot),
              window.api.git.getStatus(currentWorkspaceRoot)
            ])

            // ✅ 批量更新，只触发一次渲染
            useGitStore.setState({
              isGitRepo: true,
              currentBranch: branch,
              gitFileStatus: status as GitFileStatus,
              isChecking: false
            })
          } else {
            // 不是 Git 仓库，重置状态
            useGitStore.setState({
              isGitRepo: false,
              currentBranch: null,
              gitFileStatus: null,
              isChecking: false
            })
          }
        } catch (error) {
          console.error('检查 Git 状态失败:', error)
          useGitStore.setState({ isChecking: false })
        }
      }

      if (immediate) {
        // 立即执行
        doCheck()
      } else {
        // ✅ 只使用防抖（300ms），更简单高效
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(doCheck, 300)
      }
    },
    [] // ✅ 空依赖！完全独立
  )

  // 初始检查 - 只在 workspaceRoot 变化时执行
  useEffect(() => {
    if (workspaceRoot) {
      checkGitStatus(true)
      // ✅ 注册全局刷新函数（绑定到特定 workspace）
      registerGitRefresh(workspaceRoot, () => checkGitStatus(true))
    } else {
      useGitStore.getState().resetGitState()
    }

    // 清理定时器和注册
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      // 清理注册（组件卸载时）
      if (workspaceRoot) {
        unregisterGitRefresh(workspaceRoot)
      }
    }
  }, [workspaceRoot, checkGitStatus])

  /**
   * ✅ 暴露刷新方法给外部（导出供全局调用）
   */
  return {
    isGitRepo,
    currentBranch,
    gitFileStatus,
    branchCompare,
    setBranchCompare: useGitStore.getState().setBranchCompare,
    checkGitStatus
  }
}

/**
 * ✅ 全局 Git 刷新方法（支持多 workspace）
 * 使用 Map 管理多个 workspace 的刷新函数
 */
const _gitCheckFunctions = new Map<string, () => void>()

export function registerGitRefresh(workspaceRoot: string, checkFn: () => void): void {
  _gitCheckFunctions.set(workspaceRoot, checkFn)
}

export function unregisterGitRefresh(workspaceRoot: string): void {
  _gitCheckFunctions.delete(workspaceRoot)
}

/**
 * 刷新 Git 状态
 * @param workspaceRoot 可选，指定要刷新的 workspace。如果不指定，刷新所有
 */
export function refreshGitStatus(workspaceRoot?: string): void {
  if (workspaceRoot) {
    // 刷新指定 workspace
    _gitCheckFunctions.get(workspaceRoot)?.()
  } else {
    // 刷新所有 workspace
    _gitCheckFunctions.forEach((fn) => fn())
  }
}
