import { create } from 'zustand'
import type { EditorDiagnostic } from '@/components/features/editor/monaco-code-editor'

interface WorkspaceState {
  // 工作区数据
  workspaceRoot: string | null
  diagnostics: EditorDiagnostic[]

  // Actions
  setWorkspaceRoot: (root: string | null) => void
  setDiagnostics: (diagnostics: EditorDiagnostic[]) => void
  addDiagnostics: (filePath: string, diagnostics: EditorDiagnostic[]) => void
  clearDiagnostics: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaceRoot: null,
  diagnostics: [],

  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  addDiagnostics: (filePath, newDiagnostics) =>
    set((state) => {
      // 移除该文件的旧诊断
      const filtered = state.diagnostics.filter((d) => d.filePath !== filePath)
      // 添加新诊断
      return { diagnostics: [...filtered, ...newDiagnostics] }
    }),
  clearDiagnostics: () => set({ diagnostics: [] })
}))
