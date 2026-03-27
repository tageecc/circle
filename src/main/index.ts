import 'dotenv/config'

import { app, shell, BrowserWindow, nativeTheme, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDb } from './database/db'
import { registerIpcHandlers } from './ipc/handlers'
import { registerCompletionHandlers } from './ipc/completion.handlers'
import { registerMCPHandlers } from './ipc/mcp.handlers'
import { registerSkillsHandlers } from './ipc/skills.handlers'
import { FileWatcherService } from './services/file-watcher.service'
import { GitWatcherService } from './services/git-watcher.service'
import { ConfigService } from './services/config.service'
import { WindowStateManager } from './services/window-state.service'
import { AvatarService } from './services/avatar.service'
import { MenuService } from './services/menu.service'
import { initMainI18n } from './i18n'
const i18nextBackend = require('i18next-electron-fs-backend')
import * as fs from 'fs'

// 全局配置服务实例（在应用启动时初始化）
let configService: ConfigService
let mainWindow: BrowserWindow | null = null
let menuService: MenuService | null = null
let isQuitting = false // 标志：是否正在退出应用（用于区分关闭窗口和退出应用）

export function getConfigService(): ConfigService {
  if (!configService) {
    throw new Error('ConfigService has not been initialized yet')
  }
  return configService
}

export function rebuildApplicationMenu(): void {
  menuService?.createMenu()
}

// 根据主题获取窗口背景色
function getWindowBackgroundColor(isDark: boolean): string {
  // One Dark Pro 配色
  return isDark ? '#282c34' : '#fafafa'
}

// 更新窗口主题
function updateWindowTheme(isDark: boolean): void {
  if (!mainWindow) return

  const backgroundColor = getWindowBackgroundColor(isDark)
  mainWindow.setBackgroundColor(backgroundColor)
}

function createWindow(): void {
  // 获取保存的窗口状态
  const windowState = configService.getWindowState()

  // 获取保存的主题并应用到 nativeTheme
  const savedTheme = configService.getTheme()
  nativeTheme.themeSource = savedTheme
  const isDark = nativeTheme.shouldUseDarkColors

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    show: false,
    autoHideMenuBar: false, // 显示原生菜单
    minWidth: 800,
    minHeight: 600,
    backgroundColor: getWindowBackgroundColor(isDark),
    // macOS: 隐藏标题栏，使用 inset 模式红绿灯
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 12, y: 10 }
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 初始化原生菜单
  menuService = new MenuService(configService)
  menuService.createMenu()

  // 初始化 i18n backend bindings
  i18nextBackend.mainBindings(ipcMain, mainWindow, fs)

  // 初始化窗口状态管理器
  const windowStateManager = new WindowStateManager(mainWindow, configService)
  windowStateManager.initialize()

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()

    // 检查是否有当前打开的项目，如果有则启动 FileWatcher 和 GitWatcher
    const currentProject = configService.getCurrentProject()
    if (currentProject && mainWindow) {
      console.log(`🎯 Auto-starting FileWatcher for current project: ${currentProject}`)
      FileWatcherService.startWatching(currentProject, mainWindow)

      // ⭐ 启动Git监听器（监听.git目录的关键文件）
      GitWatcherService.startWatching(currentProject)
    }
  })

  // ⭐ 监听全屏状态变化（macOS 优化：全屏时移除红绿灯预留空间）
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', true)
  })

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 拦截窗口关闭事件
  mainWindow.on('close', (event) => {
    // 如果正在退出应用（Cmd+Q 或菜单退出），允许关闭
    if (isQuitting) {
      return
    }

    const currentProject = configService.getCurrentProject()

    // 如果有打开的项目，阻止窗口关闭，改为关闭项目
    if (currentProject && mainWindow) {
      event.preventDefault()
      console.log('🔄 Intercepting window close, closing project instead...')
      mainWindow.webContents.send('menu:close-workspace', {})
    } else {
      // 如果没有项目（在欢迎页），退出应用
      console.log('🔄 No project open, quitting application...')
      app.quit()
    }
  })

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    windowStateManager.destroy()
    mainWindow = null
  })

  // ⭐ 窗口失焦时暂停所有监听（节省资源）
  mainWindow.on('blur', () => {
    GitWatcherService.pause()
    FileWatcherService.pause()
  })

  // ⭐ 窗口获得焦点时恢复所有监听并立即同步
  mainWindow.on('focus', () => {
    GitWatcherService.resume()
    FileWatcherService.resume()
  })

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors
    updateWindowTheme(isDark)
  })

  // 监听渲染进程的主题切换请求
  ipcMain.handle('theme:update', (_event, theme: 'light' | 'dark' | 'system') => {
    if (theme === 'system') {
      nativeTheme.themeSource = 'system'
    } else {
      nativeTheme.themeSource = theme
    }
    updateWindowTheme(nativeTheme.shouldUseDarkColors)
  })
}

