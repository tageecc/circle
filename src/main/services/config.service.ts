import { app } from 'electron'
import fs from 'fs'
import path from 'path'

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
  viewState?: any // Monaco Editor view state
}

interface EditorSettings {
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  tabSize?: number
  wordWrap?: boolean
  minimap?: boolean
  lineNumbers?: boolean
}

interface TerminalSettings {
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  cursorBlink?: boolean
  cursorStyle?: 'block' | 'underline' | 'bar'
  /** 终端使用的 shell 可执行路径，不填则用系统默认 */
  shell?: string
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

/** 代码库语义索引使用的 Embedding 模型配置 */
export interface EmbeddingSettings {
  provider: 'openai' | 'dashscope'
  model: string
  apiKey?: string
}

/** Apply Edit 小模型配置（edit_file 占位符展开） */
export interface ApplyEditSettings {
  provider: string
  model: string
  apiKey?: string
}

/** 网页搜索配置 */
export interface SearchSettings {
  bingApiKey?: string
}

/** AI 行内补全（FIM）模型；未填则使用默认助手模型与 Key */
export interface CompletionSettings {
  enabled?: boolean
  /** 是否用 Shadow 诊断校验 TS/JS（较慢） */
  enableValidation?: boolean
  provider?: string
  model?: string
  apiKey?: string
}

interface UIState {
  // 主视图状态
  activeView?: string // 'agents' | 'code' | 'mcp-servers' | 'tools' | etc.

  // Agent 相关状态
  selectedAgentId?: string
  agentActiveTab?: string // 'basic' | 'model' | 'tools' | 'advanced'

  // Code 编辑器状态
  codeEditor?: {
    openFiles?: EditorFileState[]
    activeFilePath?: string
    currentProject?: string | null
    panelLayout?: {
      fileTreeSize?: number
      chatPanelSize?: number
    }
    expandedDirs?: string[] // 展开的目录路径列表
  }

  // 其他视图状态
  mcpServersView?: {
    searchQuery?: string
    selectedServerId?: string
  }

  toolsView?: {
    searchQuery?: string
    selectedToolId?: string
  }
}

interface AppConfig {
  theme: 'light' | 'dark'
  language: string
  windowState: WindowState
  lastOpenedAgent?: string
  currentProject?: string | null
  recentProjects?: RecentProject[]
  uiState?: UIState
  editorSettings?: EditorSettings
  terminalSettings?: TerminalSettings
  appearanceSettings?: AppearanceSettings
  keymapSettings?: KeymapSettings
  embeddingSettings?: EmbeddingSettings
  applyEditSettings?: ApplyEditSettings
  searchSettings?: SearchSettings
  completionSettings?: CompletionSettings
  preferences: {
    autoSave: boolean
    debugMode: boolean
    telemetry: boolean
    sidebarCollapsed: boolean
  }
}

const defaultConfig: AppConfig = {
  theme: 'dark',
  language: 'zh-CN',
  windowState: {
    width: 1400,
    height: 900,
    isMaximized: false,
    isFullScreen: false
  },
  preferences: {
    autoSave: true,
    debugMode: false,
    telemetry: true,
    sidebarCollapsed: false
  }
}

export class ConfigService {
  private configPath: string
  private config: AppConfig

