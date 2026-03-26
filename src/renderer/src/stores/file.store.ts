import { create } from 'zustand'
import type { FileTab, GitStatus } from '@/types/ide'

interface FileState {
  // 文件状态
  openFiles: FileTab[]
  activeFile: string | null
  savingFile: string | null

  // 基础操作 - 简单的状态更新
  setActiveFile: (file: string | null) => void
  setSavingFile: (file: string | null) => void
  addFile: (file: FileTab) => void
  removeFile: (tabId: string) => void
  updateFile: (tabId: string, updates: Partial<FileTab>) => void
  setOpenFiles: (files: FileTab[]) => void
  clearAllFiles: () => void

  // 内容更新
  updateFileContent: (tabId: string, content: string) => void
  markFileAsSaved: (tabId: string, content: string) => void

  // Git 状态
  updateFileGitStatus: (path: string, status: GitStatus | undefined) => void

  // 编码和行尾符
  updateFileEncoding: (tabId: string, encoding: string) => void
  updateFileLineEnding: (tabId: string, lineEnding: 'LF' | 'CRLF' | 'CR') => void

  // 文件删除标记
  markFileAsDeleted: (path: string) => void
  clearFileDeletedStatus: (path: string) => void

  // 预览模式
  convertAllPreviewToPermanent: () => void

  // Tab 重排序
  reorderTabs: (fromIndex: number, toIndex: number) => void
}

// 辅助函数：获取 tab 的唯一标识
export const getTabId = (file: FileTab): string => {
  if (file.stashIndex !== undefined) {
    return `${file.path}:stash:${file.stashIndex}`
  }
  if (file.baseBranch && file.compareBranch) {
    return `${file.path}:compare:${file.baseBranch}:${file.compareBranch}`
  }
  if (file.commitHash) {
    return `${file.path}:commit:${file.commitHash}`
  }
  if (file.showConflict) {
    return `${file.path}:conflict`
  }
  return file.showDiff ? `${file.path}:diff` : file.path
}

// 辅助函数：从 tabId 中提取真实路径
export const getPathFromTabId = (tabId: string): string =>
  tabId
    .replace(/:diff$/, '')
    .replace(/:stash:\d+$/, '')
    .replace(/:compare:[^:]+:[^:]+$/, '')
    .replace(/:commit:[a-f0-9]+$/, '')
    .replace(/:conflict$/, '')

export const useFileStore = create<FileState>((set) => ({
  // 初始状态
  openFiles: [],
  activeFile: null,
  savingFile: null,

  // 基础操作
  setActiveFile: (file) => set({ activeFile: file }),

  setSavingFile: (file) => set({ savingFile: file }),

  addFile: (file) =>
    set((state) => {
      let newOpenFiles = [...state.openFiles]

      // 如果新文件是预览模式，先关闭所有现有的预览标签
      if (file.isPreview) {
        newOpenFiles = newOpenFiles.filter((f) => !f.isPreview)
      }

      return {
        openFiles: [...newOpenFiles, file],
        activeFile: getTabId(file)
      }
    }),

  removeFile: (tabId) =>
    set((state) => {
      const fileIndex = state.openFiles.findIndex((f) => getTabId(f) === tabId)
      if (fileIndex === -1) return state

      const newOpenFiles = state.openFiles.filter((f) => getTabId(f) !== tabId)
      let newActiveFile = state.activeFile

      // 如果关闭的是当前激活的文件，切换到相邻文件
      if (state.activeFile === tabId) {
        if (newOpenFiles.length > 0) {
          const nextFile = newOpenFiles[fileIndex] || newOpenFiles[fileIndex - 1]
          newActiveFile = getTabId(nextFile)
        } else {
          newActiveFile = null
        }
      }

      return { openFiles: newOpenFiles, activeFile: newActiveFile }
    }),

  updateFile: (tabId, updates) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) => (getTabId(f) === tabId ? { ...f, ...updates } : f))
    })),

  setOpenFiles: (files) => set({ openFiles: files }),

  clearAllFiles: () => set({ openFiles: [], activeFile: null }),

  // 内容更新
  updateFileContent: (tabId, content) => {
    const path = getPathFromTabId(tabId)
    set((state) => {
      // 查找非 diff 文件（diff 视图是只读的）
      const file = state.openFiles.find((f) => f.path === path && !f.showDiff)
      if (!file) {
        console.warn(`[FileStore] Attempted to update content for closed or diff file: ${tabId}`)
        return state
      }

      // 安全检查：防止内容覆盖（如果内容相同则跳过）
      if (file.content === content) {
        return state
      }

      console.log(`[FileStore] Updating content for: ${path}`)

      return {
        openFiles: state.openFiles.map((f) =>
          f.path === path && !f.showDiff
            ? { ...f, content, isDirty: true, isPreview: false } // 编辑时自动转为永久标签
            : f
        )
      }
    })
  },

  markFileAsSaved: (tabId, content) => {
    const path = getPathFromTabId(tabId)
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path && !f.showDiff ? { ...f, content, isDirty: false } : f
      )
    }))
  },

  // Git 状态
  updateFileGitStatus: (path, status) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) => (f.path === path ? { ...f, gitStatus: status } : f))
    })),

  // 编码和行尾符
  updateFileEncoding: (tabId, encoding) => {
    const path = getPathFromTabId(tabId)
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path && !f.showDiff ? { ...f, encoding } : f
      )
    }))
  },

  updateFileLineEnding: (tabId, lineEnding) => {
    const path = getPathFromTabId(tabId)
    set((state) => ({
      openFiles: state.openFiles.map((f) => {
        if (f.path === path && !f.showDiff) {
          // 转换内容中的行尾符
          let newContent = f.content
          const lineEndingMap = { LF: '\n', CRLF: '\r\n', CR: '\r' }
          const targetEnding = lineEndingMap[lineEnding]

          // 先统一为 LF，再转换为目标格式
          newContent = newContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          if (lineEnding !== 'LF') {
            newContent = newContent.replace(/\n/g, targetEnding)
          }

          return { ...f, content: newContent, lineEnding, isDirty: true }
        }
        return f
      })
    }))
  },

  // 文件删除标记
  markFileAsDeleted: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path.startsWith(path) ? { ...f, isDeleted: true } : f
      )
    })),

  clearFileDeletedStatus: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path.startsWith(path) ? { ...f, isDeleted: false } : f
      )
    })),

  // 预览模式：将所有预览标签转为永久标签
  convertAllPreviewToPermanent: () =>
    set((state) => ({
      openFiles: state.openFiles.map((f) => (f.isPreview ? { ...f, isPreview: false } : f))
    })),

  // Tab 重排序
  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const newFiles = [...state.openFiles]
      const [removed] = newFiles.splice(fromIndex, 1)
      newFiles.splice(toIndex, 0, removed)
      return { openFiles: newFiles }
    })
}))
