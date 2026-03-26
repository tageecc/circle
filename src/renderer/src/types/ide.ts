export interface FileTab {
  path: string
  name: string
  content: string
  language: string
  isDirty: boolean
  gitStatus?: GitStatus
  diagnostics?: EditorDiagnostic[]
  hasErrors?: boolean
  isDeleted?: boolean
  encoding?: string
  lineEnding?: 'LF' | 'CRLF' | 'CR'
  /** 是否为预览模式（单击打开，未编辑的临时标签） */
  isPreview?: boolean
  /** 是否为只读模式（如市场预览） */
  readOnly?: boolean
  /** Git HEAD 版本内容（用于 diff 显示） */
  originalContent?: string
  /** 是否显示 diff 视图 */
  showDiff?: boolean
  /** Stash 索引（用于 stash diff 视图） */
  stashIndex?: number
  /** Stash 消息（用于 stash diff 视图标题） */
  stashMessage?: string
  /** 分支比较：基础分支（左侧） */
  baseBranch?: string
  /** 分支比较：比较分支（右侧） */
  compareBranch?: string
  /** 提交 Hash（用于 commit diff 视图） */
  commitHash?: string
  /** 是否显示冲突解决界面（三方合并） */
  showConflict?: boolean
  /** OURS 版本（当前分支，HEAD） */
  oursContent?: string
  /** THEIRS 版本（合并分支） */
  theirsContent?: string
  /** BASE 版本（共同祖先） */
  baseContent?: string
  /** OURS 分支名（用于三方合并标题显示） */
  oursBranch?: string
  /** THEIRS 分支名（用于三方合并标题显示） */
  theirsBranch?: string
  /** 是否为 MCP 详情页 */
  isMCPDetail?: boolean
  /** MCP 服务器 ID（本地已配置的服务） */
  mcpServerId?: string
  /** MCP 服务使用次数（近30天） */
  mcpUsageCount?: number
}

export type MarkdownMode = 'edit' | 'preview' | 'split'

export interface PendingFileEdit {
  toolCallId: string
  sessionId: string // 用于前后端同步清理
  toolName: string // 工具名称：'edit_file' | 'delete_file'（用于区分清空和删除）
  filePath: string
  absolutePath: string
  oldContent: string // 空字符串表示新建，有内容表示编辑或删除
  newContent: string // 空字符串表示清空或删除（通过 toolName 区分）
  language?: string
  timestamp: number
}

export interface EditorDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export type GitStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'conflicted' | 'staged'

export type BottomPanelType = 'problems' | 'terminal' | null

export interface GitFileStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  added: string[]
  deleted: string[]
  renamed: string[]
  untracked: string[]
  conflicted: string[]
}

export interface RecentProject {
  path: string
  name: string
  lastOpened: string
}

export interface ClipboardItem {
  path: string
  type: 'copy' | 'cut'
}

export interface CursorPosition {
  line: number
  column: number
}

// ✅ 新增：FileManager 接口定义
export interface FileManager {
  openFiles: FileTab[]
  activeFile: string | null
  savingFile: string | null
  openFile: (
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
  ) => Promise<void>
  closeFile: (path: string) => void
  closeOthers: (path: string) => void
  closeAll: () => void
  closeToRight: (path: string) => void
  saveFile: (path: string, content?: string, onSuccess?: () => void) => Promise<void>
  updateContent: (path: string, content: string) => void
  reloadFile: (path: string) => Promise<void>
  setActiveFile: (path: string) => void
  updateFilePathAfterRename: (oldPath: string, newPath: string, newName: string) => void
  markFileAsDeleted: (deletedPath: string) => void
  clearFileDeletedStatus: (restoredPath: string) => void
  removeDeletedFiles: (deletedPath: string) => void
  clearAllFiles: () => void
  restoreFiles: (filePaths: string[], projectRoot: string) => Promise<void>
  updateFileGitStatus: (path: string, status: GitStatus | undefined) => void
  updateFileEncoding: (path: string, encoding: string) => void
  updateFileLineEnding: (path: string, lineEnding: 'LF' | 'CRLF' | 'CR') => void
  reopenFileWithEncoding: (path: string, encoding: string) => Promise<void>
  setFileSaveEncoding: (path: string, encoding: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  getCurrentFile: () => FileTab | null
  convertAllPreviewToPermanent: () => void
}

export interface PanelLayout {
  fileTreeSize: number
  chatPanelSize: number
}

export interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>
