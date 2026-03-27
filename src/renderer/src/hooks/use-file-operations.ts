import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { useFileStore, getTabId, getPathFromTabId } from '@/stores/file.store'
import { getLanguageFromFileName, isImageFile } from '@/utils/file-helpers'
import type { FileTab } from '@/types/ide'

// 检测行尾符的工具函数
const detectLineEnding = (text: string): 'LF' | 'CRLF' | 'CR' => {
  if (text.includes('\r\n')) return 'CRLF'
  if (text.includes('\n')) return 'LF'
  if (text.includes('\r')) return 'CR'
  return 'LF' // 默认
}

interface UseFileOperationsProps {
  workspaceRoot: string | null
}

/**
 * 文件操作 Hook
 * 处理文件的打开、保存、关闭等复杂操作逻辑
 * 状态管理由 useFileStore 负责
 */
export function useFileOperations({ workspaceRoot }: UseFileOperationsProps) {
  const { t } = useTranslation()
  // ✅ 从 Zustand Store 获取状态和操作
  const openFiles = useFileStore((state) => state.openFiles)
  const activeFile = useFileStore((state) => state.activeFile)
  const addFile = useFileStore((state) => state.addFile)
  const updateFile = useFileStore((state) => state.updateFile)
  const setOpenFiles = useFileStore((state) => state.setOpenFiles)
  const setActiveFile = useFileStore((state) => state.setActiveFile)
  const setSavingFile = useFileStore((state) => state.setSavingFile)
  const markFileAsSaved = useFileStore((state) => state.markFileAsSaved)
  const updateFileEncoding = useFileStore((state) => state.updateFileEncoding)

  /**
   * 打开文件 - 处理各种打开模式
   */
  const openFile = useCallback(
    async (
      path: string,
      options?: {
        isDeleted?: boolean
        showDiff?: boolean
        showConflict?: boolean
        stashIndex?: number
        stashMessage?: string
        baseBranch?: string
        compareBranch?: string
        commitHash?: string
        isPreview?: boolean
      }
    ) => {
      // 生成 tab 的唯一标识
      const isStashDiff = options?.stashIndex !== undefined
      const isBranchCompare = options?.baseBranch && options?.compareBranch
      const isCommitDiff = !!options?.commitHash
      const isConflict = !!options?.showConflict
      const tabId = isConflict
        ? `${path}:conflict`
        : isStashDiff
          ? `${path}:stash:${options.stashIndex}`
          : isBranchCompare
            ? `${path}:compare:${options.baseBranch}:${options.compareBranch}`
            : isCommitDiff
              ? `${path}:commit:${options.commitHash}`
              : options?.showDiff
                ? `${path}:diff`
                : path

      // 如果文件已打开（同一模式），直接激活
      const existingFile = openFiles.find((f) => getTabId(f) === tabId)
      if (existingFile) {
        if (options?.isDeleted && !existingFile.isDeleted) {
          updateFile(tabId, { isDeleted: true })
        }
        // 如果当前是预览模式，但要永久打开（isPreview 为 false 或 undefined），则转换为永久模式
        if (existingFile.isPreview && !options?.isPreview) {
          updateFile(tabId, { isPreview: false })
        }
        setActiveFile(tabId)
        return
      }

      try {
        const name = path.split('/').pop() || 'untitled'
        const language = getLanguageFromFileName(name)
        const isImage = isImageFile(name)

        if (isImage) {
          // 图片文件直接打开（图片不支持预览模式）
          const newFile: FileTab = {
            path,
            name,
            content: '',
            language,
            isDirty: false,
            encoding: 'UTF-8',
            lineEnding: 'LF',
            isPreview: false
          }
          addFile(newFile)
          if (workspaceRoot) {
            window.api.recentFiles.add(workspaceRoot, path).catch(() => {})
          }
          return
        }

        let content: string
        let originalContent: string | undefined
        let oursContent: string | undefined
        let theirsContent: string | undefined
        let baseContent: string | undefined
        let oursBranch: string | undefined
        let theirsBranch: string | undefined
        let detectedEncoding = 'UTF-8'

        // 根据不同模式读取文件内容
        if (isConflict && workspaceRoot) {
          const relativePath = path.startsWith(workspaceRoot)
            ? path.slice(workspaceRoot.length + 1)
            : path
          const conflictVersions = await window.api.git.getConflictVersions(
            workspaceRoot,
            relativePath
          )
          oursContent = conflictVersions.ours
          theirsContent = conflictVersions.theirs
          baseContent = conflictVersions.base
          oursBranch = conflictVersions.oursBranch
          theirsBranch = conflictVersions.theirsBranch
          content = conflictVersions.current
        } else if (isBranchCompare && workspaceRoot) {
          const relativePath = path.startsWith(workspaceRoot)
            ? path.slice(workspaceRoot.length + 1)
            : path
          const result = await window.api.git.getBranchFileDiff(
            workspaceRoot,
            options!.baseBranch!,
            options!.compareBranch!,
            relativePath
          )
          originalContent = result.baseContent
          content = result.compareContent
        } else if (isCommitDiff && workspaceRoot) {
          const relativePath = path.startsWith(workspaceRoot)
            ? path.slice(workspaceRoot.length + 1)
            : path
          const result = await window.api.git.getCommitFileDiff(
            workspaceRoot,
            options!.commitHash!,
            relativePath
          )
          originalContent = result.before
          content = result.after
        } else if (isStashDiff && workspaceRoot) {
          const relativePath = path.startsWith(workspaceRoot)
            ? path.slice(workspaceRoot.length + 1)
            : path
          originalContent = await window.api.git.stashGetFileContent(
            workspaceRoot,
            options!.stashIndex!,
            relativePath
          )
          try {
            detectedEncoding = await window.api.files.detectEncoding(path)
            content =
              detectedEncoding !== 'UTF-8'
                ? await window.api.files.readWithEncoding(path, detectedEncoding)
                : await window.api.files.read(path)
          } catch {
            content = ''
          }
        } else if (options?.isDeleted && workspaceRoot) {
          originalContent = await window.api.git.getFileFromHead(workspaceRoot, path)
          content = ''
        } else {
          const exists = await window.api.files.exists(path)
          if (!exists) {
            console.warn(`文件不存在，跳过打开: ${path}`)
            return
          }

          detectedEncoding = await window.api.files.detectEncoding(path)
          content =
            detectedEncoding !== 'UTF-8'
              ? await window.api.files.readWithEncoding(path, detectedEncoding)
              : await window.api.files.read(path)

          if (options?.showDiff && workspaceRoot) {
            try {
              originalContent = await window.api.git.getFileFromHead(workspaceRoot, path)
            } catch {
              // 忽略错误
            }
          }
        }

        // 只有普通文件（非特殊模式）才支持预览模式
        const isSpecialMode =
          options?.showDiff ||
          isStashDiff ||
          isBranchCompare ||
          isCommitDiff ||
          isConflict ||
          options?.isDeleted

        const newFile: FileTab = {
          path,
          name,
          content,
          language,
          isDirty: false,
          isDeleted: options?.isDeleted,
          encoding: detectedEncoding,
          lineEnding: detectLineEnding(content),
          isPreview: isSpecialMode ? false : (options?.isPreview ?? false),
          originalContent,
          showDiff: options?.showDiff || isStashDiff || !!isBranchCompare || isCommitDiff,
          stashIndex: options?.stashIndex,
          stashMessage: options?.stashMessage,
          baseBranch: options?.baseBranch,
          compareBranch: options?.compareBranch,
          commitHash: options?.commitHash,
          showConflict: isConflict,
          oursContent,
          theirsContent,
          baseContent,
          oursBranch,
          theirsBranch
        }

        addFile(newFile)
        if (workspaceRoot && !options?.isDeleted && !options?.showDiff) {
          window.api.recentFiles.add(workspaceRoot, path).catch(() => {})
        }
      } catch (error) {
        console.error('Failed to open file:', error)
        toast.error(t('editor.toast_open_failed'), {
          description: error instanceof Error ? error.message : t('errors.unknown_error')
        })
      }
    },
    [openFiles, workspaceRoot, addFile, updateFile, setActiveFile, t]
  )

  /**
   * 关闭其他文件
   */
  const closeOthers = useCallback(
    (tabId: string) => {
      const fileToKeep = openFiles.find((f) => getTabId(f) === tabId)
      if (fileToKeep) {
        setOpenFiles([fileToKeep])
        setActiveFile(tabId)
      }
    },
    [openFiles, setOpenFiles, setActiveFile]
  )

  /**
   * 关闭右侧文件
   */
  const closeToRight = useCallback(
    (tabId: string) => {
      const fileIndex = openFiles.findIndex((f) => getTabId(f) === tabId)
      if (fileIndex === -1) return

      const newOpenFiles = openFiles.slice(0, fileIndex + 1)
      setOpenFiles(newOpenFiles)

      if (!newOpenFiles.some((f) => getTabId(f) === activeFile)) {
        setActiveFile(getTabId(newOpenFiles[newOpenFiles.length - 1]))
      }
    },
    [openFiles, activeFile, setOpenFiles, setActiveFile]
  )

  /**
   * 保存文件
   */
  const saveFile = useCallback(
    async (tabId: string, content?: string, onSuccess?: () => void) => {
      const path = getPathFromTabId(tabId)
      const file = openFiles.find((f) => f.path === path && !f.showDiff)
      if (!file) {
        console.warn(`[FileOperations] Attempted to save non-existent or diff file: ${tabId}`)
        return
      }

      const contentToSave = content !== undefined ? content : file.content
      const encoding = file.encoding || 'UTF-8'

      try {
        setSavingFile(tabId)

        if (encoding !== 'UTF-8') {
          await window.api.files.writeWithEncoding(path, contentToSave, encoding)
        } else {
          await window.api.files.write(path, contentToSave)
        }

        markFileAsSaved(tabId, contentToSave)
        setTimeout(() => setSavingFile(null), 500)
        onSuccess?.()
      } catch (error) {
        console.error('Failed to save file:', error)
        toast.error(t('editor.toast_save_failed'), {
          description: error instanceof Error ? error.message : t('errors.unknown_error')
        })
        setSavingFile(null)
      }
    },
    [openFiles, setSavingFile, markFileAsSaved, t]
  )

  /**
   * 重新加载文件
   */
  const reloadFile = useCallback(
    async (tabId: string) => {
      const path = getPathFromTabId(tabId)
      try {
        const file = openFiles.find((f) => f.path === path && !f.showDiff)
        if (!file || file.isDeleted) return

        const exists = await window.api.files.exists(path)
        if (!exists) {
          console.warn('[FileOperations] File not found, marking as deleted:', path)
          updateFile(tabId, { isDeleted: true })
          return
        }

        const encoding = file.encoding || 'UTF-8'
        const content =
          encoding !== 'UTF-8'
            ? await window.api.files.readWithEncoding(path, encoding)
            : await window.api.files.read(path)

        updateFile(tabId, { content, isDirty: false })
      } catch (error) {
        console.error('Failed to reload file:', error)
      }
    },
    [openFiles, updateFile]
  )

  /**
   * 用指定编码重新打开文件
   */
  const reopenFileWithEncoding = useCallback(
    async (tabId: string, encoding: string) => {
      const path = getPathFromTabId(tabId)
      try {
        const content = await window.api.files.readWithEncoding(path, encoding)
        updateFileEncoding(tabId, encoding)
        updateFile(tabId, {
          content,
          encoding,
          lineEnding: detectLineEnding(content),
          isDirty: true
        })
      } catch (error) {
        console.error('Failed to reopen file with encoding:', error)
        throw error
      }
    },
    [updateFileEncoding, updateFile]
  )

  /**
   * 设置文件保存时使用的编码
   */
  const setFileSaveEncoding = useCallback(
    (tabId: string, encoding: string) => {
      updateFileEncoding(tabId, encoding)
      updateFile(tabId, { isDirty: true })
    },
    [updateFileEncoding, updateFile]
  )

  /**
   * 恢复文件列表
   */
  const restoreFiles = useCallback(
    async (filePaths: string[], projectRoot?: string) => {
      const filesToRestore: FileTab[] = []
      const rootToCheck = projectRoot || workspaceRoot

      for (const path of filePaths) {
        if (!rootToCheck || !path.startsWith(rootToCheck)) {
          console.warn(`Skipping file not in project: ${path}`)
          continue
        }

        try {
          const content = await window.api.files.read(path)
          const name = path.split('/').pop() || ''
          const language = getLanguageFromFileName(name)

          filesToRestore.push({
            path,
            name,
            content,
            language,
            isDirty: false
          })
        } catch (error) {
          console.error(`Failed to restore file ${path}:`, error)
        }
      }

      if (filesToRestore.length > 0) {
        console.log(`✅ Restored ${filesToRestore.length} files`)
        setOpenFiles(filesToRestore)
      } else {
        console.log('ℹ️ No files to restore')
      }
    },
    [workspaceRoot, setOpenFiles]
  )

  return {
    openFile,
    closeOthers,
    closeToRight,
    saveFile,
    reloadFile,
    reopenFileWithEncoding,
    setFileSaveEncoding,
    restoreFiles
  }
}
