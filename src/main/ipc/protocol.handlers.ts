import { app, BrowserWindow } from 'electron'

const SCHEME = 'circle'

/**
 * 注册自定义协议处理器（circle://）
 * 用于应用被 URL 唤起时聚焦主窗口，无业务逻辑。
 */
export function registerProtocolHandlers() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [process.argv[1]])
    }
  } else {
    app.setAsDefaultProtocolClient(SCHEME)
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (url.startsWith(`${SCHEME}://`)) {
      focusMainWindow()
    }
  })

  app.on('second-instance', (_, argv) => {
    const urlArg = argv.find((arg) => arg.startsWith(`${SCHEME}://`))
    if (urlArg) focusMainWindow()
  })

  if (process.platform === 'win32') {
    const urlArg = process.argv.find((arg) => arg.startsWith(`${SCHEME}://`))
    if (urlArg) focusMainWindow()
  }
}

function focusMainWindow() {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    const mainWin = wins[0]
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.focus()
  }
}
