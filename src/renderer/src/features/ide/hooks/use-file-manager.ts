import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { FileTab, GitStatus } from '../types'
import { getLanguageFromFileName, isImageFile } from '../utils/file-helpers'

export function useFileManager(workspaceRoot: string | null) {
  const [openFiles, setOpenFiles] = useState<FileTab[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [savingFile, setSavingFile] = useState<string | null>(null)

  const openFile = useCallback(
    async (path: string) => {
      if (openFiles.find((f) => f.path === path)) {
        setActiveFile(path)
        return
      }

      try {
        const name = path.split('/').pop() || 'untitled'
        const language = getLanguageFromFileName(name)
        const isImage = isImageFile(name)
        const content = isImage ? '' : await window.api.files.read(path)

        const newFile: FileTab = {
          path,
          name,
          content,
          language,
          isDirty: false
        }

        setOpenFiles((prev) => [...prev, newFile])
        setActiveFile(path)
      } catch (error) {
        console.error('Failed to open file:', error)
        toast.error('无法打开文件', {
          description: error instanceof Error ? error.message : '未知错误'
        })
      }
    },
    [openFiles]
  )

  const closeFile = useCallback(
    (path: string) => {
      const fileIndex = openFiles.findIndex((f) => f.path === path)
      if (fileIndex === -1) return

      const newOpenFiles = openFiles.filter((f) => f.path !== path)
      setOpenFiles(newOpenFiles)

      if (activeFile === path) {
        if (newOpenFiles.length > 0) {
          const nextFile = newOpenFiles[fileIndex] || newOpenFiles[fileIndex - 1]
          setActiveFile(nextFile.path)
        } else {
          setActiveFile(null)
        }
      }
    },
    [openFiles, activeFile]
  )

  const closeOthers = useCallback(
    (path: string) => {
      const fileToKeep = openFiles.find((f) => f.path === path)
      if (fileToKeep) {
        setOpenFiles([fileToKeep])
        setActiveFile(path)
      }
    },
    [openFiles]
  )

  const closeToRight = useCallback(
    (path: string) => {
      const fileIndex = openFiles.findIndex((f) => f.path === path)
      if (fileIndex === -1) return

      const newOpenFiles = openFiles.slice(0, fileIndex + 1)
      setOpenFiles(newOpenFiles)

      if (!newOpenFiles.some((f) => f.path === activeFile)) {
        setActiveFile(newOpenFiles[newOpenFiles.length - 1].path)
      }
    },
    [openFiles, activeFile]
  )

  const closeAll = useCallback(() => {
    setOpenFiles([])
    setActiveFile(null)
  }, [])

  const saveFile = useCallback(
    async (path: string, content?: string, onSuccess?: () => void) => {
      const file = openFiles.find((f) => f.path === path)
      if (!file) {
        console.warn(`[FileManager] Attempted to save non-existent file: ${path}`)
        return
      }

      const contentToSave = content !== undefined ? content : file.content

      try {
        console.log(`[FileManager] Saving file: ${path}`)
        setSavingFile(path)
        await window.api.files.write(path, contentToSave)
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === path ? { ...f, content: contentToSave, isDirty: false } : f))
        )

        setTimeout(() => setSavingFile(null), 500)
        console.log(`[FileManager] File saved successfully: ${path}`)

        // 保存成功后触发回调（用于刷新Git状态）
        onSuccess?.()
      } catch (error) {
        console.error('Failed to save file:', error)
        toast.error('保存失败', {
          description: error instanceof Error ? error.message : '未知错误'
        })
        setSavingFile(null)
      }
    },
    [openFiles]
  )

  const updateContent = useCallback((path: string, content: string) => {
    setOpenFiles((prev) => {
      // 安全检查1：确保文件仍然打开
      const file = prev.find((f) => f.path === path)
      if (!file) {
        console.warn(`[FileManager] Attempted to update content for closed file: ${path}`)
        return prev
      }

      // 安全检查2：防止内容覆盖（如果内容相同则跳过）
      if (file.content === content) {
        return prev
      }

      console.log(`[FileManager] Updating content for: ${path}`)

      return prev.map((f) => (f.path === path ? { ...f, content, isDirty: true } : f))
    })
  }, [])

  const reloadFile = useCallback(async (path: string) => {
    try {
      const content = await window.api.files.read(path)
      setOpenFiles((prev) => {
        const file = prev.find((f) => f.path === path)
        if (!file) return prev

        return prev.map((f) => (f.path === path ? { ...f, content, isDirty: false } : f))
      })
    } catch (error) {
      console.error('Failed to reload file:', error)
    }
  }, [])

  const updateFilePathAfterRename = useCallback(
    (oldPath: string, newPath: string, newName: string) => {
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === oldPath ? { ...f, path: newPath, name: newName } : f))
      )
      if (activeFile === oldPath) {
        setActiveFile(newPath)
      }
    },
    [activeFile]
  )

  const markFileAsDeleted = useCallback((deletedPath: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path.startsWith(deletedPath) ? { ...f, isDeleted: true } : f))
    )
  }, [])

  const removeDeletedFiles = useCallback(
    (deletedPath: string) => {
      const newOpenFiles = openFiles.filter((f) => !f.path.startsWith(deletedPath))
      setOpenFiles(newOpenFiles)

      if (activeFile?.startsWith(deletedPath)) {
        setActiveFile(newOpenFiles[0]?.path || null)
      }
    },
    [openFiles, activeFile]
  )

  const clearAllFiles = useCallback(() => {
    setOpenFiles([])
    setActiveFile(null)
  }, [])

  const updateFileGitStatus = useCallback((path: string, gitStatus: GitStatus) => {
    setOpenFiles((prev) => prev.map((f) => (f.path === path ? { ...f, gitStatus } : f)))
  }, [])

  const updateFileErrorStatus = useCallback((path: string, hasErrors: boolean) => {
    setOpenFiles((prev) => prev.map((f) => (f.path === path ? { ...f, hasErrors } : f)))
  }, [])

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
    [workspaceRoot]
  )

  return {
    openFiles,
    activeFile,
    savingFile,
    setActiveFile,
    openFile,
    closeFile,
    closeOthers,
    closeToRight,
    closeAll,
    saveFile,
    updateContent,
    reloadFile,
    updateFilePathAfterRename,
    markFileAsDeleted,
    removeDeletedFiles,
    clearAllFiles,
    restoreFiles,
    updateFileGitStatus,
    updateFileErrorStatus
  }
}
