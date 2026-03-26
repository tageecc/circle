import { app } from 'electron'
import { getDb } from '../database/db'
import { DEFAULT_SKILL_SCAN_DIRECTORIES } from '../constants/skills.constants'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
  isFullScreen: boolean
}

interface RecentProject {
  name: string
  path: string
  lastOpened: string
}

interface EditorFileState {
  path: string
  cursorPosition?: {
    lineNumber: number
    column: number
  }
  scrollPosition?: {
    scrollTop: number
    scrollLeft: number
  }
  viewState?: unknown // Monaco Editor view state
}

// EditorOptions 直接使用 Monaco 的配置类型（部分）
interface EditorOptions {
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  tabSize?: number
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded'
  minimap?: { enabled?: boolean }
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval'
  [key: string]: unknown // 允许其他 Monaco 配置项
}

interface TerminalSettings {
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  cursorBlink?: boolean
  cursorStyle?: 'block' | 'underline' | 'bar'
}

interface AppearanceSettings {
  theme?: 'light' | 'dark' | 'system'
  accentColor?: string
  uiScale?: number
}

interface KeymapSettings {
  profile: string
  bindings: Record<string, string>
}

interface LayoutState {
  showFileTree?: boolean
  showChatSidebar?: boolean
  bottomPanel?: 'terminal' | 'problems' | null
  activeLeftTab?: 'explorer' | 'search' | 'changes' | 'history' | 'mcp' | 'skills'
  panelLayout?: {
    fileTreeSize?: number
    chatPanelSize?: number
  }
}

// VSCode 风格的文件排除配置
interface FilesExclude {
  [pattern: string]: boolean
}

interface UIState {
  activeView?: string
  selectedAgentId?: string
  agentActiveTab?: string
  layout?: LayoutState
  codeEditor?: {
    openFiles?: EditorFileState[]
    activeFilePath?: string
    currentProject?: string | null
    panelLayout?: {
      fileTreeSize?: number
      chatPanelSize?: number
    }
    expandedDirs?: string[]
  }
}

interface ApiKeys {
  openai?: string
  anthropic?: string
  google?: string
  deepseek?: string
  dashscope?: string
  [provider: string]: string | undefined
}

interface ServiceSettings {
  /** AI 模型 temperature（0-1） */
  temperature?: number
  /** 代码补全 temperature（0-1） */
  completionTemperature?: number
  /** Language Service 补全超时（毫秒） */
  languageServiceCompletionTimeout?: number
  /** Language Service Hover 超时（毫秒） */
  languageServiceHoverTimeout?: number
}

interface SkillsSettings {
  scanDirectories: string[]
}

interface AppConfig {
  theme: 'light' | 'dark'
  language: string
  windowState: WindowState
  currentProject?: string | null
  recentProjects?: RecentProject[]
  uiState?: UIState
  editorOptions?: EditorOptions
  terminalSettings?: TerminalSettings
  appearanceSettings?: AppearanceSettings
  keymapSettings?: KeymapSettings
  skillsSettings?: SkillsSettings
  filesExclude?: FilesExclude
  apiKeys?: ApiKeys
  serviceSettings?: ServiceSettings
  preferences: {
    autoSave: boolean
    debugMode: boolean
    telemetry: boolean
    sidebarCollapsed: boolean
    autoRunMode?: 'ask' | 'auto-run' | 'whitelist' // 命令执行模式
    commandWhitelist?: string[] // 命令白名单
    enableFilePreviewOnSingleClick?: boolean // 单击文件预览模式
    openProjectBehavior?: 'ask' | 'current' | 'new' // 打开项目行为
  }
}

const defaultPreferences = {
  autoSave: true,
  debugMode: false,
  telemetry: true,
  sidebarCollapsed: false,
  autoRunMode: 'ask' as const, // 默认：每次询问（更安全）
  commandWhitelist: [
    // 包管理器
    'npm',
    'pnpm',
    'yarn',
    'bun',
    // 文件查看
    'ls',
    'cat',
    'head',
    'tail',
    'less',
    'more',
    // 基础命令
    'echo',
    'pwd',
    'which',
    'whoami',
    'date',
    // Git 只读命令
    'git status',
    'git diff',
    'git log',
    'git branch',
    'git show'
  ],
  enableFilePreviewOnSingleClick: true, // 默认开启单击预览功能
  openProjectBehavior: 'ask' as const // 默认每次询问
}

