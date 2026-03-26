import { useEffect, useRef } from 'react'
import type { FileManager } from '@/types/ide'
import type { GitFileStatus, GitStatus } from '@/types/ide'

interface UseFileGitSyncProps {
  workspaceRoot: string | null
  gitFileStatus: GitFileStatus | null
  fileManager: FileManager
}

/**
 * 同步 Git 状态到打开的文件标签 - 重构版
 *
 * 优化要点：
 * 1. ✅ 使用 ref 避免依赖 fileManager 引起的重渲染
 * 2. ✅ 只在 gitFileStatus 真正变化时才同步
 * 3. ✅ 使用签名检测，避免重复更新
 * 4. ✅ 批量更新，减少 fileManager 调用次数
 */
export function useFileGitSync({ workspaceRoot, gitFileStatus, fileManager }: UseFileGitSyncProps) {
  const fileManagerRef = useRef(fileManager)
  const lastSyncSignatureRef = useRef<string>('')

  // 保持 fileManager 引用最新
  useEffect(() => {
    fileManagerRef.current = fileManager
  })

  useEffect(() => {
    if (!workspaceRoot || !gitFileStatus) {
      return
    }

    // ✅ 创建 Git 状态的签名（用于检测是否真正变化）- 简化版
    const createGitStatusSignature = (status: GitFileStatus): string => {
      return [
        (status.modified || []).sort().join(','),
        (status.added || []).sort().join(','),
        (status.deleted || []).sort().join(','),
        (status.untracked || []).sort().join(','),
        (status.conflicted || []).sort().join(','),
        (status.staged || []).sort().join(',')
      ].join(';')
    }

    const currentSignature = createGitStatusSignature(gitFileStatus)

    // ✅ 如果签名没变化，跳过同步（避免无效更新）
    if (currentSignature === lastSyncSignatureRef.current) {
      return
    }

    lastSyncSignatureRef.current = currentSignature

    // ✅ 构建 Git 状态映射（相对路径 -> Git 状态）
    const gitStatusMap = new Map<string, GitStatus>()

    // 添加空值检查，防止运行时错误
    if (gitFileStatus.conflicted) {
      gitFileStatus.conflicted.forEach((path) => gitStatusMap.set(path, 'conflicted'))
    }
    if (gitFileStatus.staged) {
      gitFileStatus.staged.forEach((path) => gitStatusMap.set(path, 'staged'))
    }
    if (gitFileStatus.deleted) {
      gitFileStatus.deleted.forEach((path) => gitStatusMap.set(path, 'deleted'))
    }
    if (gitFileStatus.modified) {
      gitFileStatus.modified.forEach((path) => gitStatusMap.set(path, 'modified'))
    }
    if (gitFileStatus.untracked) {
      gitFileStatus.untracked.forEach((path) => gitStatusMap.set(path, 'untracked'))
    }

    // ✅ 批量收集需要更新的文件
    const updates: Array<{ path: string; status: GitStatus | undefined }> = []

    fileManagerRef.current.openFiles.forEach((file) => {
      const relativePath = file.path.replace(workspaceRoot + '/', '')
      const newGitStatus = gitStatusMap.get(relativePath)

      // 只有状态真正变化时才记录更新
      if (file.gitStatus !== newGitStatus) {
        updates.push({ path: file.path, status: newGitStatus })
      }
    })

    // ✅ 批量更新（一次性更新所有文件，减少渲染次数）
    if (updates.length > 0) {
      updates.forEach(({ path, status }) => {
        fileManagerRef.current.updateFileGitStatus(path, status)
      })
    }
  }, [gitFileStatus, workspaceRoot])
}
