import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { editor } from 'monaco-editor'

interface TerminalSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system'
  accentColor: string
  uiScale: number
}

interface KeymapSettings {
  profile: string
  bindings: Record<string, string>
}

type AutoRunMode = 'ask' | 'auto-run' | 'whitelist'

interface GeneralSettings {
  language: string
  autoSave: boolean
  debugMode: boolean
  autoRunMode: AutoRunMode
  commandWhitelist: string[]
  enableFilePreviewOnSingleClick: boolean
  openProjectBehavior: 'ask' | 'current' | 'new'
}

export interface SkillsSettings {
  scanDirectories: string[] // 技能扫描目录（相对于项目根目录和用户主目录）
}

// VSCode 风格的文件排除配置
// key: glob 模式, value: 是否启用
interface FilesExclude {
  [pattern: string]: boolean
}

interface SettingsContextType {
  editorOptions: Partial<editor.IStandaloneEditorConstructionOptions>
  terminalSettings: TerminalSettings
  appearanceSettings: AppearanceSettings
  keymapSettings: KeymapSettings
  generalSettings: GeneralSettings
  skillsSettings: SkillsSettings
  filesExclude: FilesExclude
  updateEditorOptions: (
    options: Partial<editor.IStandaloneEditorConstructionOptions>
  ) => Promise<void>
  updateTerminalSettings: (settings: Partial<TerminalSettings>) => Promise<void>
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => Promise<void>
  updateKeymapSettings: (settings: Partial<KeymapSettings>) => Promise<void>
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => Promise<void>
  reloadSettings: () => Promise<void>
}

// 用户配置默认为空，使用 monaco-editor-options.ts 中的默认值
const defaultEditorOptions: Partial<editor.IStandaloneEditorConstructionOptions> = {}

const defaultTerminalSettings: TerminalSettings = {
  fontSize: 14,
  fontFamily: 'Monaco',
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block'
}

const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'system',
  accentColor: '#3b82f6',
  uiScale: 1.0
}

const defaultKeymapSettings: KeymapSettings = {
  profile: 'eclipse',
  bindings: {}
}

const defaultGeneralSettings: GeneralSettings = {
  language: 'zh-CN',
  autoSave: true,
  debugMode: false,
  autoRunMode: 'auto-run',
  commandWhitelist: [
    'npm',
    'pnpm',
    'yarn',
    'ls',
    'cat',
    'echo',
    'pwd',
    'git status',
    'git diff',
    'git log'
  ],
  enableFilePreviewOnSingleClick: true,
  openProjectBehavior: 'ask'
}

const DEFAULT_SKILL_SCAN_DIRECTORIES = ['.circle', '.cursor', '.vscode', '.claude', 'skills']

