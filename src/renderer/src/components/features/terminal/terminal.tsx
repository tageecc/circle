/**
 * Terminal 组件
 *
 * 关键问题：切换 tab 时的闪烁
 *
 * 根本原因：
 * - terminal-panel 使用 CSS `hidden` 类隐藏非活动 tab，但所有 Terminal 组件都会挂载
 * - 当 terminal 在隐藏状态下初始化时，容器的 getBoundingClientRect().width === 0
 * - 如果此时调用 fitAddon.fit()，会基于 0 宽度计算出错误的 cols/rows
 * - 切换 tab 显示时，xterm 已有错误尺寸，需要重新 fit，导致内容闪烁
 *
 * 解决方案：
 * 1. 设置合理的初始 cols/rows（基于 300px 估算），确保即使容器被隐藏也有合理尺寸
 * 2. 所有 fit 调用都必须检查容器宽度 > 0，避免基于 0 宽度计算
 * 3. 如果容器不可见，延迟 fit 直到下一个渲染周期（通常是 ResizeObserver 触发）
 */
import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useSettings } from '@/contexts/settings-context'
import { darkTheme, lightTheme, useActualTheme } from './terminal-theme'

interface TerminalProps {
  terminalId: string
  onReady?: () => void
}

export function Terminal({ terminalId, onReady }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const onReadyRef = useRef(onReady)
  const { appearanceSettings, terminalSettings } = useSettings()

  // 更新 onReady 引用（避免作为 useEffect 依赖）
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  // 使用自定义 hook 追踪实际主题
  const actualTheme = useActualTheme(appearanceSettings.theme)

  /**
   * 安全的 fit 函数：只在容器有有效宽度时才执行 fit
   * 使用 useCallback 避免每次渲染都重新创建
   */
  const safeFit = useCallback(() => {
    if (!fitAddonRef.current || !terminalRef.current) return

    const rect = terminalRef.current.getBoundingClientRect()
    if (rect.width > 0) {
      fitAddonRef.current.fit()
      const dimensions = fitAddonRef.current.proposeDimensions()
      if (dimensions) {
        window.api.terminal.resize(terminalId, dimensions.cols, dimensions.rows)
      }
    }
  }, [terminalId])

  // 初始化终端（只在 terminalId 改变时重新创建）
  useEffect(() => {
    if (!terminalRef.current) return

    const theme = actualTheme === 'dark' ? darkTheme : lightTheme
    const fontSize = terminalSettings.fontSize || 14
    // 计算初始 cols（基于 300px 宽度，避免容器宽度为 0 时计算错误）
    const initialCols = Math.floor(300 / (fontSize * 0.6)) || 80
    const initialRows = 24

    const xterm = new XTerm({
      fontFamily: terminalSettings.fontFamily || 'Monaco',
      fontSize,
      lineHeight: terminalSettings.lineHeight || 1.2,
      cursorBlink: terminalSettings.cursorBlink !== undefined ? terminalSettings.cursorBlink : true,
      cursorStyle: terminalSettings.cursorStyle || 'block',
      theme,
      allowProposedApi: true,
      cols: initialCols,
      rows: initialRows
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    xterm.open(terminalRef.current)

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // 初始化后立即尝试 fit（如果容器可见）
    // 如果容器被隐藏，ResizeObserver 会在容器显示时自动触发
    safeFit()

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

    // ResizeObserver 会在容器尺寸变化时触发（包括从隐藏到显示）
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = setTimeout(() => {
        safeFit()
      }, 50)
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // 延迟回调确保终端就绪
    // 注意：不需要再次 safeFit，ResizeObserver 会处理尺寸变化
    setTimeout(() => {
      onReadyRef.current?.()
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
  }, [terminalId])

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
    safeFit()
  }, [
    safeFit,
    terminalSettings.fontFamily,
    terminalSettings.fontSize,
    terminalSettings.lineHeight,
    terminalSettings.cursorBlink,
    terminalSettings.cursorStyle
  ])

  // 动态更新主题（actualTheme 已经处理了 system 模式和系统主题变化监听）
  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.theme = actualTheme === 'dark' ? darkTheme : lightTheme
  }, [actualTheme])

  const bgColor = actualTheme === 'dark' ? darkTheme.background : lightTheme.background

  return (
    <div
      ref={terminalRef}
      className="h-full w-full overflow-hidden"
      style={{ padding: '8px', backgroundColor: bgColor }}
    />
  )
}
