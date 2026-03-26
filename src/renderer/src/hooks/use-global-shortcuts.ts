import { useEffect, useRef } from 'react'
import { refreshGitStatus } from './use-git-manager'
import type { FileManager } from '@/types/ide'

interface UseGlobalShortcutsProps {
  fileManager: FileManager
  openQuickOpen: () => void
}

export function useGlobalShortcuts({ fileManager, openQuickOpen }: UseGlobalShortcutsProps) {
  // 使用 ref 避免每次 fileManager 更新时重新注册事件监听
  const fileManagerRef = useRef(fileManager)
  const openQuickOpenRef = useRef(openQuickOpen)

  // 保持 ref 最新
  useEffect(() => {
    fileManagerRef.current = fileManager
    openQuickOpenRef.current = openQuickOpen
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S / Ctrl+S 保存
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const manager = fileManagerRef.current
        if (manager.activeFile) {
          manager.saveFile(manager.activeFile, undefined, () => refreshGitStatus())
        }
      }

      // Cmd+P / Ctrl+P 快速打开文件
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        openQuickOpenRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // 空依赖数组，只注册一次
}
