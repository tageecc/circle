import { FSWatcher, watch } from 'fs'
import { existsSync } from 'fs'
import { BrowserWindow } from 'electron'
import * as path from 'path'
import { sendToRenderer } from '../utils/ipc'

export type FileChangeType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

export interface FileChangeEvent {
  type: FileChangeType
  path: string
}

interface WatcherState {
  watcher: FSWatcher
  pendingChanges: Map<string, FileChangeEvent>
  debounceTimer: NodeJS.Timeout | null
  pausedChanges: Map<string, FileChangeEvent> // 暂停期间的变化
  targetWebContentsIds: Set<number>
}

/**
 * 文件监视服务 - 使用原生 fs.watch 替代 chokidar
 *
 * 设计原则：
 * 1. 使用原生 fs.watch，只创建 1 个监听器（而不是 6825 个）
 * 2. 防抖批量处理 - 收集短时间内的变化，减少 IPC 开销
 * 3. 事件聚合 - 同一文件的多次变化只保留最后一次
 * 4. 快速清理 - 退出时立即释放资源
 */
export class FileWatcherService {
  private static watchers: Map<string, WatcherState> = new Map()
  private static projectByWebContentsId: Map<number, string> = new Map()
  private static readonly DEBOUNCE_DELAY = 300 // 增加防抖延迟，减少触发频率
  private static isPaused = false // 暂停状态（窗口失焦时暂停）

