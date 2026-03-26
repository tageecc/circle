import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core'

/**
 * 应用配置表
 */
export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 窗口状态表
 */
export const windowState = sqliteTable('window_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  x: integer('x'),
  y: integer('y'),
  width: integer('width').notNull().default(1400),
  height: integer('height').notNull().default(900),
  isMaximized: integer('is_maximized', { mode: 'boolean' }).notNull().default(false),
  isFullScreen: integer('is_full_screen', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 最近项目表
 */
export const recentProjects = sqliteTable('recent_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  lastOpened: integer('last_opened', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

/**
 * 最近文件表
 */
export const recentFiles = sqliteTable('recent_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectPath: text('project_path').notNull(),
  filePath: text('file_path').notNull(),
  lastOpened: integer('last_opened', { mode: 'timestamp' }).notNull()
})

/**
 * 通知历史表
 */
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  read: integer('read', { mode: 'boolean' }).notNull().default(false)
})

/**
 * Git 最近分支表
 */
export const recentBranches = sqliteTable('recent_branches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectPath: text('project_path').notNull(),
  branchName: text('branch_name').notNull(),
  lastUsed: integer('last_used', { mode: 'timestamp' }).notNull()
})

/**
 * UI 状态表
 */
export const uiState = sqliteTable('ui_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 用户规则表
 */
export const userRules = sqliteTable('user_rules', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 文件排除规则表
 */
export const filesExclude = sqliteTable('files_exclude', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pattern: text('pattern').notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

/**
 * 会话表
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  projectPath: text('project_path').notNull(),
  modelId: text('model_id').notNull(),
  title: text('title').notNull().default('New Chat'),
  metadata: text('metadata').notNull().default('{}'),
  lastMessageAt: integer('last_message_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 消息表 - AI SDK 标准格式
 */
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

/**
 * MCP 服务器配置表
 */
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  configJson: text('config_json').notNull(),
  autoConnect: integer('auto_connect', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 代码库索引表
 */
export const codebaseIndexes = sqliteTable('codebase_indexes', {
  projectPath: text('project_path').primaryKey(),
  projectName: text('project_name').notNull(),
  totalFiles: integer('total_files').notNull().default(0),
  totalChunks: integer('total_chunks').notNull().default(0),
  totalSize: integer('total_size').notNull().default(0),
  indexedAt: integer('indexed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 代码库文件表
 */
export const codebaseFiles = sqliteTable('codebase_files', {
  id: text('id').primaryKey(),
  projectPath: text('project_path').notNull(),
  filePath: text('file_path').notNull(),
  relativePath: text('relative_path').notNull(),
  contentHash: text('content_hash').notNull(),
  fileSize: integer('file_size').notNull(),
  language: text('language').notNull(),
  indexedAt: integer('indexed_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * 代码库文本块表（用于搜索）
 */
export const codebaseVectors = sqliteTable('codebase_vectors', {
  id: text('id').primaryKey(),
  projectPath: text('project_path').notNull(),
  filePath: text('file_path').notNull(),
  relativePath: text('relative_path').notNull(),
  text: text('text').notNull(),
  language: text('language').notNull(),
  embedding: blob('embedding', { mode: 'buffer' }), // Float32Array stored as Buffer
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

/**
 * 消息快照表 - 用于回滚功能
 */
export const messageSnapshots = sqliteTable('message_snapshots', {
  messageId: integer('message_id').primaryKey(),
  sessionId: text('session_id').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  snapshotData: text('snapshot_data').notNull() // JSON format
})

/**
 * AI 记忆表 - 持久化用户偏好和上下文
 */
export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

/**
 * Skills 偏好表 - 仅存储启用状态
 * 技能本身存储在文件系统，这里只存偏好
 */
export const skillPreferences = sqliteTable('skill_preferences', {
  skillPath: text('skill_path').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true)
})

// Types
export type AppConfig = typeof appConfig.$inferSelect
export type WindowState = typeof windowState.$inferSelect
export type RecentProject = typeof recentProjects.$inferSelect
export type RecentFile = typeof recentFiles.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type RecentBranch = typeof recentBranches.$inferSelect
export type UIState = typeof uiState.$inferSelect
export type UserRule = typeof userRules.$inferSelect
export type FilesExclude = typeof filesExclude.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Message = typeof messages.$inferSelect
export type MCPServer = typeof mcpServers.$inferSelect
export type CodebaseIndex = typeof codebaseIndexes.$inferSelect
export type CodebaseFile = typeof codebaseFiles.$inferSelect
export type CodebaseVector = typeof codebaseVectors.$inferSelect
export type MessageSnapshot = typeof messageSnapshots.$inferSelect
export type Memory = typeof memories.$inferSelect
export type SkillPreference = typeof skillPreferences.$inferSelect