// Initialize first launch data
function initializeFirstLaunch(): void {
  const db = getDb()
  const isFirstLaunch = !db.getConfig('app_initialized', false)
  
  if (isFirstLaunch) {
    console.log('🎉 First launch detected, initializing default data...')
    
    db.addUserRule('rule_default_zh', 'Always respond in 中文')
    
    // 初始化默认的 files.exclude 规则
    const defaultFilesExclude = {
      '**/.git': true,
      '**/.svn': true,
      '**/.hg': true,
      '**/CVS': true,
      '**/.DS_Store': true,
      '**/Thumbs.db': true
    }
    for (const [pattern, enabled] of Object.entries(defaultFilesExclude)) {
      db.setFilesExclude(pattern, enabled)
    }
    
    db.setConfig('app_initialized', true)
    
    console.log('✅ First launch initialization completed')
  }
}

// Initialize backend services
async function initializeBackend(): Promise<boolean> {
  console.log('🚀 Initializing Circle backend...')

  try {
    getDb()
    console.log('✅ Database initialized')

    // Initialize first launch data
    initializeFirstLaunch()

    // Initialize config service (uses SQLite)
    configService = new ConfigService()

    await initMainI18n(configService)

    // Initialize avatar service
    await AvatarService.initialize()

    // Register IPC handlers (must be after configService is initialized)
    console.log('🔄 Registering IPC handlers...')
    registerIpcHandlers()
    console.log('✅ Main IPC handlers registered')

    // Register completion handlers
    console.log('🔄 Registering completion handlers...')
    registerCompletionHandlers(configService)
    console.log('✅ Completion handlers registered')

    // Register MCP handlers
    console.log('🔄 Registering MCP handlers...')
    registerMCPHandlers()
    console.log('✅ MCP handlers registered')

    // Register Skills handlers
    console.log('🔄 Registering Skills handlers...')
    registerSkillsHandlers()
    console.log('✅ Skills handlers registered')

    console.log('✅ Backend initialized successfully')
    return true
  } catch (error) {
    console.error('❌ Backend initialization failed:', error)
    console.error('Stack trace:', error)
    return false
  }
}

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Initialize backend
    const backendInitialized = await initializeBackend()

    if (!backendInitialized) {
      console.error('❌ Backend initialization failed, application cannot start')
      app.quit()
      return
    }

    // Register Protocol Handlers
    const { registerProtocolHandlers } = await import('./ipc/protocol.handlers')
    registerProtocolHandlers()

    createWindow()

    // Auto-connect MCP servers (延迟 500ms，避免启动时资源竞争)
    setTimeout(async () => {
      try {
        const { MCPService } = await import('./services/mcp.service')
        const mcpService = MCPService.getInstance()
        await mcpService.autoConnectServers()
      } catch (error) {
        console.error('[MCP] Auto-connect failed:', error)
      }
    }, 500)

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

// 添加详细日志追踪退出流程（带绝对时间戳）
let quitStartTime = 0

function logWithTime(msg: string): void {
  const now = new Date()
  const timestamp = now.toISOString().split('T')[1].slice(0, -1) // HH:MM:SS.mmm
  const relative = quitStartTime ? `+${Date.now() - quitStartTime}ms` : ''
  console.log(`[${timestamp}] ${msg} ${relative}`)
}

app.on('before-quit', () => {
  isQuitting = true // 标记正在退出应用
  if (quitStartTime === 0) {
    quitStartTime = Date.now()
    logWithTime('📍 [Quit] before-quit triggered')
  }
})