/**
 * ConfigService - 使用 SQLite 存储配置
 */
export class ConfigService {
  private db: ReturnType<typeof getDb>

  constructor() {
    this.db = getDb()
  }

  /**
   * 获取数据库路径（用于调试）
   */
  getDatabasePath(): string {
    const userDataPath = app.getPath('userData')
    return `${userDataPath}/circle.db`
  }

  getConfig(): AppConfig {
    const windowState = this.getWindowState()
    const filesExclude = this.db.getFilesExclude()
    const recentProjects = this.db.getRecentProjects()

    return {
      theme: this.getTheme(),
      language: this.db.getConfig('language', 'zh-CN'),
      windowState,
      currentProject: this.db.getConfig<string | null>('currentProject', null),
      recentProjects: recentProjects.map((p) => ({
        name: p.name,
        path: p.path,
        lastOpened: p.lastOpened.toISOString()
      })),
      uiState: this.getUIState(),
      editorOptions: this.getEditorOptions(),
      terminalSettings: this.getTerminalSettings(),
      appearanceSettings: this.getAppearanceSettings(),
      keymapSettings: this.getKeymapSettings(),
      skillsSettings: this.getSkillsSettings(),
      filesExclude: filesExclude,
      preferences: this.getPreferences()
    }
  }

  getAutoSave(): boolean {
    return this.getPreferences().autoSave
  }

  setAutoSave(enabled: boolean): void {
    this.setPreference('autoSave', enabled)
  }

  setConfig(config: Partial<AppConfig>): void {
    if (config.theme) {
      this.setTheme(config.theme)
    }
    if (config.language) {
      this.db.setConfig('language', config.language)
    }
    if (config.windowState) {
      this.setWindowState(config.windowState)
    }
    if (config.currentProject !== undefined) {
      this.setCurrentProject(config.currentProject)
    }
    if (config.preferences) {
      this.setPreferences(config.preferences)
    }
    if (config.editorOptions) {
      this.setEditorOptions(config.editorOptions)
    }
    if (config.terminalSettings) {
      this.setTerminalSettings(config.terminalSettings)
    }
    if (config.appearanceSettings) {
      this.setAppearanceSettings(config.appearanceSettings)
    }
    if (config.keymapSettings) {
      this.setKeymapSettings(config.keymapSettings)
    }
    if (config.skillsSettings) {
      this.setSkillsSettings(config.skillsSettings)
    }
    if (config.filesExclude) {
      // 完整替换：先清空再写入（避免保留已删除的规则）
      this.db.clearFilesExclude()
      for (const [pattern, enabled] of Object.entries(config.filesExclude)) {
        this.db.setFilesExclude(pattern, enabled)
      }
    }
  }

  getTheme(): 'light' | 'dark' {
    const appearance = this.getAppearanceSettings()
    return (appearance?.theme as 'light' | 'dark') || 'dark'
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.setAppearanceSettings({ theme })
  }

  getWindowState(): WindowState {
    const state = this.db.getWindowState()
    return {
      x: state?.x ?? undefined,
      y: state?.y ?? undefined,
      width: state?.width ?? 1400,
      height: state?.height ?? 900,
      isMaximized: state?.isMaximized ?? false,
      isFullScreen: state?.isFullScreen ?? false
    }
  }

  setWindowState(state: Partial<WindowState>): void {
    try {
      this.db.setWindowState(state)
    } catch (error) {
      // 忽略退出时的数据库错误
      if (error instanceof Error && error.message.includes('not open')) {
        return
      }
      console.error('[ConfigService] Failed to set window state:', error)
    }
  }

  getPreferences(): AppConfig['preferences'] {
    return this.db.getUIState<AppConfig['preferences']>('preferences', defaultPreferences)
  }

  setPreferences(prefs: Partial<AppConfig['preferences']>): void {
    const current = this.getPreferences()
    this.db.setUIState('preferences', { ...current, ...prefs })
  }

  setPreference(key: keyof AppConfig['preferences'], value: boolean): void {
    this.setPreferences({ [key]: value })
  }

  getCurrentProject(): string | null | undefined {
    return this.db.getConfig<string | null>('currentProject', null)
  }

  setCurrentProject(projectPath: string | null): void {
    try {
      this.db.setConfig('currentProject', projectPath)
    } catch (error) {
      // 忽略退出时的数据库错误
      if (error instanceof Error && error.message.includes('not open')) {
        return
      }
      console.error('[ConfigService] Failed to set current project:', error)
    }
  }

