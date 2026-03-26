import { useCallback } from 'react'
import { useFileStore, getTabId } from '@/stores/file.store'
import { useFileOperations } from './use-file-operations'
import type { FileManager } from '@/types/ide'

/**
 * 文件管理器 Hook
 *
 * 架构重构（优化后）：
 * - 状态管理：useFileStore (Zustand)
 * - 操作逻辑：useFileOperations
 * - 本 Hook：组合两者，提供统一的 FileManager 接口
 *
 * 最佳实践：
 * - ✅ 使用 useCallback 而不是 useMemo 返回函数
 * - ✅ 复用 getTabId 而不是重复实现
 * - ✅ 不使用无意义的 useMemo 优化对象创建
 */
export function useFileManager(workspaceRoot: string | null): FileManager {
  // ✅ 从 Zustand Store 获取状态
  const openFiles = useFileStore((state) => state.openFiles)
  const activeFile = useFileStore((state) => state.activeFile)
  const savingFile = useFileStore((state) => state.savingFile)

  // ✅ 从 Store 获取基础操作
  const setActiveFile = useFileStore((state) => state.setActiveFile)
  const removeFile = useFileStore((state) => state.removeFile)
  const clearAllFiles = useFileStore((state) => state.clearAllFiles)
  const updateFileContent = useFileStore((state) => state.updateFileContent)
  const reorderTabs = useFileStore((state) => state.reorderTabs)
  const updateFileGitStatus = useFileStore((state) => state.updateFileGitStatus)
  const updateFileEncoding = useFileStore((state) => state.updateFileEncoding)
  const updateFileLineEnding = useFileStore((state) => state.updateFileLineEnding)
  const markFileAsDeleted = useFileStore((state) => state.markFileAsDeleted)
  const clearFileDeletedStatus = useFileStore((state) => state.clearFileDeletedStatus)
  const updateFilePathAfterRename = useFileStore((state) => state.updateFile)
  const convertAllPreviewToPermanent = useFileStore((state) => state.convertAllPreviewToPermanent)

  // ✅ 从 Operations 获取复杂操作
  const operations = useFileOperations({ workspaceRoot })

  // ✅ 正确：使用 useCallback 返回函数
  const getCurrentFile = useCallback(() => {
    if (!activeFile) return null

    // ✅ 使用 getTabId 而不是重复实现
    const file = openFiles.find((f) => getTabId(f) === activeFile)
    if (!file) return null

    // Diff 视图（非 stash、非分支比较、非 commit diff）：如果同路径的普通文件有更新，使用其最新内容
    if (file.showDiff && file.stashIndex === undefined && !file.baseBranch && !file.commitHash) {
      const normalFile = openFiles.find((f) => f.path === file.path && !f.showDiff)
      if (normalFile && normalFile.content !== file.content) {
        return { ...file, content: normalFile.content }
      }
    }

    return file
  }, [activeFile, openFiles])

  // ✅ 正确：使用 useCallback
  const removeDeletedFiles = useCallback(
    (deletedPath: string) => {
      const newOpenFiles = openFiles.filter((f) => !f.path.startsWith(deletedPath))
      if (activeFile?.startsWith(deletedPath)) {
        setActiveFile(newOpenFiles[0] ? newOpenFiles[0].path : null)
      }
      useFileStore.setState({ openFiles: newOpenFiles })
    },
    [openFiles, activeFile, setActiveFile]
  )

  // ✅ 正确：使用 useCallback + getTabId
  const updateFilePathAfterRenameWrapper = useCallback(
    (oldPath: string, newPath: string, newName: string) => {
      openFiles.forEach((f) => {
        if (f.path === oldPath) {
          updateFilePathAfterRename(getTabId(f), { path: newPath, name: newName })
        }
      })
      if (activeFile === oldPath) {
        setActiveFile(newPath)
      }
    },
    [openFiles, activeFile, updateFilePathAfterRename, setActiveFile]
  )

  // ✅ 不使用 useMemo：对象创建很便宜，不需要优化
  return {
    openFiles,
    activeFile,
    savingFile,
    setActiveFile,
    openFile: operations.openFile,
    closeFile: removeFile,
    closeOthers: operations.closeOthers,
    closeToRight: operations.closeToRight,
    closeAll: clearAllFiles,
    saveFile: operations.saveFile,
    updateContent: updateFileContent,
    reloadFile: operations.reloadFile,
    updateFilePathAfterRename: updateFilePathAfterRenameWrapper,
    markFileAsDeleted,
    clearFileDeletedStatus,
    removeDeletedFiles,
    clearAllFiles,
    restoreFiles: operations.restoreFiles,
    updateFileGitStatus,
    updateFileEncoding,
    updateFileLineEnding,
    reopenFileWithEncoding: operations.reopenFileWithEncoding,
    setFileSaveEncoding: operations.setFileSaveEncoding,
    reorderTabs,
    getCurrentFile,
    convertAllPreviewToPermanent
  }
}
