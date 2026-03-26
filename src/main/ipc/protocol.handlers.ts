import { app } from 'electron'
import { getMainWindow } from '../utils/ipc'

const SCHEME = 'circle'

/**
 * 注册自定义协议处理器
 */
export function registerProtocolHandlers() {
  // 开发模式需要指定可执行文件路径
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [process.argv[1]])
    }
  } else {
    app.setAsDefaultProtocolClient(SCHEME)
  }

  // macOS: 通过 open-url 事件处理协议唤起
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })

  // Windows/Linux: 通过 second-instance 事件处理协议唤起
  app.on('second-instance', (_, argv) => {
    const urlArg = argv.find((arg) => arg.startsWith(`${SCHEME}://`))
    if (urlArg) {
      handleProtocolUrl(urlArg)
    }
  })

  // Windows: 处理应用启动时的协议 URL
  if (process.platform === 'win32') {
    const urlArg = process.argv.find((arg) => arg.startsWith(`${SCHEME}://`))
    if (urlArg) {
      handleProtocolUrl(urlArg)
    }
  }
}

/**
 * 处理协议 URL
 * @param url - 完整的协议 URL，格式: circle://...
 */
function handleProtocolUrl(url: string) {
  console.log('[Protocol] Received URL:', url)

  try {
    const parsed = new URL(url)
    console.log('[Protocol] Parsed URL:', parsed.hostname, parsed.pathname)

    // 可以在这里添加其他协议处理逻辑
    // 当前只是占位，实际功能待实现

    // 聚焦主窗口
    focusMainWindow()
  } catch (error) {
    console.error('[Protocol] Error handling URL:', error)
  }
}

/**
 * 聚焦主窗口
 */
function focusMainWindow() {
  const mainWin = getMainWindow()
  if (mainWin) {
    if (mainWin.isMinimized()) {
      mainWin.restore()
    }
    mainWin.focus()
  }
}
