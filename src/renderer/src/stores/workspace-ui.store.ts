import { create } from 'zustand'
import type { BottomPanelType, ClipboardItem } from '@/types/ide'
import type { LeftTabType } from '@/hooks/use-layout-manager'

interface WorkspaceUIState {
  // 布局状态
  showFileTree: boolean
  showChatSidebar: boolean
  bottomPanel: BottomPanelType
  activeLeftTab: LeftTabType
  fileTreeRefreshKey: number
  expandedDirs: string[]
  isFullscreen: boolean // ⭐ macOS 全屏状态

  // 剪贴板和新建项
  clipboard: ClipboardItem | null
  newItemParentPath: string

  // Git 面板状态
  changesExpanded: boolean
  stashesExpanded: boolean
  branchCompare: { baseBranch: string; compareBranch: string } | null

  // 对话框状态（统一管理所有对话框）
  showStashDialog: boolean
  settingsOpen: boolean
  bugReportOpen: boolean
  cloneDialogOpen: boolean
  newProjectDialogOpen: boolean
  pushDialogOpen: boolean
  newBranchDialogOpen: boolean
  newFileDialogOpen: boolean
  newFolderDialogOpen: boolean
  quickOpenDialogOpen: boolean

  // 终端和聊天初始化状态
  terminalInitialized: boolean
  chatInitialized: boolean
  pendingTerminalCommand: string | null
  terminalTabCount: number

  // 布局 Actions
  toggleFileTree: () => void
  toggleChatSidebar: () => void
  setBottomPanel: (panel: BottomPanelType) => void
  setActiveLeftTab: (tab: LeftTabType) => void
  refreshFileTree: () => void
  setExpandedDirs: (dirs: string[]) => void
  setFullscreen: (isFullscreen: boolean) => void

  // 其他 Actions
  setClipboard: (item: ClipboardItem | null) => void
  setNewItemParentPath: (path: string) => void
  setChangesExpanded: (expanded: boolean) => void
  setStashesExpanded: (expanded: boolean) => void
  setBranchCompare: (compare: { baseBranch: string; compareBranch: string } | null) => void
  setTerminalInitialized: (initialized: boolean) => void
  setChatInitialized: (initialized: boolean) => void
  setPendingTerminalCommand: (command: string | null) => void
  setTerminalTabCount: (count: number) => void

  // 统一的对话框控制方法
  openDialog: (
    dialog:
      | 'clone'
      | 'newProject'
      | 'push'
      | 'newBranch'
      | 'newFile'
      | 'newFolder'
      | 'quickOpen'
      | 'stash'
      | 'settings'
      | 'bugReport'
  ) => void
  closeDialog: (
    dialog:
      | 'clone'
      | 'newProject'
      | 'push'
      | 'newBranch'
      | 'newFile'
      | 'newFolder'
      | 'quickOpen'
      | 'stash'
      | 'settings'
      | 'bugReport'
  ) => void
}

// 对话框名称到状态键的映射（避免重复定义）
const DIALOG_MAP = {
  clone: 'cloneDialogOpen',
  newProject: 'newProjectDialogOpen',
  push: 'pushDialogOpen',
  newBranch: 'newBranchDialogOpen',
  newFile: 'newFileDialogOpen',
  newFolder: 'newFolderDialogOpen',
  quickOpen: 'quickOpenDialogOpen',
  stash: 'showStashDialog',
  settings: 'settingsOpen',
  bugReport: 'bugReportOpen'
} as const

export const useWorkspaceUIStore = create<WorkspaceUIState>((set) => ({
  // 布局初始值
  showFileTree: true,
  showChatSidebar: true,
  bottomPanel: null,
  activeLeftTab: 'explorer',
  fileTreeRefreshKey: 0,
  expandedDirs: [],
  isFullscreen: false,

  // 剪贴板和新建项
  clipboard: null,
  newItemParentPath: '',

  // Git 面板状态
  changesExpanded: true,
  stashesExpanded: false,
  branchCompare: null,

  // 对话框状态（统一管理）
  showStashDialog: false,
  settingsOpen: false,
  bugReportOpen: false,
  cloneDialogOpen: false,
  newProjectDialogOpen: false,
  pushDialogOpen: false,
  newBranchDialogOpen: false,
  newFileDialogOpen: false,
  newFolderDialogOpen: false,
  quickOpenDialogOpen: false,

  // 终端和聊天初始化状态
  terminalInitialized: false,
  chatInitialized: false,
  pendingTerminalCommand: null,
  terminalTabCount: 0,

  // 布局 Actions
  toggleFileTree: () => set((state) => ({ showFileTree: !state.showFileTree })),
  toggleChatSidebar: () => set((state) => ({ showChatSidebar: !state.showChatSidebar })),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
  setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  refreshFileTree: () => set((state) => ({ fileTreeRefreshKey: state.fileTreeRefreshKey + 1 })),
  setExpandedDirs: (dirs) => set({ expandedDirs: dirs }),

  // 其他 Actions
  setClipboard: (item) => set({ clipboard: item }),
  setNewItemParentPath: (path) => set({ newItemParentPath: path }),
  setChangesExpanded: (expanded) => set({ changesExpanded: expanded }),
  setStashesExpanded: (expanded) => set({ stashesExpanded: expanded }),
  setBranchCompare: (compare) => set({ branchCompare: compare }),
  setTerminalInitialized: (initialized) => set({ terminalInitialized: initialized }),
  setChatInitialized: (initialized) => set({ chatInitialized: initialized }),
  setPendingTerminalCommand: (command) => set({ pendingTerminalCommand: command }),
  setTerminalTabCount: (count) => set({ terminalTabCount: count }),

  // 统一的对话框控制方法
  openDialog: (dialog) => set({ [DIALOG_MAP[dialog]]: true }),
  closeDialog: (dialog) => set({ [DIALOG_MAP[dialog]]: false })
}))
