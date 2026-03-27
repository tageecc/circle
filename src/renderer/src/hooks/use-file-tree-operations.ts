import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { getFileNameFromPath } from '@/utils/file-helpers'
import { refreshGitStatus } from './use-git-manager'
import type { ClipboardItem, FileManager, ConfirmFunction } from '@/types/ide'

interface FileTreeOperationsProps {
  workspaceRoot: string | null
  fileManager: FileManager
  confirm: ConfirmFunction
  refreshFileTree: () => void
}

/**
 * 文件树操作 Hook
 * 封装文件和文件夹的 CRUD 操作及 Git 回滚
 */
export function useFileTreeOperations({
  workspaceRoot,
  fileManager,
  confirm,
  refreshFileTree
}: FileTreeOperationsProps) {
  const { t } = useTranslation()

  const createFile = async (parentPath: string, fileName: string) => {
    try {
      const filePath = `${parentPath}/${fileName}`
      await window.api.files.createFile(filePath, '')
      toast.success(t('file_tree.toast_file_created'), {
        description: t('file_tree.toast_file_created_desc', { name: fileName })
      })
      refreshFileTree() // ✅ 静默刷新，不显示 loading
      setTimeout(() => fileManager.openFile(filePath), 100)
    } catch (error) {
      toast.error(t('errors.create_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  const createFolder = async (parentPath: string, folderName: string) => {
    try {
      const folderPath = `${parentPath}/${folderName}`
      await window.api.files.createDirectory(folderPath)
      toast.success(t('file_tree.toast_folder_created'), {
        description: t('file_tree.toast_folder_created_desc', { name: folderName })
      })
      refreshFileTree() // ✅ 静默刷新，不显示 loading
    } catch (error) {
      toast.error(t('errors.create_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  const rename = async (oldPath: string, newName: string) => {
    try {
      const parentPath = oldPath.split('/').slice(0, -1).join('/')
      const newPath = `${parentPath}/${newName}`
      await window.api.files.rename(oldPath, newPath)
      fileManager.updateFilePathAfterRename(oldPath, newPath, newName)
      // 更新最近文件列表：移除旧路径，添加新路径
      if (workspaceRoot) {
        window.api.recentFiles.remove(workspaceRoot, oldPath).catch(() => {})
        window.api.recentFiles.add(workspaceRoot, newPath).catch(() => {})
      }
      toast.success(t('file_tree.toast_rename_ok'), {
        description: t('file_tree.toast_rename_ok_desc', {
          oldName: getFileNameFromPath(oldPath),
          newName
        })
      })
      refreshFileTree() // ✅ 静默刷新，不显示 loading
    } catch (error) {
      toast.error(t('errors.rename_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  const deleteFile = async (path: string) => {
    const name = getFileNameFromPath(path)

    const confirmed = await confirm({
      title: t('file_tree.confirm_delete_title'),
      description: t('file_tree.confirm_delete_desc', { name }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive'
    })

    if (confirmed) {
      try {
        await window.api.files.delete(path)
        fileManager.removeDeletedFiles(path)

        // 从最近文件列表中移除
        if (workspaceRoot) {
          window.api.recentFiles.remove(workspaceRoot, path).catch(() => {})
        }

        toast.success(t('file_tree.toast_deleted'), {
          description: t('file_tree.toast_deleted_desc', { name })
        })

        // ✅ 静默刷新：不显示 loading，FileTree 会平滑更新
        refreshFileTree()
      } catch (error) {
        toast.error(t('errors.delete_failed'), {
          description: error instanceof Error ? error.message : t('errors.unknown_error')
        })
      }
    }
  }

  const copy = (path: string, setClipboard: (item: ClipboardItem) => void) => {
    setClipboard({ path, type: 'copy' })
    toast.success(t('file_tree.toast_copied'), {
      description: t('file_tree.toast_copied_desc', { name: getFileNameFromPath(path) })
    })
  }

  const cut = (path: string, setClipboard: (item: ClipboardItem) => void) => {
    setClipboard({ path, type: 'cut' })
    toast.success(t('file_tree.toast_cut'), {
      description: t('file_tree.toast_cut_desc', { name: getFileNameFromPath(path) })
    })
  }

  const paste = async (
    targetPath: string,
    clipboard: ClipboardItem | null,
    clearClipboard: () => void
  ) => {
    if (!clipboard) return

    try {
      const sourceName = getFileNameFromPath(clipboard.path)
      const destPath = `${targetPath}/${sourceName}`

      if (clipboard.type === 'copy') {
        const content = await window.api.files.read(clipboard.path)
        await window.api.files.createFile(destPath, content)
        toast.success(t('file_tree.toast_paste_ok'), {
          description: t('file_tree.toast_paste_copied_desc', { name: sourceName })
        })
      } else {
        await window.api.files.rename(clipboard.path, destPath)
        fileManager.updateFilePathAfterRename(clipboard.path, destPath, sourceName)
        // 更新最近文件列表（剪切移动）
        if (workspaceRoot) {
          window.api.recentFiles.remove(workspaceRoot, clipboard.path).catch(() => {})
          window.api.recentFiles.add(workspaceRoot, destPath).catch(() => {})
        }
        toast.success(t('file_tree.toast_paste_ok'), {
          description: t('file_tree.toast_paste_moved_desc', { name: sourceName })
        })
        clearClipboard()
      }

      refreshFileTree()
    } catch (error) {
      toast.error(t('file_tree.toast_paste_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path)
    toast.success(t('file_tree.toast_path_copied'), { description: path })
  }

  const revealInFinder = async (path: string) => {
    try {
      await window.api.files.revealInFinder?.(path)
    } catch (error) {
      toast.error(t('file_tree.toast_reveal_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  const gitRevert = async (path: string) => {
    if (!workspaceRoot) return

    const confirmed = await confirm({
      title: t('file_tree.rollback_title'),
      description: t('file_tree.rollback_desc'),
      confirmText: t('file_tree.rollback_confirm'),
      cancelText: '取消',
      variant: 'destructive'
    })

    if (confirmed) {
      try {
        await window.api.git.discardFileChanges(workspaceRoot, path)
        toast.success(t('file_tree.toast_git_reverted'), { description: path })
        refreshFileTree()
        refreshGitStatus()
        // 如果文件已打开，重新加载
        if (fileManager.openFiles.some((f) => f.path === path)) {
          const content = await window.api.files.read(path)
          fileManager.updateContent(path, content)
        }
      } catch (error) {
        toast.error(t('file_tree.toast_git_revert_failed'), {
          description: error instanceof Error ? error.message : t('errors.unknown_error')
        })
      }
    }
  }

  /**
   * 移动文件或文件夹到目标目录
   */
  const move = async (sourcePath: string, targetDir: string) => {
    try {
      const sourceName = getFileNameFromPath(sourcePath)
      const destPath = `${targetDir}/${sourceName}`

      const exists = await window.api.files.exists(destPath)
      if (exists) {
        toast.error(t('file_tree.toast_move_failed'), {
          description: t('file_tree.toast_move_exists', { name: sourceName })
        })
        return
      }

      await window.api.files.rename(sourcePath, destPath)
      fileManager.updateFilePathAfterRename(sourcePath, destPath, sourceName)
      // 更新最近文件列表
      if (workspaceRoot) {
        window.api.recentFiles.remove(workspaceRoot, sourcePath).catch(() => {})
        window.api.recentFiles.add(workspaceRoot, destPath).catch(() => {})
      }
      refreshFileTree()
      refreshGitStatus()
    } catch (error) {
      toast.error(t('file_tree.toast_move_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }

  return {
    createFile,
    createFolder,
    rename,
    delete: deleteFile,
    copy,
    cut,
    paste,
    copyPath,
    revealInFinder,
    refresh: refreshFileTree,
    gitRevert,
    move
  }
}