app.on('will-quit', async (event) => {
  logWithTime('📍 [Quit] will-quit triggered')

  event.preventDefault()

  // ✅ 记录所有活跃的句柄
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logWithTime(
    `🔍 [Quit] Active handles: ${(process as any)._getActiveHandles?.().length || 'unknown'}`
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logWithTime(
    `🔍 [Quit] Active requests: ${(process as any)._getActiveRequests?.().length || 'unknown'}`
  )

  const { BrowserWindow } = await import('electron')
  const allWindows = BrowserWindow.getAllWindows()

  // ⭐ 1. 保存所有 dirty 文件（在销毁窗口之前）
  logWithTime('🔄 [Quit] Saving all dirty files...')
  if (allWindows.length > 0) {
    try {
      // ✅ 修复：正确的超时实现
      // 发送保存请求到 renderer 进程，最多等待 500ms
      allWindows[0].webContents.send('app:save-all-before-quit')
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
      logWithTime('✅ [Quit] Dirty files saved (waited 500ms)')
    } catch {
      logWithTime('⚠️ [Quit] Failed to save dirty files, continuing...')
    }
  } else {
    logWithTime('⚠️ [Quit] No windows available to save files')
  }

  // ✅ 2. 强制关闭所有窗口（包括 DevTools）
  logWithTime('🔄 [Quit] Destroying all windows...')
  logWithTime(`🔍 [Quit] Found ${allWindows.length} window(s)`)
  allWindows.forEach((win, index) => {
    logWithTime(`🔄 [Quit] Destroying window ${index + 1}...`)
    try {
      win.destroy()
    } catch {
      logWithTime(`❌ [Quit] Failed to destroy window ${index + 1}`)
    }
  })
  logWithTime('✅ [Quit] All windows destroyed')

  // ✅ 3. 关闭数据库
  logWithTime('🔄 [Quit] Closing database...')
  getDb().close()
  logWithTime('✅ [Quit] Database closed')

  // ✅ 4. 移除所有 IPC 监听器
  logWithTime('🔄 [Quit] Removing all IPC handlers...')
  const { ipcMain } = await import('electron')
  ipcMain.removeAllListeners()
  logWithTime('✅ [Quit] IPC handlers removed')

  // ✅ 5. 停止所有文件监听器（关键！）
  logWithTime('🔄 [Quit] Stopping file watchers...')
  try {
    const { FileWatcherService } = await import('./services/file-watcher.service')
    await FileWatcherService.stopAllWatching()
    logWithTime('✅ [Quit] File watchers stopped')
  } catch {
    logWithTime('❌ [Quit] Failed to stop file watchers')
  }

  // ✅ 6. 停止Git监听器
  logWithTime('🔄 [Quit] Stopping Git watchers...')
  try {
    GitWatcherService.stopAllWatching()
    logWithTime('✅ [Quit] Git watchers stopped')
  } catch {
    logWithTime('❌ [Quit] Failed to stop Git watchers')
  }

  // ✅ 7. 最终检查并打印句柄类型
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handles = (process as any)._getActiveHandles?.() || []
  logWithTime(`🔍 [Quit] Final check - Active handles: ${handles.length}`)

  // 统计句柄类型
  const handleTypes = new Map<string, number>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handles.forEach((handle: any) => {
    const type = handle?.constructor?.name || 'Unknown'
    handleTypes.set(type, (handleTypes.get(type) || 0) + 1)
  })

  logWithTime('🔍 [Quit] Handle types:')
  handleTypes.forEach((count, type) => {
    logWithTime(`  - ${type}: ${count}`)
  })

  // ✅ 8. 优雅退出
  logWithTime('🔄 [Quit] Exiting gracefully...')
  app.exit(0)
})

app.on('quit', () => {
  logWithTime('📍 [Quit] quit event')
})

app.on('window-all-closed', () => {
  logWithTime('📍 [Quit] window-all-closed triggered')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 监听进程退出
process.on('exit', (code) => {
  logWithTime(`📍 [Quit] Process EXIT with code ${code}`)
})

// 添加更多进程事件监听
process.on('beforeExit', (code) => {
  logWithTime(`📍 [Quit] Process BEFORE-EXIT with code ${code}`)
})