  getRecentProjects(): RecentProject[] {
    return this.db.getRecentProjects().map((p) => ({
      name: p.name,
      path: p.path,
      lastOpened: p.lastOpened.toISOString()
    }))
  }

  addRecentProject(name: string, projectPath: string): void {
    this.db.addRecentProject(name, projectPath)
  }

  removeRecentProject(projectPath: string): void {
    this.db.removeRecentProject(projectPath)
  }

  getUIState(): UIState {
    // UI 状态存储为多个键值对
    const activeView = this.db.getUIState('activeView', undefined)
    const selectedAgentId = this.db.getUIState('selectedAgentId', undefined)
    const agentActiveTab = this.db.getUIState('agentActiveTab', undefined)
    const layout = this.db.getUIState<LayoutState | undefined>('layout', undefined)
    const codeEditor = this.db.getUIState<UIState['codeEditor']>('codeEditor', undefined)

    return {
      activeView,
      selectedAgentId,
      agentActiveTab,
      layout,
      codeEditor
    }
  }

  setUIState(state: Partial<UIState>): void {
    if (state.activeView !== undefined) {
      this.db.setUIState('activeView', state.activeView)
    }
    if (state.selectedAgentId !== undefined) {
      this.db.setUIState('selectedAgentId', state.selectedAgentId)
    }
    if (state.agentActiveTab !== undefined) {
      this.db.setUIState('agentActiveTab', state.agentActiveTab)
    }
    if (state.layout !== undefined) {
      this.db.setUIState('layout', state.layout)
    }
    if (state.codeEditor !== undefined) {
      this.db.setUIState('codeEditor', state.codeEditor)
    }
  }

  updateUIState(updates: Partial<UIState>): void {
    try {
      const current = this.getUIState()

      if (updates.activeView !== undefined) {
        this.db.setUIState('activeView', updates.activeView)
      }
      if (updates.selectedAgentId !== undefined) {
        this.db.setUIState('selectedAgentId', updates.selectedAgentId)
      }
      if (updates.agentActiveTab !== undefined) {
        this.db.setUIState('agentActiveTab', updates.agentActiveTab)
      }
      if (updates.layout !== undefined) {
        this.db.setUIState('layout', { ...current.layout, ...updates.layout })
      }
      if (updates.codeEditor !== undefined) {
        this.db.setUIState('codeEditor', { ...current.codeEditor, ...updates.codeEditor })
      }
    } catch (error) {
      // 忽略退出时的数据库错误
      if (error instanceof Error && error.message.includes('not open')) {
        return
      }
      console.error('[ConfigService] Failed to update UI state:', error)
    }
  }

  getLayoutState(): LayoutState {
    return this.db.getUIState<LayoutState>('layout', {})
  }

  setLayoutState(layout: Partial<LayoutState>): void {
    try {
      const current = this.getLayoutState()
      this.db.setUIState('layout', { ...current, ...layout })
    } catch (error) {
      // 忽略退出时的数据库错误
      if (error instanceof Error && error.message.includes('not open')) {
        return
      }
      console.error('[ConfigService] Failed to set layout state:', error)
    }
  }

  /**
   * 获取文件排除规则（直接从数据库读取，首次启动时已初始化默认值）
   */
  getFilesExclude(): FilesExclude {
    return this.db.getFilesExclude()
  }

  /**
   * 设置文件排除规则（单个）
   */
  setFilesExclude(pattern: string, enabled: boolean): void {
    this.db.setFilesExclude(pattern, enabled)
  }

  /**
   * 获取编辑器设置
   */
  getEditorOptions(): EditorOptions | undefined {
    return this.db.getUIState<EditorOptions | undefined>('settings.editor', undefined)
  }

  /**
   * 设置编辑器设置
   */
  setEditorOptions(options: Partial<EditorOptions>): void {
    const current = this.getEditorOptions() || {}
    this.db.setUIState('settings.editor', { ...current, ...options })
  }

  /**
   * 获取终端设置
   */
  getTerminalSettings(): TerminalSettings | undefined {
    return this.db.getUIState<TerminalSettings | undefined>('settings.terminal', undefined)
  }

  /**
   * 设置终端设置
   */
  setTerminalSettings(settings: Partial<TerminalSettings>): void {
    const current = this.getTerminalSettings() || {}
    this.db.setUIState('settings.terminal', { ...current, ...settings })
  }

