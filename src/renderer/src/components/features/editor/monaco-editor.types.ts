import type { editor } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

// ============================================
// 类型定义
// ============================================

export type DiffType = 'add' | 'delete' | 'modify'

export interface CodeRange {
  startLineNumber: number
  endLineNumber: number
}

export interface DiffAction {
  type: DiffType
  originalRange?: CodeRange
  modifiedRange?: CodeRange
}

export interface ToolbarPosition {
  top: number
  height: number
  scrollTop: number
}

export interface ToolbarConfig {
  enabled?: boolean
  showNavigation?: boolean
  showAccept?: boolean
  showReject?: boolean
  showAcceptAll?: boolean
  showUndoAll?: boolean
  acceptLabel?: string
  rejectLabel?: string
  acceptAllLabel?: string
  undoAllLabel?: string
  position?: 'top' | 'bottom'
  className?: string
}

export interface EditorDiagnostic {
  filePath: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info'
  message: string
  source: string
  code?: string | number
}

export type GitBlameLine = {
  line: number
  author: string
  authorTime: number
  summary: string
}

// ============================================
// Props 定义
// ============================================

export interface MonacoCodeEditorProps {
  value: string
  language?: string
  height?: string | number
  width?: string | number
  readOnly?: boolean
  path?: string
  workspaceRoot?: string | null
  enableLanguageService?: boolean
  enableGitBlame?: boolean
  // Monaco 编辑器配置选项（用于覆盖默认配置）
  options?: editor.IStandaloneEditorConstructionOptions
  // 允许覆盖主题（用于预览等场景）
  theme?: 'one-dark-pro' | 'one-light'

  onChange?: (value: string | undefined, filePath: string) => void // ✅ 增加filePath参数避免闭包陷阱
  onSave?: (content: string, filePath: string) => void // ✅ 增加filePath参数避免闭包陷阱
  onDiagnosticsChange?: (diagnostics: EditorDiagnostic[]) => void
  onCursorPositionChange?: (position: { line: number; column: number }) => void
  // 允许外部挂载回调
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void
}

export interface MonacoDiffEditorProps {
  value: string
  originalValue: string
  language?: string
  height?: string | number
  width?: string | number
  readOnly?: boolean
  renderSideBySide?: boolean
  toolbar?: ToolbarConfig
  // Monaco Diff 编辑器配置选项（用于覆盖默认配置）
  options?: editor.IStandaloneDiffEditorConstructionOptions
  onChange?: (value: string | undefined) => void
  // 所有 diff 都被解决后的回调（传递最终的文件内容）
  onAllDiffsResolved?: (finalContent: string) => void
  // 跳转到下一个有 diff 的文件
  onNextFile?: () => void
  onDiffChange?: (actions: DiffAction[]) => void
  onCurrentDiffChange?: (index: number) => void
  onMount?: (editor: editor.IStandaloneDiffEditor) => void
}

export const defaultToolbarConfig: Required<ToolbarConfig> = {
  enabled: true,
  showNavigation: true,
  showAccept: true,
  showReject: true,
  showAcceptAll: false, // 批量操作在全局底部工具栏，单个 diff 工具栏不显示
  showUndoAll: false, // 批量操作在全局底部工具栏，单个 diff 工具栏不显示
  acceptLabel: 'Accept',
  rejectLabel: 'Reject',
  acceptAllLabel: 'Keep All',
  undoAllLabel: 'Undo All',
  position: 'bottom',
  className: ''
}