  /** 始终忽略的目录 */
  private static readonly IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    '.hg',
    '.svn',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.vscode',
    '.idea',
    '__pycache__',
    '.cache',
    '.parcel-cache',
    '.turbo',
    'coverage',
    '.nyc_output',
    'tmp',
    'temp',
    '.tmp',
    '.temp',
    'logs'
  ])

  /** 始终忽略的文件 */
  private static readonly IGNORED_FILES = new Set([
    '.DS_Store',
    'Thumbs.db',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock'
  ])

  private static registerWindowCleanup(window: BrowserWindow, projectPath: string): void {
    const targetWebContentsId = window.webContents.id
    window.once('closed', () => {
      void this.stopWatching(projectPath, targetWebContentsId)
    })
  }

  static startWatching(projectPath: string, window: BrowserWindow): void {
    const targetWebContentsId = window.webContents.id
    const previousProject = this.projectByWebContentsId.get(targetWebContentsId)
    if (previousProject && previousProject !== projectPath) {
      void this.stopWatching(previousProject, targetWebContentsId)
    }

    const existingState = this.watchers.get(projectPath)
    if (existingState) {
      existingState.targetWebContentsIds.add(targetWebContentsId)
      this.projectByWebContentsId.set(targetWebContentsId, projectPath)
      this.registerWindowCleanup(window, projectPath)
      return
    }

    console.log(`[FileWatcher] Starting native fs.watch for: ${projectPath}`)

    // ⭐ 使用原生 fs.watch，只创建 1 个监听器
    // recursive: true 会监听所有子目录，但只创建 1 个 FSWatcher
    const watcher = watch(
      projectPath,
      { recursive: true, persistent: true },
      (eventType, filename) => {
        if (!filename) return

        const fullPath = path.join(projectPath, filename)

        // 忽略不需要监听的文件/目录
        if (this.shouldIgnore(fullPath, projectPath)) {
          return
        }

        // ✅ 正确的事件类型映射
        let changeType: FileChangeType
        if (eventType === 'rename') {
          // rename 可能是新增或删除，通过文件是否存在判断
          const exists = existsSync(fullPath)
          changeType = exists ? 'add' : 'unlink'
        } else {
          // change 事件表示文件内容修改
          changeType = 'change'
        }

        this.handleChange(projectPath, changeType, fullPath)
      }
    )

    // ⭐ 关键：让 watcher 不阻止进程退出
    watcher.unref()

    const state: WatcherState = {
      watcher,
      pendingChanges: new Map(),
      debounceTimer: null,
      pausedChanges: new Map(),
      targetWebContentsIds: new Set([targetWebContentsId])
    }

    this.watchers.set(projectPath, state)
    this.projectByWebContentsId.set(targetWebContentsId, projectPath)
    this.registerWindowCleanup(window, projectPath)

    console.log(`[FileWatcher] Native watcher started (1 FSWatcher created)`)
  }

  private static handleChange(
    projectPath: string,
    type: FileChangeType,
    filePath: string
  ): void {
    const state = this.watchers.get(projectPath)
    if (!state) return

    // ⭐ 暂停状态：窗口失焦时只记录，不立即通知
    if (this.isPaused) {
      state.pausedChanges.set(filePath, { type, path: filePath })
      return
    }

    state.pendingChanges.set(filePath, { type, path: filePath })

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }

    state.debounceTimer = setTimeout(() => {
      this.flushChanges(state)
    }, this.DEBOUNCE_DELAY)
  }

  private static flushChanges(state: WatcherState): void {
    if (state.pendingChanges.size === 0) return

    const changes = Array.from(state.pendingChanges.values())
    state.pendingChanges.clear()
    state.debounceTimer = null

    // 批量发送变更事件
    for (const targetWebContentsId of state.targetWebContentsIds) {
      for (const change of changes) {
        sendToRenderer('file:changed', change, { webContentsId: targetWebContentsId })
      }
    }
  }

  private static shouldIgnore(filePath: string, projectPath: string): boolean {
    const relativePath = path.relative(projectPath, filePath)
    const segments = relativePath.split(path.sep)

    // 检查是否在忽略目录中
    for (const segment of segments) {
      if (this.IGNORED_DIRS.has(segment)) {
        return true
      }
    }

    // 检查是否是忽略文件
    const fileName = segments[segments.length - 1]
    return this.IGNORED_FILES.has(fileName)
  }

  static async stopWatching(projectPath: string, targetWebContentsId?: number): Promise<void> {
    const state = this.watchers.get(projectPath)
    if (!state) return

    if (typeof targetWebContentsId === 'number') {
      state.targetWebContentsIds.delete(targetWebContentsId)
      if (this.projectByWebContentsId.get(targetWebContentsId) === projectPath) {
        this.projectByWebContentsId.delete(targetWebContentsId)
      }
      if (state.targetWebContentsIds.size > 0) {
        return
      }
    }

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }
    for (const subscribedTargetId of state.targetWebContentsIds) {
      if (this.projectByWebContentsId.get(subscribedTargetId) === projectPath) {
        this.projectByWebContentsId.delete(subscribedTargetId)
      }
    }
    // ⭐ 原生 watcher 的 close 是同步的，立即释放
    state.watcher.close()
    this.watchers.delete(projectPath)
    console.log(`[FileWatcher] Watcher stopped for: ${projectPath}`)
  }

  static async stopWatchingForWebContents(targetWebContentsId: number): Promise<void> {
    const projectPath = this.projectByWebContentsId.get(targetWebContentsId)
    if (!projectPath) return
    await this.stopWatching(projectPath, targetWebContentsId)
  }

  static async stopAllWatching(): Promise<void> {
    console.log(`[FileWatcher] Stopping all watchers (${this.watchers.size} active)...`)

    for (const state of this.watchers.values()) {
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer)
      }
      // ⭐ 原生 watcher.close() 是同步的，立即释放资源
      try {
        state.watcher.close()
      } catch {
        // 忽略关闭错误
      }
    }

    this.watchers.clear()
    this.projectByWebContentsId.clear()
    console.log(`[FileWatcher] All watchers stopped`)
  }

  /**
   * 暂停监听（窗口失焦时调用）
   */
  static pause(): void {
    this.isPaused = true
  }

  /**
   * 恢复监听（窗口获得焦点时调用）
   */
  static resume(): void {
    console.log(`[FileWatcher] Resumed (window focus)`)
    this.isPaused = false

    // ⭐ 批量处理暂停期间的变化
    let totalPausedChanges = 0
    for (const state of this.watchers.values()) {
      if (state.pausedChanges.size > 0) {
        totalPausedChanges += state.pausedChanges.size
        // 将暂停期间的变化合并到 pendingChanges
        state.pausedChanges.forEach((change, path) => {
          state.pendingChanges.set(path, change)
        })
        state.pausedChanges.clear()

        // 触发防抖刷新
        if (state.debounceTimer) {
          clearTimeout(state.debounceTimer)
        }
        state.debounceTimer = setTimeout(() => {
          this.flushChanges(state)
        }, this.DEBOUNCE_DELAY)
      }
    }

    if (totalPausedChanges > 0) {
      console.log(`[FileWatcher] Processing ${totalPausedChanges} file change(s) from pause`)
    } else {
      console.log(`[FileWatcher] No changes during pause, skipping refresh`)
    }
  }
}
