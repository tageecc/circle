import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, desc, and, lt } from 'drizzle-orm'
import * as schema from './schema'
import * as sqliteVec from 'sqlite-vec'

/**
 * SQLite 数据库服务
 */
class CircleDatabase {
  private static instance: CircleDatabase
  private sqlite: Database.Database
  private db: BetterSQLite3Database<typeof schema>
  private dbPath: string

  private constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'circle.db')

    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    console.log('📦 Initializing database...')
    console.log('   Database path:', this.dbPath)

    this.sqlite = new Database(this.dbPath)
    this.sqlite.pragma('journal_mode = WAL')
    this.sqlite.pragma('foreign_keys = ON')

    sqliteVec.load(this.sqlite)
    console.log('   ✓ sqlite-vec loaded')

    this.db = drizzle(this.sqlite, { schema })
    this.initTables()

    console.log('✅ Database initialized')
  }

  static getInstance(): CircleDatabase {
    if (!CircleDatabase.instance) {
      CircleDatabase.instance = new CircleDatabase()
    }
    return CircleDatabase.instance
  }

  private initTables(): void {
    this.sqlite.exec(`
      -- 应用配置表
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 窗口状态表
      CREATE TABLE IF NOT EXISTS window_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        x INTEGER,
        y INTEGER,
        width INTEGER NOT NULL DEFAULT 1400,
        height INTEGER NOT NULL DEFAULT 900,
        is_maximized INTEGER NOT NULL DEFAULT 0,
        is_full_screen INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      -- 最近项目表
      CREATE TABLE IF NOT EXISTS recent_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        last_opened INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      -- 最近文件表
      CREATE TABLE IF NOT EXISTS recent_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_path TEXT NOT NULL,
        file_path TEXT NOT NULL,
        last_opened INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recent_files_project ON recent_files(project_path);

      -- 通知历史表
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        timestamp INTEGER NOT NULL,
        read INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);

      -- Git 最近分支表
      CREATE TABLE IF NOT EXISTS recent_branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_path TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        last_used INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recent_branches_project ON recent_branches(project_path);

      -- UI 状态表（同时用于各类设置）
      CREATE TABLE IF NOT EXISTS ui_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 用户规则表
      CREATE TABLE IF NOT EXISTS user_rules (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 文件排除规则表
      CREATE TABLE IF NOT EXISTS files_exclude (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      -- 会话表
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        model_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        metadata TEXT NOT NULL DEFAULT '{}',
        last_message_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);

      -- 消息表
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

      -- MCP 服务器配置表
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL,
        auto_connect INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 代码库索引表
      CREATE TABLE IF NOT EXISTS codebase_indexes (
        project_path TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        total_files INTEGER NOT NULL DEFAULT 0,
        total_chunks INTEGER NOT NULL DEFAULT 0,
        total_size INTEGER NOT NULL DEFAULT 0,
        indexed_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 代码库文件表
      CREATE TABLE IF NOT EXISTS codebase_files (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        file_path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        language TEXT NOT NULL,
        indexed_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_path) REFERENCES codebase_indexes(project_path) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_codebase_files_project ON codebase_files(project_path);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_codebase_files_unique ON codebase_files(project_path, file_path);

      -- 代码库文本块表
      CREATE TABLE IF NOT EXISTS codebase_vectors (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        file_path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        text TEXT NOT NULL,
        language TEXT NOT NULL,
        embedding BLOB,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_codebase_vectors_project ON codebase_vectors(project_path);
      CREATE INDEX IF NOT EXISTS idx_codebase_vectors_file ON codebase_vectors(file_path);

      -- 消息快照表
      CREATE TABLE IF NOT EXISTS message_snapshots (
        message_id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        snapshot_data TEXT NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_message_snapshots_session ON message_snapshots(session_id);

      -- AI 记忆表
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);

      -- Skills 偏好表（仅存储启用状态）
      CREATE TABLE IF NOT EXISTS skill_preferences (
        skill_path TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        display_name TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_model_configs_provider ON model_configs(provider_id);
    `)
  }

  close(): void {
    this.sqlite.close()
  }

  // ==================== 配置相关操作 ====================

  getConfig<T>(key: string, defaultValue: T): T {
    const result = this.db
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.key, key))
      .get()
    if (!result) return defaultValue
    try {
      return JSON.parse(result.value) as T
    } catch {
      return defaultValue
    }
  }

  setConfig<T>(key: string, value: T): void {
    const now = new Date()
    this.db
      .insert(schema.appConfig)
      .values({ key, value: JSON.stringify(value), updatedAt: now })
      .onConflictDoUpdate({
        target: schema.appConfig.key,
        set: { value: JSON.stringify(value), updatedAt: now }
      })
      .run()
  }

  // ==================== 窗口状态操作 ====================

  getWindowState(): schema.WindowState | null {
    return this.db.select().from(schema.windowState).get() || null
  }

  setWindowState(state: Partial<Omit<schema.WindowState, 'id' | 'updatedAt'>>): void {
    const now = new Date()
    const existing = this.getWindowState()

    if (existing) {
      this.db
        .update(schema.windowState)
        .set({ ...state, updatedAt: now })
        .where(eq(schema.windowState.id, existing.id))
        .run()
    } else {
      this.db
        .insert(schema.windowState)
        .values({
          width: state.width || 1400,
          height: state.height || 900,
          isMaximized: state.isMaximized || false,
          isFullScreen: state.isFullScreen || false,
          ...state,
          updatedAt: now
        })
        .run()
    }
  }

  // ==================== 最近项目操作 ====================

  getRecentProjects(limit: number = 10): schema.RecentProject[] {
    return this.db
      .select()
      .from(schema.recentProjects)
      .orderBy(desc(schema.recentProjects.lastOpened))
      .limit(limit)
      .all()
  }

  addRecentProject(name: string, projectPath: string): void {
    const now = new Date()
    this.db
      .insert(schema.recentProjects)
      .values({ name, path: projectPath, lastOpened: now, createdAt: now })
      .onConflictDoUpdate({
        target: schema.recentProjects.path,
        set: { name, lastOpened: now }
      })
      .run()
  }

  removeRecentProject(projectPath: string): void {
    this.db.delete(schema.recentProjects).where(eq(schema.recentProjects.path, projectPath)).run()
  }

  // ==================== 最近文件操作 ====================

  getRecentFiles(projectPath: string, limit: number = 20): string[] {
    const results = this.db
      .select()
      .from(schema.recentFiles)
      .where(eq(schema.recentFiles.projectPath, projectPath))
      .orderBy(desc(schema.recentFiles.lastOpened))
      .limit(limit)
      .all()

    // 过滤掉不存在的文件
    const existingFiles = results
      .map((r) => r.filePath)
      .filter((f) => {
        try {
          return fs.existsSync(f)
        } catch {
          return false
        }
      })

    return existingFiles
  }

  addRecentFile(projectPath: string, filePath: string): void {
    const now = new Date()

    // 先删除已存在的记录（更新顺序）
    this.db
      .delete(schema.recentFiles)
      .where(
        and(
          eq(schema.recentFiles.projectPath, projectPath),
          eq(schema.recentFiles.filePath, filePath)
        )
      )
      .run()

    // 插入新记录
    this.db.insert(schema.recentFiles).values({ projectPath, filePath, lastOpened: now }).run()

    // 限制每个项目最多保存 50 条
    const count = this.db
      .select()
      .from(schema.recentFiles)
      .where(eq(schema.recentFiles.projectPath, projectPath))
      .all().length

    if (count > 50) {
      // 删除最旧的记录
      const oldest = this.db
        .select()
        .from(schema.recentFiles)
        .where(eq(schema.recentFiles.projectPath, projectPath))
        .orderBy(schema.recentFiles.lastOpened)
        .limit(count - 50)
        .all()

      for (const record of oldest) {
        this.db.delete(schema.recentFiles).where(eq(schema.recentFiles.id, record.id)).run()
      }
    }
  }

  removeRecentFile(projectPath: string, filePath: string): void {
    this.db
      .delete(schema.recentFiles)
      .where(
        and(
          eq(schema.recentFiles.projectPath, projectPath),
          eq(schema.recentFiles.filePath, filePath)
        )
      )
      .run()
  }

  clearRecentFiles(projectPath: string): void {
    this.db.delete(schema.recentFiles).where(eq(schema.recentFiles.projectPath, projectPath)).run()
  }

  // ==================== 通知操作 ====================

  getNotifications(limit: number = 100): schema.Notification[] {
    return this.db
      .select()
      .from(schema.notifications)
      .orderBy(desc(schema.notifications.timestamp))
      .limit(limit)
      .all()
  }

  addNotification(notification: Omit<schema.Notification, 'read'>): void {
    this.db
      .insert(schema.notifications)
      .values({ ...notification, read: false })
      .onConflictDoNothing()
      .run()

    // 清理超过 7 天的通知
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    this.db
      .delete(schema.notifications)
      .where(lt(schema.notifications.timestamp, sevenDaysAgo))
      .run()

    // 限制最多 100 条
    const all = this.db
      .select()
      .from(schema.notifications)
      .orderBy(desc(schema.notifications.timestamp))
      .all()

    if (all.length > 100) {
      const toDelete = all.slice(100)
      for (const n of toDelete) {
        this.db.delete(schema.notifications).where(eq(schema.notifications.id, n.id)).run()
      }
    }
  }

  markNotificationAsRead(id: string): void {
    this.db
      .update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.id, id))
      .run()
  }

  markAllNotificationsAsRead(): void {
    this.db.update(schema.notifications).set({ read: true }).run()
  }

  removeNotification(id: string): void {
    this.db.delete(schema.notifications).where(eq(schema.notifications.id, id)).run()
  }

  clearAllNotifications(): void {
    this.db.delete(schema.notifications).run()
  }

  // ==================== Git 最近分支操作 ====================

  getRecentBranches(projectPath: string, limit: number = 10): string[] {
    const results = this.db
      .select()
      .from(schema.recentBranches)
      .where(eq(schema.recentBranches.projectPath, projectPath))
      .orderBy(desc(schema.recentBranches.lastUsed))
      .limit(limit)
      .all()

    return results.map((r) => r.branchName)
  }

  addRecentBranch(projectPath: string, branchName: string): void {
    const now = new Date()

    // 先删除已存在的记录
    this.db
      .delete(schema.recentBranches)
      .where(
        and(
          eq(schema.recentBranches.projectPath, projectPath),
          eq(schema.recentBranches.branchName, branchName)
        )
      )
      .run()

    // 插入新记录
    this.db.insert(schema.recentBranches).values({ projectPath, branchName, lastUsed: now }).run()

    // 限制每个项目最多 10 条
    const count = this.db
      .select()
      .from(schema.recentBranches)
      .where(eq(schema.recentBranches.projectPath, projectPath))
      .all().length

    if (count > 10) {
      const oldest = this.db
        .select()
        .from(schema.recentBranches)
        .where(eq(schema.recentBranches.projectPath, projectPath))
        .orderBy(schema.recentBranches.lastUsed)
        .limit(count - 10)
        .all()

      for (const record of oldest) {
        this.db.delete(schema.recentBranches).where(eq(schema.recentBranches.id, record.id)).run()
      }
    }
  }

  // ==================== UI 状态操作 ====================

  getUIState<T>(key: string, defaultValue: T): T {
    const result = this.db.select().from(schema.uiState).where(eq(schema.uiState.key, key)).get()
    if (!result) return defaultValue
    try {
      return JSON.parse(result.value) as T
    } catch {
      return defaultValue
    }
  }

  setUIState<T>(key: string, value: T): void {
    const now = new Date()
    this.db
      .insert(schema.uiState)
      .values({ key, value: JSON.stringify(value), updatedAt: now })
      .onConflictDoUpdate({
        target: schema.uiState.key,
        set: { value: JSON.stringify(value), updatedAt: now }
      })
      .run()
  }

  // ==================== 用户规则操作 ====================

  getUserRules(): schema.UserRule[] {
    return this.db.select().from(schema.userRules).all()
  }

  addUserRule(id: string, content: string): void {
    const now = new Date()
    this.db
      .insert(schema.userRules)
      .values({ id, content, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.userRules.id,
        set: { content, updatedAt: now }
      })
      .run()
  }

  removeUserRule(id: string): void {
    this.db.delete(schema.userRules).where(eq(schema.userRules.id, id)).run()
  }

  // ==================== 文件排除规则操作 ====================

  getFilesExclude(): Record<string, boolean> {
    const results = this.db.select().from(schema.filesExclude).all()
    const exclude: Record<string, boolean> = {}
    for (const r of results) {
      exclude[r.pattern] = r.enabled
    }
    return exclude
  }

  setFilesExclude(pattern: string, enabled: boolean): void {
    const now = new Date()
    this.db
      .insert(schema.filesExclude)
      .values({ pattern, enabled, createdAt: now })
      .onConflictDoUpdate({
        target: schema.filesExclude.pattern,
        set: { enabled }
      })
      .run()
  }

  clearFilesExclude(): void {
    this.db.delete(schema.filesExclude).run()
  }

  // ==================== 消息快照操作 ====================

  saveSnapshot(snapshot: {
    messageId: number
    sessionId: string
    timestamp: Date
    snapshotData: string
  }): void {
    this.db
      .insert(schema.messageSnapshots)
      .values({
        messageId: snapshot.messageId,
        sessionId: snapshot.sessionId,
        timestamp: snapshot.timestamp,
        snapshotData: snapshot.snapshotData
      })
      .onConflictDoNothing()
      .run()
  }

  getSnapshot(messageId: number): schema.MessageSnapshot | null {
    return (
      this.db
        .select()
        .from(schema.messageSnapshots)
        .where(eq(schema.messageSnapshots.messageId, messageId))
        .get() || null
    )
  }


  // ==================== 公共访问方法 ====================

  getDb(): BetterSQLite3Database<typeof schema> {
    return this.db
  }

  getSqlite(): Database.Database {
    return this.sqlite
  }
}

export function getDb(): CircleDatabase {
  return CircleDatabase.getInstance()
}