const defaultSkillsSettings: SkillsSettings = {
  scanDirectories: [...DEFAULT_SKILL_SCAN_DIRECTORIES]
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [editorOptions, setEditorOptions] =
    useState<Partial<editor.IStandaloneEditorConstructionOptions>>(defaultEditorOptions)
  const [terminalSettings, setTerminalSettings] =
    useState<TerminalSettings>(defaultTerminalSettings)
  const [appearanceSettings, setAppearanceSettings] =
    useState<AppearanceSettings>(defaultAppearanceSettings)
  const [keymapSettings, setKeymapSettings] = useState<KeymapSettings>(defaultKeymapSettings)
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(defaultGeneralSettings)
  const [skillsSettings, setSkillsSettings] = useState<SkillsSettings>(defaultSkillsSettings)
  const [filesExclude, setFilesExclude] = useState<FilesExclude>({})

  const loadSettings = async () => {
    try {
      const config = await window.api.config.get()
      const preferences = await window.api.config.getPreferences()

      if (config.editorOptions) {
        setEditorOptions(config.editorOptions)
      }

      if (config.terminalSettings) {
        setTerminalSettings({ ...defaultTerminalSettings, ...config.terminalSettings })
      }

      if (config.keymapSettings) {
        setKeymapSettings({ ...defaultKeymapSettings, ...config.keymapSettings })
      }

      const appearanceSettings = {
        ...defaultAppearanceSettings,
        ...config.appearanceSettings
      }
      setAppearanceSettings(appearanceSettings)

      setGeneralSettings({
        language: config.language || 'zh-CN',
        autoSave: preferences.autoSave ?? true,
        debugMode: preferences.debugMode ?? false,
        autoRunMode: preferences.autoRunMode ?? 'auto-run',
        commandWhitelist: preferences.commandWhitelist ?? defaultGeneralSettings.commandWhitelist,
        enableFilePreviewOnSingleClick: preferences.enableFilePreviewOnSingleClick ?? true,
        openProjectBehavior: preferences.openProjectBehavior ?? 'ask'
      })

      // 加载技能设置
      if (config.skillsSettings) {
        setSkillsSettings({ ...defaultSkillsSettings, ...config.skillsSettings })
      }

      // 加载文件排除规则
      if (config.filesExclude) {
        setFilesExclude(config.filesExclude)
      }

      // 应用界面缩放
      if (appearanceSettings.uiScale) {
        applyUIScale(appearanceSettings.uiScale)
      }

      // 应用主题
      applyTheme(appearanceSettings.theme)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // 应用界面缩放
  const applyUIScale = (scale: number) => {
    document.documentElement.style.fontSize = `${16 * scale}px`
  }

  // 应用主题
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    let actualTheme: 'light' | 'dark'

    if (theme === 'system') {
      // 检测系统主题
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else {
      actualTheme = theme
    }

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(actualTheme)

    // 保存实际应用的主题到 localStorage，供 index.html 使用
    localStorage.setItem('circle-theme', actualTheme)

    // 同时保存用户选择到 localStorage（包括 'system' 选项）
    localStorage.setItem('circle-theme-preference', theme)
  }

  // 监听系统主题变化
  useEffect(() => {
    if (appearanceSettings.theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      applyTheme('system')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [appearanceSettings.theme])

  const updateEditorOptions = async (
    options: Partial<editor.IStandaloneEditorConstructionOptions>
  ) => {
    const newOptions = { ...editorOptions, ...options }
    setEditorOptions(newOptions)

    try {
      const config = await window.api.config.get()
      await window.api.config.set({
        ...config,
        editorOptions: newOptions
      })
    } catch (error) {
      console.error('Failed to save editor options:', error)
    }
  }

  const updateTerminalSettings = async (settings: Partial<TerminalSettings>) => {
    const newSettings = { ...terminalSettings, ...settings }
    setTerminalSettings(newSettings)

    try {
      const config = await window.api.config.get()
      await window.api.config.set({
        ...config,
        terminalSettings: newSettings
      })
    } catch (error) {
      console.error('Failed to save terminal settings:', error)
    }
  }

  const updateAppearanceSettings = async (settings: Partial<AppearanceSettings>) => {
    const newSettings = { ...appearanceSettings, ...settings }
    setAppearanceSettings(newSettings)

    try {
      const config = await window.api.config.get()

      await window.api.config.set({
        ...config,
        appearanceSettings: newSettings
      })

      // 应用主题
      if (settings.theme !== undefined) {
        applyTheme(settings.theme)

        // 确定实际主题（用于窗口主题）
        const actualTheme =
          newSettings.theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : newSettings.theme

        await window.api.config.updateWindowTheme(actualTheme)
      }

      // 应用界面缩放
      if (settings.uiScale !== undefined) {
        applyUIScale(settings.uiScale)
      }
    } catch (error) {
      console.error('Failed to save appearance settings:', error)
    }
  }

  const updateKeymapSettings = async (settings: Partial<KeymapSettings>) => {
    const newSettings = { ...keymapSettings, ...settings }
    setKeymapSettings(newSettings)

    try {
      const config = await window.api.config.get()
      await window.api.config.set({
        ...config,
        keymapSettings: newSettings
      })
    } catch (error) {
      console.error('Failed to save keymap settings:', error)
    }
  }

  const updateGeneralSettings = async (settings: Partial<GeneralSettings>) => {
    const newSettings = { ...generalSettings, ...settings }
    setGeneralSettings(newSettings)

    try {
      const config = await window.api.config.get()
      await window.api.config.set({
        ...config,
        language: newSettings.language,
        preferences: {
          autoSave: newSettings.autoSave,
          debugMode: newSettings.debugMode,
          autoRunMode: newSettings.autoRunMode,
          commandWhitelist: newSettings.commandWhitelist,
          enableFilePreviewOnSingleClick: newSettings.enableFilePreviewOnSingleClick,
          openProjectBehavior: newSettings.openProjectBehavior,
          sidebarCollapsed: config.preferences?.sidebarCollapsed ?? false
        }
      })
    } catch (error) {
      console.error('Failed to save general settings:', error)
    }
  }

  const reloadSettings = async () => {
    await loadSettings()
  }

  return (
    <SettingsContext.Provider
      value={{
        editorOptions,
        terminalSettings,
        appearanceSettings,
        keymapSettings,
        generalSettings,
        skillsSettings,
        filesExclude,
        updateEditorOptions,
        updateTerminalSettings,
        updateAppearanceSettings,
        updateKeymapSettings,
        updateGeneralSettings,
        reloadSettings
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export type { TerminalSettings, AppearanceSettings, KeymapSettings, GeneralSettings, FilesExclude }
export type { AutoRunMode }
