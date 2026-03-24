import { app, shell, BrowserWindow, nativeTheme, ipcMain } from 'electron'
import { setupNativeMenu } from './menu'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase, closeDatabase } from './database/client'
import { registerIpcHandlers } from './ipc/handlers'
import { AgentService } from './services/agent.service'
import { ToolService } from './services/tool.service'
import { MCPService } from './services/mcp.service'
import { FileWatcherService } from './services/file-watcher.service'
import { ConfigService } from './services/config.service'
import { WindowStateManager } from './services/window-state.service'
import { AvatarService } from './services/avatar.service'
import { createMCPClientManager, type MCPClientManager } from './services/mcp-client.service'

// 全局配置服务实例（在应用启动时初始化）
let configService: ConfigService
let mcpClientManager: MCPClientManager
let mainWindow: BrowserWindow | null = null

// 导出 configService 的 getter，供其他模块使用
export function getConfigService(): ConfigService {
  if (!configService) {
    throw new Error('ConfigService has not been initialized yet')
  }
  return configService
}

// 导出 mcpClientManager 的 getter
export function getMCPClientManager(): MCPClientManager {
  if (!mcpClientManager) {
    throw new Error('MCPClientManager has not been initialized yet')
  }
  return mcpClientManager
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

  // macOS 特殊处理：设置窗口外观
  if (process.platform === 'darwin') {
    // 不使用 vibrancy，直接使用纯色背景
    // 这样标题栏会跟随 nativeTheme 的设置
  }
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
    autoHideMenuBar: true,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: getWindowBackgroundColor(isDark),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 初始化窗口状态管理器
  const windowStateManager = new WindowStateManager(mainWindow, configService)
  windowStateManager.initialize()

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()

    // 检查是否有当前打开的项目，如果有则启动 FileWatcher
    const currentProject = configService.getCurrentProject()
    if (currentProject && mainWindow) {
      console.log(`🎯 Auto-starting FileWatcher for current project: ${currentProject}`)
      FileWatcherService.startWatching(currentProject, mainWindow)
    }
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

  // macOS：使用原生菜单栏，不重复展示窗口内菜单
  setupNativeMenu()

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    windowStateManager.destroy()
    mainWindow = null
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

// Initialize backend services
async function initializeBackend() {
  console.log('🚀 Initializing Circle backend...')

  try {
    configService = new ConfigService()
    const userDataPath = app.getPath('userData')

    const { initMastraMemory, initMastraTraces } = await import('./mastra.config')
    initMastraMemory(userDataPath)
    initMastraTraces(userDataPath)

    const dbConnected = await initDatabase(userDataPath as string)
    if (!dbConnected) {
      console.error('❌ Failed to connect to database')
      return false
    }

    // Initialize avatar service
    await AvatarService.initialize()

    // Initialize default data
    const agentService = new AgentService()
    await agentService.initializeDefaultAgents()
    await ToolService.initializeDefaultTools()
    await MCPService.initializeDefaultServers()

    // Initialize MCP Client Manager
    mcpClientManager = createMCPClientManager()
    console.log('🔌 MCP Client Manager created')

    // Initialize global MCP client in background (non-blocking)
    mcpClientManager
      .initializeGlobalClient()
      .then(() => {
        console.log('✅ MCP Client Manager initialized in background')
      })
      .catch((error) => {
        console.error('❌ Failed to initialize MCP Client Manager:', error)
      })

    // Register IPC handlers (must be after configService is initialized)
    console.log('🔄 Registering IPC handlers...')
    registerIpcHandlers()
    console.log('✅ Main IPC handlers registered')

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
    await initializeBackend()

    // Register Protocol Handlers
    const { registerProtocolHandlers } = await import('./ipc/protocol.handlers')
    registerProtocolHandlers()

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  // Stop all file watchers
  await FileWatcherService.stopAllWatching()

  // Disconnect MCP clients
  if (mcpClientManager) {
    console.log('🔌 Disconnecting MCP clients...')
    await mcpClientManager.disconnect()
  }

  // Close database connection
  await closeDatabase()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
