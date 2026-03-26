import { useState, useCallback } from 'react'
import { toast } from '@/components/ui/sonner'

interface PushMismatchState {
  open: boolean
  remote: string
  trackedBranch: string
  currentBranch: string
}

interface UseGitActionsOptions {
  workspaceRoot: string
  onSuccess?: () => void
  onOpenHistory?: () => void
}

/**
 * 统一的 Git 操作 hook
 * 封装所有 Git 操作的业务逻辑，包括错误处理和特殊情况处理
 */
export function useGitActions({ workspaceRoot, onSuccess, onOpenHistory }: UseGitActionsOptions) {
  const [pushMismatch, setPushMismatch] = useState<PushMismatchState>({
    open: false,
    remote: '',
    trackedBranch: '',
    currentBranch: ''
  })

  /**
   * 推送到远程
   * 处理分支名不匹配等特殊情况
   */
  const push = useCallback(
    async (currentBranch: string) => {
      if (!workspaceRoot || !currentBranch) return false

      try {
        // 先检测是否存在追踪分支名不匹配的情况
        const tracking = await window.api.git.getTrackingBranch(workspaceRoot, currentBranch)

        // 如果有追踪分支，且追踪分支名与当前分支名不同，弹出选择对话框
        if (tracking && tracking.branch !== currentBranch) {
          setPushMismatch({
            open: true,
            remote: tracking.remote,
            trackedBranch: tracking.branch,
            currentBranch
          })
          return false
        }

        // 正常推送
        await window.api.git.push(workspaceRoot, 'origin', currentBranch, true)
        toast.success(`已推送到 origin/${currentBranch}`)
        onSuccess?.()
        return true
      } catch (error: any) {
        const errorMsg = error.message || String(error)
        toast.error('推送失败', { description: errorMsg })
        return false
      }
    },
    [workspaceRoot, onSuccess]
  )

  /**
   * 推送到追踪分支（用于分支名不匹配时）
   */
  const pushToTracked = useCallback(async () => {
    const { remote, trackedBranch } = pushMismatch
    try {
      await window.api.git.pushToRef(workspaceRoot, remote, `HEAD:${trackedBranch}`)
      toast.success(`已推送到 ${remote}/${trackedBranch}`)
      onSuccess?.()
      return true
    } catch (error: any) {
      toast.error('推送失败', { description: error.message })
      return false
    }
  }, [workspaceRoot, pushMismatch, onSuccess])

  /**
   * 推送并设置新的上游追踪（用于分支名不匹配时）
   */
  const pushAndSetTracking = useCallback(async () => {
    const { remote, currentBranch } = pushMismatch
    try {
      await window.api.git.pushToRef(workspaceRoot, remote, 'HEAD', true)
      toast.success(`已推送到 ${remote}/${currentBranch}`)
      onSuccess?.()
      return true
    } catch (error: any) {
      toast.error('推送失败', { description: error.message })
      return false
    }
  }, [workspaceRoot, pushMismatch, onSuccess])

  /**
   * 关闭 push mismatch 对话框
   */
  const closePushMismatch = useCallback(() => {
    setPushMismatch({ open: false, remote: '', trackedBranch: '', currentBranch: '' })
  }, [])

  /**
   * 拉取
   */
  const pull = useCallback(async () => {
    if (!workspaceRoot) return false
    try {
      const result = await window.api.git.pull(workspaceRoot, 'origin')
      onSuccess?.()

      if (result.commits === 0) {
        toast.success('Already up to date')
      } else {
        const toastId = `pull-${Date.now()}`
        toast.success(`Pull 成功: ${result.commits} 个提交`, {
          id: toastId,
          description: `${result.files} 个文件变更 (+${result.insertions} / -${result.deletions})`,
          duration: 6000,
          action: onOpenHistory
            ? {
                label: '查看更新 →',
                onClick: () => {
                  toast.dismiss(toastId)
                  onOpenHistory()
                }
              }
            : undefined
        })
      }
      return true
    } catch (error: any) {
      toast.error('拉取失败', { description: error.message })
      return false
    }
  }, [workspaceRoot, onSuccess, onOpenHistory])

  /**
   * 获取远程更新
   */
  const fetch = useCallback(async () => {
    if (!workspaceRoot) return false
    try {
      await window.api.git.fetch(workspaceRoot, 'origin')
      toast.success('获取成功')
      onSuccess?.()
      return true
    } catch (error: any) {
      toast.error('获取失败', { description: error.message })
      return false
    }
  }, [workspaceRoot, onSuccess])

  /**
   * 切换分支
   */
  const checkout = useCallback(
    async (branchName: string) => {
      if (!workspaceRoot) return false
      try {
        await window.api.git.checkoutBranch(workspaceRoot, branchName)
        toast.success(`已切换到分支 ${branchName}`)
        onSuccess?.()
        return true
      } catch (error: any) {
        toast.error('切换分支失败', { description: error.message })
        return false
      }
    },
    [workspaceRoot, onSuccess]
  )

  return {
    // 操作方法
    push,
    pushToTracked,
    pushAndSetTracking,
    pull,
    fetch,
    checkout,
    // Push mismatch 对话框状态
    pushMismatch,
    closePushMismatch
  }
}
