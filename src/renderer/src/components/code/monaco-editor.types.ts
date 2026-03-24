import type { editor } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'
import type { EditorSettings } from '../../config/monaco-editor-options'

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
  acceptLabel?: string
  rejectLabel?: string
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
  // 允许覆盖全局设置（用于预览等场景）
  editorSettings?: Partial<EditorSettings>
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
  /** 为 true 时：接受/拒绝表示整文件（接受=关闭 diff 条，拒绝=回滚文件），不按块处理 */
  wholeFileAcceptReject?: boolean
  onChange?: (value: string | undefined) => void
  onAccept?: (diffIndex?: number, action?: DiffAction) => void
  onReject?: (diffIndex?: number, action?: DiffAction) => void
  onDiffChange?: (actions: DiffAction[]) => void
  onCurrentDiffChange?: (index: number) => void
  onMount?: (editor: editor.IStandaloneDiffEditor) => void
}

export const defaultToolbarConfig: Required<ToolbarConfig> = {
  enabled: true,
  showNavigation: true,
  showAccept: true,
  showReject: true,
  acceptLabel: '接受',
  rejectLabel: '拒绝',
  position: 'bottom',
  className: ''
}
