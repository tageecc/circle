export type GitStatus = 'modified' | 'untracked' | 'staged' | 'conflicted' | null

export interface FileTab {
  path: string
  name: string
  content: string
  language: string
  isDirty: boolean
  isDeleted?: boolean
  gitStatus?: GitStatus
  hasErrors?: boolean
}

export interface PanelLayout {
  fileTreeSize: number
  chatPanelSize: number
}

export interface RecentProject {
  name: string
  path: string
  lastOpened: string
}

export interface GitFileStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  conflicted: string[]
}

export type BottomPanelType = 'terminal' | 'problems' | null
export type MarkdownMode = 'edit' | 'preview' | 'split'

export interface ClipboardItem {
  path: string
  type: 'cut' | 'copy'
}
