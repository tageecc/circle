import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import i18n from '@/i18n'
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
      toast.success(i18n.t('git:operations.pullSuccess'))
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('common:message.unknownError')
      toast.error(i18n.t('git:operations.pullFailed'), { description: message })
    }
  }, [workspaceRoot, checkGitStatus])

  const fetch = useCallback(async () => {
    if (!workspaceRoot) return
    try {
      await window.api.git.fetch(workspaceRoot, 'origin')
      toast.success(i18n.t('git:operations.fetchSuccess'))
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('common:message.unknownError')
      toast.error(i18n.t('git:operations.fetchFailed'), { description: message })
    }
  }, [workspaceRoot])

  const checkoutBranch = useCallback(
    async (branchName: string) => {
      if (!workspaceRoot) return
      try {
        await window.api.git.checkoutBranch(workspaceRoot, branchName)
        await checkGitStatus(true) // 立即检查
        toast.success(i18n.t('git:operations.checkoutSuccess'), {
          description: i18n.t('git:operations.checkoutSuccessDesc', { branch: branchName })
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : i18n.t('common:message.unknownError')
        toast.error(i18n.t('git:operations.checkoutFailed'), { description: message })
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
