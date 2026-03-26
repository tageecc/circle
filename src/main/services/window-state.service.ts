import { BrowserWindow, screen } from 'electron'
import { ConfigService, WindowState } from './config.service'

/**
 * 窗口状态管理器
 * 负责自动保存和恢复窗口的位置、大小、最大化等状态
 */
export class WindowStateManager {
  private window: BrowserWindow
  private configService: ConfigService
  private saveTimer: NodeJS.Timeout | null = null
  private readonly SAVE_DEBOUNCE_MS = 500 // 防抖延迟

  constructor(window: BrowserWindow, configService: ConfigService) {
    this.window = window
    this.configService = configService
  }

  /**
   * 初始化窗口状态管理
   * 恢复保存的窗口状态并监听窗口事件
   */
  initialize(): void {
    this.restoreWindowState()
    this.attachWindowListeners()
  }

  /**
   * 从配置中恢复窗口状态
   */
  private restoreWindowState(): void {
    const savedState = this.configService.getWindowState()

    // 确保窗口位置在可见屏幕范围内
    const validatedState = this.validateWindowState(savedState)

    // 设置窗口大小和位置
    if (validatedState.x !== undefined && validatedState.y !== undefined) {
      this.window.setBounds({
        x: validatedState.x,
        y: validatedState.y,
        width: validatedState.width,
        height: validatedState.height
      })
    } else {
      // 如果没有保存的位置，居中显示
      this.window.setSize(validatedState.width, validatedState.height)
      this.window.center()
    }

    // 恢复最大化状态
    if (validatedState.isMaximized) {
      this.window.maximize()
    }

    // 恢复全屏状态
    if (validatedState.isFullScreen) {
      this.window.setFullScreen(true)
    }
  }

  /**
   * 验证窗口状态，确保窗口在可见屏幕范围内
   */
  private validateWindowState(state: WindowState): WindowState {
    // 获取所有显示器的工作区
    const displays = screen.getAllDisplays()

    // 如果有保存的位置，检查是否在任何显示器范围内
    if (state.x !== undefined && state.y !== undefined) {
      const isVisible = displays.some((display) => {
        const { x, y, width, height } = display.workArea
        return (
          state.x! >= x &&
          state.y! >= y &&
          state.x! + state.width <= x + width &&
          state.y! + state.height <= y + height
        )
      })

      // 如果不在可见范围内，清除位置信息（让窗口居中）
      if (!isVisible) {
        return {
          ...state,
          x: undefined,
          y: undefined
        }
      }
    }

    // 确保窗口尺寸不会太小
    const minWidth = 800
    const minHeight = 600

    return {
      ...state,
      width: Math.max(state.width, minWidth),
      height: Math.max(state.height, minHeight)
    }
  }

  /**
   * 监听窗口事件并自动保存状态
   */
  private attachWindowListeners(): void {
    // 监听窗口大小变化
    this.window.on('resize', () => {
      if (!this.window.isMaximized() && !this.window.isFullScreen()) {
        this.debouncedSaveWindowState()
      }
    })

    // 监听窗口移动
    this.window.on('move', () => {
      if (!this.window.isMaximized() && !this.window.isFullScreen()) {
        this.debouncedSaveWindowState()
      }
    })

    // 监听最大化状态
    this.window.on('maximize', () => {
      this.saveWindowState({ isMaximized: true })
    })

    this.window.on('unmaximize', () => {
      this.saveWindowState({ isMaximized: false })
    })

    // 监听全屏状态
    this.window.on('enter-full-screen', () => {
      this.saveWindowState({ isFullScreen: true })
    })

    this.window.on('leave-full-screen', () => {
      this.saveWindowState({ isFullScreen: false })
    })

    // 监听窗口关闭，添加详细日志
    this.window.on('close', () => {
      const now = new Date().toISOString().split('T')[1].slice(0, -1)
      const startTime = Date.now()
      console.log(`[${now}] 🪟 [WindowState] Window closing, saving state...`)
      this.cancelDebounce()
      try {
        this.saveCurrentWindowState()
        console.log(`[${now}] ✅ [WindowState] State saved in ${Date.now() - startTime}ms`)
      } catch (error) {
        console.error(`[${now}] ❌ [WindowState] Failed to save state:`, error)
      }
    })
  }

  /**
   * 防抖保存窗口状态
   */
  private debouncedSaveWindowState(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveCurrentWindowState()
    }, this.SAVE_DEBOUNCE_MS)
  }

  /**
   * 取消防抖定时器
   */
  private cancelDebounce(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
  }

  /**
   * 保存当前窗口状态
   */
  private saveCurrentWindowState(): void {
    // 如果窗口被销毁了，不保存
    if (this.window.isDestroyed()) {
      return
    }

    const bounds = this.window.getBounds()
    const isMaximized = this.window.isMaximized()
    const isFullScreen = this.window.isFullScreen()

    this.saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
      isFullScreen
    })
  }

  /**
   * 保存窗口状态到配置（快速，不阻塞）
   */
  private saveWindowState(state: Partial<WindowState>): void {
    try {
      this.configService.setWindowState(state)
    } catch (error) {
      // 静默失败，不阻塞退出
      console.error('[WindowState] Failed to save:', error)
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.cancelDebounce()
  }
}
