import { useEffect, useState } from 'react'

/**
 * Terminal 主题配置（暗色）
 */
export const darkTheme = {
  background: '#282c34',
  foreground: '#abb2bf',
  cursor: '#528bff',
  black: '#282c34',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff'
}

/**
 * Terminal 主题配置（亮色）
 */
export const lightTheme = {
  background: '#fafafa',
  foreground: '#383a42',
  cursor: '#526fff',
  black: '#383a42',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#0184bc',
  magenta: '#a626a4',
  cyan: '#0997b3',
  white: '#fafafa',
  brightBlack: '#4f525e',
  brightRed: '#e45649',
  brightGreen: '#50a14f',
  brightYellow: '#c18401',
  brightBlue: '#0184bc',
  brightMagenta: '#a626a4',
  brightCyan: '#0997b3',
  brightWhite: '#ffffff'
}

/**
 * 自定义 Hook：追踪实际主题（处理 system 模式并监听系统变化）
 */
export function useActualTheme(themeSetting: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  const getTheme = (): 'light' | 'dark' => {
    if (themeSetting === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeSetting
  }

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(getTheme)

  useEffect(() => {
    setActualTheme(getTheme())

    if (themeSetting !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setActualTheme(mediaQuery.matches ? 'dark' : 'light')

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeSetting])

  return actualTheme
}
