import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'

export class FileWatcherService {
  private static watchers: Map<string, FSWatcher> = new Map()

  /**
   * 开始监听项目目录
   */
  static startWatching(projectPath: string, window: BrowserWindow): void {
    // 如果已经在监听，先停止
    this.stopWatching(projectPath)

    const watcher = chokidar.watch(projectPath, {
      ignored: [
        /(^|[\/\\])\../, // 隐藏文件
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /out/,
        /\.next/,
        /\.vscode/,
        /\.idea/,
        /pnpm-lock\.yaml/,
        /package-lock\.json/,
        /yarn\.lock/
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    watcher
      .on('add', (path) => {
        console.log(`File added: ${path}`)
        window.webContents.send('file:changed', {
          type: 'add',
          path
        })
      })
      .on('change', (path) => {
        console.log(`File changed: ${path}`)
        window.webContents.send('file:changed', {
          type: 'change',
          path
        })
      })
      .on('unlink', (path) => {
        console.log(`File removed: ${path}`)
        window.webContents.send('file:changed', {
          type: 'unlink',
          path
        })
      })
      .on('addDir', (path) => {
        console.log(`Directory added: ${path}`)
        window.webContents.send('file:changed', {
          type: 'addDir',
          path
        })
      })
      .on('unlinkDir', (path) => {
        console.log(`Directory removed: ${path}`)
        window.webContents.send('file:changed', {
          type: 'unlinkDir',
          path
        })
      })
      .on('error', (error) => {
        console.error(`Watcher error: ${error}`)
      })

    this.watchers.set(projectPath, watcher)
    console.log(`Started watching: ${projectPath}`)
  }

  /**
   * 停止监听项目目录
   */
  static async stopWatching(projectPath: string): Promise<void> {
    const watcher = this.watchers.get(projectPath)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(projectPath)
      console.log(`Stopped watching: ${projectPath}`)
    }
  }

  /**
   * 停止所有监听
   */
  static async stopAllWatching(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const [projectPath, watcher] of this.watchers.entries()) {
      promises.push(watcher.close())
      this.watchers.delete(projectPath)
      console.log(`Stopped watching: ${projectPath}`)
    }
    await Promise.all(promises)
  }
}
