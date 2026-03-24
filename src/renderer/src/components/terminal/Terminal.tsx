import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useSettings } from '../../contexts/SettingsContext'

interface TerminalProps {
  terminalId: string
  onReady?: () => void
}

const darkTheme = {
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

const lightTheme = {
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

export function Terminal({ terminalId, onReady }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { appearanceSettings, terminalSettings } = useSettings()

  // 初始化终端（只在 terminalId 改变时重新创建）
  useEffect(() => {
    if (!terminalRef.current) return

    const theme = appearanceSettings.theme === 'dark' ? darkTheme : lightTheme
    const xterm = new XTerm({
      fontFamily: terminalSettings.fontFamily || 'Monaco',
      fontSize: terminalSettings.fontSize || 14,
      lineHeight: terminalSettings.lineHeight || 1.2,
      cursorBlink: terminalSettings.cursorBlink !== undefined ? terminalSettings.cursorBlink : true,
      cursorStyle: terminalSettings.cursorStyle || 'block',
      theme,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    xterm.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    xterm.onData((data) => {
      window.api.terminal.write(terminalId, data)
    })

    const cleanupData = window.api.terminal.onData((event) => {
      if (event.terminalId === terminalId) {
        xterm.write(event.data)
      }
    })

    const cleanupExit = window.api.terminal.onExit((event) => {
      if (event.terminalId === terminalId) {
        xterm.write('\r\n\x1b[1;31m[Process exited with code ' + event.exitCode + ']\x1b[0m\r\n')
      }
    })

    let resizeTimeout: NodeJS.Timeout | null = null

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit()
        const dimensions = fitAddonRef.current.proposeDimensions()
        if (dimensions) {
          window.api.terminal.resize(terminalId, dimensions.cols, dimensions.rows)
        }
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = setTimeout(() => {
        handleResize()
      }, 50)
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    setTimeout(() => {
      handleResize()
      onReady?.()
    }, 100)

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver.disconnect()
      cleanupData()
      cleanupExit()
      xterm.dispose()
    }
  }, [terminalId, onReady])

  // 动态更新终端设置
  useEffect(() => {
    if (!xtermRef.current) return

    const xterm = xtermRef.current

    // 更新字体设置
    if (terminalSettings.fontFamily) {
      xterm.options.fontFamily = terminalSettings.fontFamily
    }
    if (terminalSettings.fontSize) {
      xterm.options.fontSize = terminalSettings.fontSize
    }
    if (terminalSettings.lineHeight) {
      xterm.options.lineHeight = terminalSettings.lineHeight
    }

    // 更新光标设置
    if (terminalSettings.cursorBlink !== undefined) {
      xterm.options.cursorBlink = terminalSettings.cursorBlink
    }
    if (terminalSettings.cursorStyle) {
      xterm.options.cursorStyle = terminalSettings.cursorStyle
    }

    // 重新调整大小以应用字体变化
    if (fitAddonRef.current) {
      fitAddonRef.current.fit()
      const dimensions = fitAddonRef.current.proposeDimensions()
      if (dimensions) {
        window.api.terminal.resize(terminalId, dimensions.cols, dimensions.rows)
      }
    }
  }, [
    terminalId,
    terminalSettings.fontFamily,
    terminalSettings.fontSize,
    terminalSettings.lineHeight,
    terminalSettings.cursorBlink,
    terminalSettings.cursorStyle
  ])

  // 动态更新主题
  useEffect(() => {
    if (!xtermRef.current) return

    const theme = appearanceSettings.theme === 'dark' ? darkTheme : lightTheme
    xtermRef.current.options.theme = theme
  }, [appearanceSettings.theme])

  const bgColor = appearanceSettings.theme === 'dark' ? '#282c34' : '#fafafa'

  return (
    <div
      ref={terminalRef}
      className="h-full w-full overflow-hidden"
      style={{ padding: '8px', backgroundColor: bgColor }}
    />
  )
}