  constructor() {
    // 获取用户数据目录
    const userDataPath = app.getPath('userData')
    this.configPath = path.join(userDataPath, 'config.json')

    // 加载配置
    this.config = this.loadConfig()

    console.log('📁 ConfigService initialized')
    console.log('   Config path:', this.configPath)
    console.log('   UserData path:', userDataPath)
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        console.log('📖 Loading config from:', this.configPath)
        const data = fs.readFileSync(this.configPath, 'utf-8')
        const loadedConfig = JSON.parse(data)
        console.log('   Loaded recent projects:', loadedConfig.recentProjects?.length || 0)
        console.log('   Loaded current project:', loadedConfig.currentProject || 'none')
        // 合并默认配置和加载的配置
        return { ...defaultConfig, ...loadedConfig }
      } else {
        console.log('⚠️  Config file does not exist, using defaults')
      }
    } catch (error) {
      console.error('❌ Failed to load config:', error)
    }
    return { ...defaultConfig }
  }

  private saveConfig(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // 保存配置
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (error) {
      console.error('❌ Failed to save config:', error)
    }
  }

  getConfig(): AppConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
  }

  getTheme(): 'light' | 'dark' {
    return this.config.theme
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.config.theme = theme
    this.saveConfig()
  }

  getLanguage(): string {
    return this.config.language
  }

  setLanguage(language: string): void {
    this.config.language = language
    this.saveConfig()
  }

  getWindowState(): WindowState {
    return { ...this.config.windowState }
  }

  setWindowState(state: Partial<WindowState>): void {
    this.config.windowState = { ...this.config.windowState, ...state }
    this.saveConfig()
  }

  getLastOpenedAgent(): string | undefined {
    return this.config.lastOpenedAgent
  }

  setLastOpenedAgent(agentId: string): void {
    this.config.lastOpenedAgent = agentId
    this.saveConfig()
  }

  getPreferences(): AppConfig['preferences'] {
    return { ...this.config.preferences }
  }

  setPreference(key: keyof AppConfig['preferences'], value: boolean): void {
    this.config.preferences[key] = value
    this.saveConfig()
  }

  resetConfig(): void {
    this.config = { ...defaultConfig }
    this.saveConfig()
  }

  // 项目相关配置
  getCurrentProject(): string | null | undefined {
    return this.config.currentProject
  }

  setCurrentProject(projectPath: string | null): void {
    this.config.currentProject = projectPath
    this.saveConfig()
  }

  getRecentProjects(): RecentProject[] {
    return this.config.recentProjects || []
  }

  // UI 状态相关方法
  getUIState(): UIState {
    return this.config.uiState || {}
  }

  setUIState(state: Partial<UIState>): void {
    this.config.uiState = { ...this.config.uiState, ...state }
    this.saveConfig()
  }

  // 更新特定视图的状态（深度合并）
  updateUIState(updates: Partial<UIState>): void {
    this.config.uiState = {
      ...this.config.uiState,
      ...updates,
      codeEditor: {
        ...this.config.uiState?.codeEditor,
        ...updates.codeEditor
      },
      mcpServersView: {
        ...this.config.uiState?.mcpServersView,
        ...updates.mcpServersView
      },
      toolsView: {
        ...this.config.uiState?.toolsView,
        ...updates.toolsView
      }
    }
    this.saveConfig()
  }

  getEmbeddingSettings(): EmbeddingSettings | undefined {
    return this.config.embeddingSettings
  }

  setEmbeddingSettings(settings: EmbeddingSettings | undefined): void {
    this.config.embeddingSettings = settings
    this.saveConfig()
  }

  getApplyEditSettings(): ApplyEditSettings | undefined {
    return this.config.applyEditSettings
  }

  setApplyEditSettings(settings: ApplyEditSettings | undefined): void {
    this.config.applyEditSettings = settings
    this.saveConfig()
  }

  getSearchSettings(): SearchSettings | undefined {
    return this.config.searchSettings
  }

  setSearchSettings(settings: SearchSettings | undefined): void {
    this.config.searchSettings = settings
    this.saveConfig()
  }

  getCompletionSettings(): CompletionSettings | undefined {
    return this.config.completionSettings
  }

  setCompletionSettings(settings: CompletionSettings | undefined): void {
    this.config.completionSettings = settings
    this.saveConfig()
  }
}

// 导出类型供其他模块使用
export type {
  AppConfig,
  WindowState,
  UIState,
  EditorFileState,
  RecentProject,
  EditorSettings,
  TerminalSettings,
  AppearanceSettings,
  KeymapSettings
}