  /**
   * 获取外观设置
   */
  getAppearanceSettings(): AppearanceSettings | undefined {
    return this.db.getUIState<AppearanceSettings | undefined>('settings.appearance', undefined)
  }

  /**
   * 设置外观设置
   */
  setAppearanceSettings(settings: Partial<AppearanceSettings>): void {
    const current = this.getAppearanceSettings() || {}
    this.db.setUIState('settings.appearance', { ...current, ...settings })
  }

  /**
   * 获取快捷键设置
   */
  getKeymapSettings(): KeymapSettings | undefined {
    return this.db.getUIState<KeymapSettings | undefined>('settings.keymap', undefined)
  }

  /**
   * 设置快捷键设置
   */
  setKeymapSettings(settings: Partial<KeymapSettings>): void {
    const current = this.getKeymapSettings() || { profile: 'default', bindings: {} }
    this.db.setUIState('settings.keymap', { ...current, ...settings })
  }

  /**
   * 获取技能设置
   */
  getSkillsSettings(): SkillsSettings | undefined {
    return this.db.getUIState<SkillsSettings | undefined>('settings.skills', undefined)
  }

  /**
   * 设置技能设置
   */
  setSkillsSettings(settings: Partial<SkillsSettings>): void {
    const current = this.getSkillsSettings() || {
      scanDirectories: [...DEFAULT_SKILL_SCAN_DIRECTORIES]
    }
    this.db.setUIState('settings.skills', { ...current, ...settings })
  }

  /**
   * 获取所有 API Keys
   */
  getApiKeys(): ApiKeys {
    return this.db.getUIState<ApiKeys>('settings.apiKeys', {})
  }

  /**
   * 获取指定 provider 的 API Key
   */
  getApiKey(provider: string): string | undefined {
    const keys = this.getApiKeys()
    return keys?.[provider.toLowerCase()]
  }

  /**
   * 设置指定 provider 的 API Key
   */
  setApiKey(provider: string, apiKey: string): void {
    const keys = this.getApiKeys()
    keys[provider.toLowerCase()] = apiKey
    this.db.setUIState('settings.apiKeys', keys)
  }

  /**
   * 删除指定 provider 的 API Key
   */
  deleteApiKey(provider: string): void {
    const keys = this.getApiKeys()
    delete keys[provider.toLowerCase()]
    this.db.setUIState('settings.apiKeys', keys)
  }

  /**
   * 批量设置 API Keys
   */
  setApiKeys(apiKeys: ApiKeys): void {
    this.db.setUIState('settings.apiKeys', apiKeys)
  }

  /**
   * 获取用户默认模型 (格式: provider/model)
   */
  getDefaultModel(): string {
    return this.db.getUIState<string>('settings.defaultModel', 'Alibaba (China)/qwen-turbo')
  }

  /**
   * 获取代码补全专用模型（快速模型）
   */
  getCompletionModel(): string {
    return this.db.getUIState<string>('settings.completionModel', 'Alibaba (China)/qwen-turbo')
  }

  /**
   * 设置用户默认模型
   */
  setDefaultModel(modelId: string): void {
    this.db.setUIState('settings.defaultModel', modelId)
  }

  /**
   * 获取服务级配置
   */
  getServiceSettings(): ServiceSettings {
    return this.db.getUIState<ServiceSettings>('settings.service', {})
  }

  /**
   * 设置服务级配置
   */
  setServiceSettings(settings: Partial<ServiceSettings>): void {
    const current = this.getServiceSettings()
    this.db.setUIState('settings.service', { ...current, ...settings })
  }

  /**
   * 获取 AI 模型 temperature（默认值来自常量）
   */
  getTemperature(): number {
    const settings = this.getServiceSettings()
    return settings.temperature ?? 0.7
  }

  /**
   * 获取代码补全 temperature（默认值来自常量）
   */
  getCompletionTemperature(): number {
    const settings = this.getServiceSettings()
    return settings.completionTemperature ?? 0.2
  }
}

export type {
  AppConfig,
  WindowState,
  UIState,
  LayoutState,
  EditorFileState,
  RecentProject,
  EditorOptions,
  TerminalSettings,
  AppearanceSettings,
  KeymapSettings,
  FilesExclude,
  ApiKeys,
  ServiceSettings
}
