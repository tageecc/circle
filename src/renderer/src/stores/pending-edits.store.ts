import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PendingFileEdit } from '@/types/ide'
import { toast } from '@/components/ui/sonner'

// 缓存空数组，避免每次返回新引用
const EMPTY_EDITS: PendingFileEdit[] = []

// 导出供 hook 使用
export { EMPTY_EDITS }

const MAX_EDIT_SIZE = 5 * 1024 * 1024 // 单个编辑最大 5MB

interface PendingEditsState {
  editsByProject: Record<string, PendingFileEdit[]>

  addEdit: (projectPath: string, edit: PendingFileEdit) => void
  removeEdit: (projectPath: string, absolutePath: string) => void
  clearProject: (projectPath: string) => void
  clearSession: (projectPath: string, sessionId: string) => void
  getEdits: (projectPath: string) => PendingFileEdit[]
  getEditByPath: (projectPath: string, absolutePath: string) => PendingFileEdit | undefined
}

export const usePendingEditsStore = create<PendingEditsState>()(
  persist(
    (set, get) => ({
      editsByProject: {},

      addEdit: (projectPath, edit) => {
        set((state) => {
          const projectEdits = state.editsByProject[projectPath] || []

          // ✅ 检查文件大小（避免超出 localStorage 容量）
          const editSize = edit.oldContent.length + edit.newContent.length
          if (editSize > MAX_EDIT_SIZE) {
            toast.warning('文件过大，无法撤销', {
              description: `${edit.filePath} 超过 5MB，建议使用 Git 管理版本`
            })
            // 不保存到 pending edits，文件已经写入磁盘
            return state
          }

          // 避免重复添加
          const exists = projectEdits.some((e) => e.absolutePath === edit.absolutePath)
          if (exists) {
            // 更新现有记录
            return {
              editsByProject: {
                ...state.editsByProject,
                [projectPath]: projectEdits.map((e) =>
                  e.absolutePath === edit.absolutePath ? edit : e
                )
              }
            }
          }

          // 添加新记录
          return {
            editsByProject: {
              ...state.editsByProject,
              [projectPath]: [...projectEdits, edit]
            }
          }
        })
      },

      removeEdit: (projectPath, absolutePath) => {
        set((state) => {
          const projectEdits = state.editsByProject[projectPath] || []
          const filtered = projectEdits.filter((e) => e.absolutePath !== absolutePath)

          // 如果项目没有 edits 了，删除该项目的 key
          if (filtered.length === 0) {
            const { [projectPath]: _, ...rest } = state.editsByProject
            return { editsByProject: rest }
          }

          return {
            editsByProject: {
              ...state.editsByProject,
              [projectPath]: filtered
            }
          }
        })
      },

      clearProject: (projectPath) => {
        set((state) => {
          const { [projectPath]: _, ...rest } = state.editsByProject
          return { editsByProject: rest }
        })
      },

      clearSession: (projectPath, sessionId) => {
        set((state) => {
          const projectEdits = state.editsByProject[projectPath] || []
          const filtered = projectEdits.filter((e) => e.sessionId !== sessionId)

          if (filtered.length === 0) {
            const { [projectPath]: _, ...rest } = state.editsByProject
            return { editsByProject: rest }
          }

          return {
            editsByProject: {
              ...state.editsByProject,
              [projectPath]: filtered
            }
          }
        })
      },

      getEdits: (projectPath) => {
        return get().editsByProject[projectPath] || EMPTY_EDITS
      },

      getEditByPath: (projectPath, absolutePath) => {
        const projectEdits = get().editsByProject[projectPath]
        return projectEdits?.find((e) => e.absolutePath === absolutePath)
      }
    }),
    {
      name: 'circle-pending-edits',
      version: 1
    }
  )
)
