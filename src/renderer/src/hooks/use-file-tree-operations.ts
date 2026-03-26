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
  const createFile = async (parentPath: string, fileName: string) => {
    try {
      const filePath = `${parentPath}/${fileName}`
      await window.api.files.createFile(filePath, '')
      toast.success('文件创建成功', { description: `已创建文件 ${fileName}` })
      refreshFileTree() // ✅ 静默刷新，不显示 loading
      setTimeout(() => fileManager.openFile(filePath), 100)
    } catch (error) {
      toast.error('文件创建失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  const createFolder = async (parentPath: string, folderName: string) => {
    try {
      const folderPath = `${parentPath}/${folderName}`
      await window.api.files.createDirectory(folderPath)
      toast.success('文件夹创建成功', { description: `已创建文件夹 ${folderName}` })
      refreshFileTree() // ✅ 静默刷新，不显示 loading
    } catch (error) {
      toast.error('文件夹创建失败', {
        description: error instanceof Error ? error.message : '未知错误'
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
      toast.success('重命名成功', {
        description: `已将 ${getFileNameFromPath(oldPath)} 重命名为 ${newName}`
      })
      refreshFileTree() // ✅ 静默刷新，不显示 loading
    } catch (error) {
      toast.error('重命名失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  const deleteFile = async (path: string) => {
    const name = getFileNameFromPath(path)

    const confirmed = await confirm({
      title: '确认删除',
      description: `确定要删除"${name}"吗？此操作不可撤销。`,
      confirmText: '删除',
      cancelText: '取消',
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

        toast.success('删除成功', { description: `已删除 ${name}` })

        // ✅ 静默刷新：不显示 loading，FileTree 会平滑更新
        refreshFileTree()
      } catch (error) {
        toast.error('删除失败', {
          description: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
  }

  const copy = (path: string, setClipboard: (item: ClipboardItem) => void) => {
    setClipboard({ path, type: 'copy' })
    toast.success('已复制', { description: `已复制 ${getFileNameFromPath(path)}` })
  }

  const cut = (path: string, setClipboard: (item: ClipboardItem) => void) => {
    setClipboard({ path, type: 'cut' })
    toast.success('已剪切', { description: `已剪切 ${getFileNameFromPath(path)}` })
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
        toast.success('粘贴成功', { description: `已复制 ${sourceName}` })
      } else {
        await window.api.files.rename(clipboard.path, destPath)
        fileManager.updateFilePathAfterRename(clipboard.path, destPath, sourceName)
        // 更新最近文件列表（剪切移动）
        if (workspaceRoot) {
          window.api.recentFiles.remove(workspaceRoot, clipboard.path).catch(() => {})
          window.api.recentFiles.add(workspaceRoot, destPath).catch(() => {})
        }
        toast.success('粘贴成功', { description: `已移动 ${sourceName}` })
        clearClipboard()
      }

      refreshFileTree()
    } catch (error) {
      toast.error('粘贴失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path)
    toast.success('已复制路径', { description: path })
  }

  const revealInFinder = async (path: string) => {
    try {
      await window.api.files.revealInFinder?.(path)
    } catch (error) {
      toast.error('无法打开文件管理器', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  const gitRevert = async (path: string) => {
    if (!workspaceRoot) return

    const confirmed = await confirm({
      title: '回滚文件',
      description: '确定要回滚此文件的更改吗？所有未提交的更改将会丢失，此操作不可撤销。',
      confirmText: '回滚',
      cancelText: '取消',
      variant: 'destructive'
    })

    if (confirmed) {
      try {
        await window.api.git.discardFileChanges(workspaceRoot, path)
        toast.success('文件已回滚', { description: path })
        refreshFileTree()
        refreshGitStatus()
        // 如果文件已打开，重新加载
        if (fileManager.openFiles.some((f) => f.path === path)) {
          const content = await window.api.files.read(path)
          fileManager.updateContent(path, content)
        }
      } catch (error) {
        toast.error('回滚失败', {
          description: error instanceof Error ? error.message : '未知错误'
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
        toast.error('移动失败', {
          description: `目标位置已存在同名文件: ${sourceName}`
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
      toast.error('移动失败', {
        description: error instanceof Error ? error.message : '未知错误'
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
