import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { GitFileStatus } from '../types'

export function useGitManager(workspaceRoot: string | null) {
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [gitFileStatus, setGitFileStatus] = useState<GitFileStatus | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const checkGitStatus = useCallback(
    async (immediate = false) => {
      if (!workspaceRoot) {
        setIsGitRepo(false)
        setCurrentBranch(null)
        setGitFileStatus(null)
        return
      }

      const doCheck = async () => {
        try {
          const isRepo = await window.api.git.isRepository(workspaceRoot)
          setIsGitRepo(isRepo)

          if (isRepo) {
            const [branch, status] = await Promise.all([
              window.api.git.getCurrentBranch(workspaceRoot),
              window.api.git.getStatus(workspaceRoot)
            ])
            setCurrentBranch(branch)
            setGitFileStatus(status)
          } else {
            setCurrentBranch(null)
            setGitFileStatus(null)
          }
        } catch (error) {
          console.error('Failed to check git status:', error)
          setIsGitRepo(false)
          setCurrentBranch(null)
          setGitFileStatus(null)
        }
      }

      // 立即执行（如初始化、用户主动操作）
      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        await doCheck()
      } else {
        // 防抖执行（如文件保存）
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(doCheck, 500)
      }
    },
    [workspaceRoot]
  )

  useEffect(() => {
    checkGitStatus(true) // 立即检查

    if (workspaceRoot) {
      const interval = setInterval(() => checkGitStatus(true), 5000) // 定期检查
      return () => {
        clearInterval(interval)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
      }
    }

    return undefined
  }, [workspaceRoot, checkGitStatus])

  const pull = useCallback(async () => {
    if (!workspaceRoot) return
    try {
      await window.api.git.pull(workspaceRoot, 'origin')
      await checkGitStatus(true) // 立即检查
      toast.success('拉取成功')
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('拉取失败', { description: message })
    }
  }, [workspaceRoot, checkGitStatus])

  const fetch = useCallback(async () => {
    if (!workspaceRoot) return
    try {
      await window.api.git.fetch(workspaceRoot, 'origin')
      toast.success('获取成功')
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('获取失败', { description: message })
    }
  }, [workspaceRoot])

  const checkoutBranch = useCallback(
    async (branchName: string) => {
      if (!workspaceRoot) return
      try {
        await window.api.git.checkoutBranch(workspaceRoot, branchName)
        await checkGitStatus(true) // 立即检查
        toast.success('切换分支成功', { description: `已切换到分支 ${branchName}` })
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        toast.error('切换分支失败', { description: message })
      }
    },
    [workspaceRoot, checkGitStatus]
  )

  return {
    isGitRepo,
    currentBranch,
    gitFileStatus,
    checkGitStatus,
    pull,
    fetch,
    checkoutBranch
  }
}
