import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { ConfigService } from './config.service'

/**
 * 窗口管理服务
 * 负责创建和管理多个窗口实例
 */
export class WindowService {
  private static windows: Set<BrowserWindow> = new Set()

  /**
   * 创建新窗口并打开指定项目
   */
  static createWindow(projectPath: string | null, configService: ConfigService): BrowserWindow {
    const windowState = configService.getWindowState()

    const newWindow = new BrowserWindow({
      width: windowState.width,
      height: windowState.height,
      show: false,
      autoHideMenuBar: false,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#282c34',
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
        // 传递项目路径给渲染进程
        additionalArguments: projectPath ? [`--project-path=${projectPath}`] : []
      }
    })

    // 添加到窗口集合
    this.windows.add(newWindow)

    newWindow.on('ready-to-show', () => {
      newWindow.show()
    })

    // 加载应用
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      newWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      newWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 窗口关闭时从集合中移除
    newWindow.on('closed', () => {
      this.windows.delete(newWindow)
    })

    return newWindow
  }

  /**
   * 获取所有打开的窗口
   */
  static getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows)
  }

  /**
   * 关闭所有窗口
   */
  static closeAllWindows(): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close()
      }
    })
    this.windows.clear()
  }
}
