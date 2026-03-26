import { useCallback } from 'react'
import { usePendingEditsStore, EMPTY_EDITS } from '@/stores/pending-edits.store'
import { PendingFileEdit } from '@/types/ide'
import { toast } from '@/components/ui/sonner'

/**
 * Hook: 管理 AI 编辑的文件变更
 * - 使用 Zustand 选择器，只订阅当前项目
 * - 自动持久化到 localStorage
 */
export function usePendingEdits(workspaceRoot: string | null) {
  // 选择器只订阅当前项目的数据，避免其他项目更新触发重渲染
  const edits = usePendingEditsStore((state) =>
    workspaceRoot ? state.editsByProject[workspaceRoot] || EMPTY_EDITS : EMPTY_EDITS
  )

  const hasEdits = edits.length > 0

  // 添加 edit
  const addEdit = useCallback(
    (edit: PendingFileEdit) => {
      if (!workspaceRoot) return
      usePendingEditsStore.getState().addEdit(workspaceRoot, edit)
    },
    [workspaceRoot]
  )

  // 接受更改（Keep）
  const acceptEdit = useCallback(
    async (absolutePath: string) => {
      if (!workspaceRoot) return

      const store = usePendingEditsStore.getState()
      const edit = store.getEditByPath(workspaceRoot, absolutePath)
      if (!edit) {
        console.warn(`Edit not found for: ${absolutePath}`)
        return
      }

      try {
        // 移除状态（文件已经写入磁盘，只需清理前端状态）
        store.removeEdit(workspaceRoot, absolutePath)
      } catch (error) {
        console.error('Failed to accept edit:', error)
        toast.error('操作失败')
        throw error
      }
    },
    [workspaceRoot]
  )

  // 拒绝更改（Undo）
  const rejectEdit = useCallback(
    async (absolutePath: string, options?: { silent?: boolean; fileManager?: any }) => {
      if (!workspaceRoot) return

      const store = usePendingEditsStore.getState()
      const edit = store.getEditByPath(workspaceRoot, absolutePath)
      if (!edit) {
        console.warn(`Edit not found for: ${absolutePath}`)
        // 即使找不到 edit，也返回成功，避免报错
        return
      }

      try {
        // 统一的撤销逻辑：基于数据而非类型
        if (edit.oldContent) {
          // 有原内容 → 恢复文件（适用于编辑、清空和删除）
          await window.api.files.write(edit.absolutePath, edit.oldContent)

          // 如果是删除操作，清除文件 tab 的 isDeleted 状态
          if (edit.toolName === 'delete_file' && options?.fileManager) {
            options.fileManager.clearFileDeletedStatus(edit.filePath)
          }
        } else {
          // 无原内容 → 删除文件（适用于新建）
          try {
            await window.api.files.delete(edit.absolutePath)
          } catch (err) {
            console.warn(`Failed to delete file: ${edit.absolutePath}`, err)
          }
        }

        // 移除状态
        store.removeEdit(workspaceRoot, absolutePath)
      } catch (error) {
        console.error('Failed to reject edit:', error)
        if (!options?.silent) {
          toast.error('撤销失败')
        }
        throw error
      }
    },
    [workspaceRoot]
  )

  // 接受所有更改
  const acceptAll = useCallback(
    async (sessionId?: string) => {
      if (!workspaceRoot) return

      const editsToAccept = sessionId ? edits.filter((e) => e.sessionId === sessionId) : edits

      if (editsToAccept.length === 0) return

      try {
        // 清理前端状态（文件已经写入磁盘）
        const store = usePendingEditsStore.getState()
        if (sessionId) {
          store.clearSession(workspaceRoot, sessionId)
        } else {
          store.clearProject(workspaceRoot)
        }
      } catch (error) {
        console.error('Failed to accept all edits:', error)
        toast.error('操作失败')
        throw error
      }
    },
    [workspaceRoot, edits]
  )

  // 拒绝所有更改
  const rejectAll = useCallback(
    async (sessionId?: string, options?: { silent?: boolean; fileManager?: any }) => {
      if (!workspaceRoot) return

      const editsToReject = sessionId ? edits.filter((e) => e.sessionId === sessionId) : edits

      if (editsToReject.length === 0) return

      try {
        for (const edit of editsToReject) {
          // 统一的撤销逻辑：基于数据而非类型
          if (edit.oldContent) {
            // 有原内容 → 恢复文件（适用于编辑和删除）
            await window.api.files.write(edit.absolutePath, edit.oldContent)

            // 如果是删除操作，清除文件 tab 的 isDeleted 状态
            if (edit.toolName === 'delete_file' && options?.fileManager) {
              options.fileManager.clearFileDeletedStatus(edit.filePath)
            }
          } else {
            // 无原内容 → 删除文件（适用于新建）
            try {
              await window.api.files.delete(edit.absolutePath)
            } catch (err) {
              console.warn(`Failed to delete file: ${edit.absolutePath}`, err)
            }
          }
        }

        // 清理前端状态
        const store = usePendingEditsStore.getState()
        if (sessionId) {
          store.clearSession(workspaceRoot, sessionId)
        } else {
          store.clearProject(workspaceRoot)
        }

        if (!options?.silent) {
          toast.info('已撤销所有修改')
        }
      } catch (error) {
        console.error('Failed to reject all edits:', error)
        if (!options?.silent) {
          toast.error('操作失败')
        }
        throw error
      }
    },
    [workspaceRoot, edits]
  )

  // 清理项目的所有 edits
  const clearProject = useCallback(() => {
    if (!workspaceRoot) return
    usePendingEditsStore.getState().clearProject(workspaceRoot)
  }, [workspaceRoot])

  return {
    edits,
    hasEdits,
    addEdit,
    acceptEdit,
    rejectEdit,
    acceptAll,
    rejectAll,
    clearProject,
    // 暴露 store 方法供特殊场景使用
    getEditByPath: (absolutePath: string) =>
      workspaceRoot
        ? usePendingEditsStore.getState().getEditByPath(workspaceRoot, absolutePath)
        : undefined
  }
}
