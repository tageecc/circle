import { watch, FSWatcher, existsSync } from 'fs'
import * as path from 'path'
import { sendToRenderer } from '../utils/ipc'

interface GitWatcherState {
  watchers: FSWatcher[]
  debounceTimer: NodeJS.Timeout | null
  lastTriggerTime: number // 上次触发时间（用于忽略短时间内的重复事件）
}

/**
 * Git 目录监听服务
 *
 * 设计原则（参考 VSCode）：
 * 1. 只监听 .git 目录的关键文件（6-7个）
 * 2. 节流（100ms）+ 防抖（1.5s）双重保护，减少 90% 无效回调
 * 3. 使用 unref() 确保不阻止进程退出
 * 4. 自动检测外部Git操作（checkout, pull, commit等）
 *
 * 监听的关键文件：
 * - .git/HEAD        → 分支切换（git checkout）
 * - .git/index       → 暂存区变化（git add, git reset）
 * - .git/refs/heads  → 分支创建/删除
 * - .git/MERGE_HEAD  → 合并状态
 * - .git/REBASE_HEAD → rebase状态
 */
export class GitWatcherService {
  private static watchers: Map<string, GitWatcherState> = new Map()
  private static readonly DEBOUNCE_DELAY = 1500 // 1.5秒防抖（避免频繁触发）
  private static readonly THROTTLE_THRESHOLD = 100 // 100ms内的重复事件直接忽略
  private static isPaused = false // 暂停状态（窗口失焦时暂停）
  private static pendingRefreshProjects = new Set<string>() // 暂停期间需要刷新的项目

  /**
   * 开始监听项目的.git目录
   */
  static startWatching(projectPath: string): void {
    // 先停止已有的监听
    this.stopWatching(projectPath)

    const gitDir = path.join(projectPath, '.git')

    // 检查.git目录是否存在
    if (!existsSync(gitDir)) {
      console.log(`[GitWatcher] No .git directory found in ${projectPath}`)
      return
    }

    console.log(`[GitWatcher] Starting to watch .git directory: ${gitDir}`)

    const state: GitWatcherState = {
      watchers: [],
      debounceTimer: null,
      lastTriggerTime: 0
    }

    // ⭐ 关键文件列表（参考VSCode）
    const watchPaths = [
      path.join(gitDir, 'HEAD'), // 分支切换
      path.join(gitDir, 'index'), // 暂存区
      path.join(gitDir, 'MERGE_HEAD'), // 合并状态
      path.join(gitDir, 'REBASE_HEAD'), // rebase状态
      path.join(gitDir, 'CHERRY_PICK_HEAD'), // cherry-pick状态
      path.join(gitDir, 'ORIG_HEAD') // 操作前的HEAD
    ]

    watchPaths.forEach((watchPath) => {
      try {
        // 跳过不存在的文件（某些状态文件可能不存在）
        if (!existsSync(watchPath)) {
          return
        }

        // ⭐ 使用原生 fs.watch，性能最好
        const watcher = watch(
          watchPath,
          { persistent: false }, // 不阻止进程退出
          () => {
            // 不在这里打印日志，避免日志泛滥（移到真正通知时打印）
            this.handleGitChange(projectPath)
          }
        )

        // ⭐ 关键：让watcher不阻止进程退出
        watcher.unref()

        state.watchers.push(watcher)
      } catch (error) {
        // 忽略监听失败（某些文件可能没有权限）
        console.warn(`[GitWatcher] Failed to watch ${watchPath}:`, error)
      }
    })

    // ⭐ 递归监听 refs/heads 目录（分支创建/删除）
    try {
      const refsHeadsPath = path.join(gitDir, 'refs', 'heads')
      if (existsSync(refsHeadsPath)) {
        const refsWatcher = watch(refsHeadsPath, { persistent: false, recursive: true }, () => {
          // 不在这里打印日志，避免日志泛滥
          this.handleGitChange(projectPath)
        })
        refsWatcher.unref()
        state.watchers.push(refsWatcher)
      }
    } catch (error) {
      console.warn(`[GitWatcher] Failed to watch refs/heads:`, error)
    }

    // ⭐ 监听 .git 目录本身（检测删除）
    try {
      // 监听项目根目录，只关注 .git 目录的变化
      const gitDirWatcher = watch(projectPath, { persistent: false }, (eventType, filename) => {
        if (filename === '.git' && !existsSync(gitDir)) {
          console.log(`[GitWatcher] .git directory removed`)
          this.stopWatching(projectPath)
          sendToRenderer('git:external-change', { projectPath })
        }
      })
      gitDirWatcher.unref()
      state.watchers.push(gitDirWatcher)
    } catch (error) {
      console.warn(`[GitWatcher] Failed to watch .git directory:`, error)
    }

    this.watchers.set(projectPath, state)
    console.log(`[GitWatcher] Watching ${state.watchers.length} paths in ${projectPath}`)
  }

  /**
   * 处理Git变化
   */
  private static handleGitChange(projectPath: string): void {
    // ⭐ 暂停状态：窗口失焦时只记录，不立即通知
    if (this.isPaused) {
      this.pendingRefreshProjects.add(projectPath)
      return
    }

    const state = this.watchers.get(projectPath)
    if (!state) return

    const now = Date.now()

    // ⭐ 节流：忽略 100ms 内的重复事件（减少 90% 的无效回调）
    if (now - state.lastTriggerTime < this.THROTTLE_THRESHOLD) {
      return // 直接忽略，不执行任何操作
    }

    state.lastTriggerTime = now

    // 清除之前的定时器
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }

    // ⭐ 1.5秒防抖：避免频繁刷新
    state.debounceTimer = setTimeout(() => {
      // 通知renderer进程刷新Git状态
      sendToRenderer('git:external-change', { projectPath })
      state.debounceTimer = null
    }, this.DEBOUNCE_DELAY)
  }

  /**
   * 停止监听项目的.git目录
   */
  static stopWatching(projectPath: string): void {
    const state = this.watchers.get(projectPath)
    if (!state) return

    console.log(`[GitWatcher] Stopping watch for ${projectPath}`)

    // 清除防抖定时器
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }

    // 关闭所有watcher
    state.watchers.forEach((watcher) => {
      try {
        watcher.close()
      } catch {
        // 忽略关闭错误
      }
    })

    this.watchers.delete(projectPath)
  }

  /**
   * 停止所有监听
   */
  static stopAllWatching(): void {
    console.log(`[GitWatcher] Stopping all watchers (${this.watchers.size} active)`)

    for (const state of this.watchers.values()) {
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer)
      }

      state.watchers.forEach((watcher) => {
        try {
          watcher.close()
        } catch {
          // 忽略关闭错误
        }
      })
    }

    this.watchers.clear()
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
    console.log(`[GitWatcher] Resumed (window focus)`)
    this.isPaused = false

    // ⭐ 只刷新暂停期间有变化的项目（精确高效）
    if (this.pendingRefreshProjects.size > 0) {
      console.log(
        `[GitWatcher] Refreshing ${this.pendingRefreshProjects.size} project(s) with changes`
      )
      this.pendingRefreshProjects.forEach((projectPath) => {
        sendToRenderer('git:external-change', { projectPath })
      })
      this.pendingRefreshProjects.clear()
    } else {
      console.log(`[GitWatcher] No changes during pause, skipping refresh`)
    }
  }
}
