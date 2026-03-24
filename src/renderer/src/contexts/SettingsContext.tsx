import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface EditorSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
  lineNumbers: boolean
  gitBlame: boolean
}

interface TerminalSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
  /** 终端使用的 shell 可执行路径，留空则用系统默认 */
  shell?: string
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

interface GeneralSettings {
  language: string
  autoSave: boolean
  debugMode: boolean
  telemetry: boolean
}

interface SettingsContextType {
  editorSettings: EditorSettings
  terminalSettings: TerminalSettings
  appearanceSettings: AppearanceSettings
  keymapSettings: KeymapSettings
  generalSettings: GeneralSettings
  updateEditorSettings: (settings: Partial<EditorSettings>) => Promise<void>
  updateTerminalSettings: (settings: Partial<TerminalSettings>) => Promise<void>
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => Promise<void>
  updateKeymapSettings: (settings: Partial<KeymapSettings>) => Promise<void>
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => Promise<void>
  reloadSettings: () => Promise<void>
}

const defaultEditorSettings: EditorSettings = {
  fontSize: 14,
  fontFamily: 'Monaco',
  lineHeight: 1.5,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  lineNumbers: true,
  gitBlame: true
}

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
  telemetry: true
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(defaultEditorSettings)
  const [terminalSettings, setTerminalSettings] =
    useState<TerminalSettings>(defaultTerminalSettings)
  const [appearanceSettings, setAppearanceSettings] =
    useState<AppearanceSettings>(defaultAppearanceSettings)
  const [keymapSettings, setKeymapSettings] = useState<KeymapSettings>(defaultKeymapSettings)
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(defaultGeneralSettings)

  const loadSettings = async () => {
    try {
      const config = await window.api.config.get()
      const preferences = await window.api.config.getPreferences()

      if (config.editorSettings) {
        setEditorSettings({ ...defaultEditorSettings, ...config.editorSettings })
      }

      if (config.terminalSettings) {
        setTerminalSettings({ ...defaultTerminalSettings, ...config.terminalSettings })
      }

      if (config.keymapSettings) {
        setKeymapSettings({ ...defaultKeymapSettings, ...config.keymapSettings })
      }

      const theme: 'light' | 'dark' | 'system' =
        config.appearanceSettings?.theme ??
        (() => {
          const saved = localStorage.getItem('circle-theme-preference')
          return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
        })()

      const appearanceSettings = {
        ...defaultAppearanceSettings,
        ...config.appearanceSettings,
        theme
      }
      setAppearanceSettings(appearanceSettings)

      setGeneralSettings({
        language: config.language || 'zh-CN',
        autoSave: preferences.autoSave ?? true,
        debugMode: preferences.debugMode ?? false,
        telemetry: preferences.telemetry ?? true
      })

      // 应用界面缩放
      if (appearanceSettings.uiScale) {
        applyUIScale(appearanceSettings.uiScale)
      }

      // 应用主题
      applyTheme(theme)
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

  // 监听缩放快捷键
  useEffect(() => {
    const handleZoomShortcut = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Alt + = 放大
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        const currentScale = appearanceSettings.uiScale
        const scales = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5]
        const currentIndex = scales.findIndex((s) => s >= currentScale)
        const nextIndex = Math.min(currentIndex + 1, scales.length - 1)
        if (nextIndex !== currentIndex) {
          updateAppearanceSettings({ uiScale: scales[nextIndex] })
        }
      }
      // Cmd/Ctrl + Alt + - 缩小
      else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === '-') {
        e.preventDefault()
        const currentScale = appearanceSettings.uiScale
        const scales = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5]
        const currentIndex = scales.findIndex((s) => s >= currentScale)
        const prevIndex = Math.max(currentIndex - 1, 0)
        if (prevIndex !== currentIndex) {
          updateAppearanceSettings({ uiScale: scales[prevIndex] })
        }
      }
      // Cmd/Ctrl + Alt + 0 重置为 100%
      else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === '0') {
        e.preventDefault()
        updateAppearanceSettings({ uiScale: 1.0 })
      }
    }

    window.addEventListener('keydown', handleZoomShortcut)
    return () => window.removeEventListener('keydown', handleZoomShortcut)
  }, [appearanceSettings.uiScale])

  const updateEditorSettings = async (settings: Partial<EditorSettings>) => {
    const newSettings = { ...editorSettings, ...settings }
    setEditorSettings(newSettings)

    try {
      const config = await window.api.config.get()
      await window.api.config.set({
        ...config,
        editorSettings: newSettings
      })
    } catch (error) {
      console.error('Failed to save editor settings:', error)
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

      // 确定实际主题（用于保存到配置）
      let actualTheme: 'light' | 'dark' = 'dark'
      if (newSettings.theme === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } else {
        actualTheme = newSettings.theme
      }

      await window.api.config.set({
        ...config,
        theme: actualTheme,
        appearanceSettings: newSettings
      })

      // 应用主题
      if (settings.theme !== undefined) {
        applyTheme(settings.theme)
        await window.api.config.setTheme(actualTheme)
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
          telemetry: newSettings.telemetry,
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
        editorSettings,
        terminalSettings,
        appearanceSettings,
        keymapSettings,
        generalSettings,
        updateEditorSettings,
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

export type {
  EditorSettings,
  TerminalSettings,
  AppearanceSettings,
  KeymapSettings,
  GeneralSettings
}
