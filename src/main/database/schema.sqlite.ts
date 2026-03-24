import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'crypto'

const now = () => new Date().toISOString()

// Users（先定义，sessions/projects 引用）
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  displayName: text('display_name'),
  avatar: text('avatar'),
  preferences: text('preferences').default('{}'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now),
  lastLoginAt: text('last_login_at')
})

export const agents = sqliteTable('agents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  model: text('model').notNull(),
  provider: text('provider').notNull(),
  apiKey: text('api_key'),
  instructions: text('instructions'),
  temperature: integer('temperature').default(7),
  maxTokens: integer('max_tokens').default(2048),
  enableReasoning: integer('enable_reasoning').default(0),
  thinkingBudget: integer('thinking_budget'),
  tools: text('tools').default('[]'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  config: text('config').notNull(),
  status: text('status').notNull().default('disconnected'),
  description: text('description'),
  tools: text('tools').default('[]'),
  error: text('error'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

export const tools = sqliteTable('tools', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  category: text('category'),
  source: text('source').notNull().default('custom'),
  mcpServerId: text('mcp_server_id'),
  mcpServerName: text('mcp_server_name'),
  code: text('code'),
  parameters: text('parameters'),
  status: text('status').notNull().default('active'),
  enabled: integer('enabled').notNull().default(1),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

export const toolUsageStats = sqliteTable('tool_usage_stats', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  toolName: text('tool_name').notNull(),
  agentId: text('agent_id'),
  totalCalls: integer('total_calls').notNull().default(0),
  successCalls: integer('success_calls').notNull().default(0),
  failedCalls: integer('failed_calls').notNull().default(0),
  lastUsedAt: text('last_used_at'),
  avgExecutionTime: integer('avg_execution_time').default(0),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

export const workflows = sqliteTable('workflows', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('paused'),
  config: text('config'),
  lastRun: text('last_run'),
  successRate: integer('success_rate').default(0),
  totalRuns: integer('total_runs').default(0),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

// Sessions - 会话管理
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull(),
  projectPath: text('project_path'),
  title: text('title').default('New Chat'),
  agentId: text('agent_id'),
  threadId: text('thread_id'),
  messageCount: integer('message_count').default(0),
  toolCallCount: integer('tool_call_count').default(0),
  lastMessageAt: text('last_message_at'),
  status: text('status').notNull().default('active'),
  isPinned: integer('is_pinned').default(0),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

// Projects - 项目管理
export const projects = sqliteTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull(),
  path: text('path').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  projectType: text('project_type'),
  framework: text('framework'),
  language: text('language'),
  isIndexed: integer('is_indexed').default(0),
  lastIndexedAt: text('last_indexed_at'),
  indexStatus: text('index_status').default('idle'),
  sessionCount: integer('session_count').default(0),
  lastOpenedAt: text('last_opened_at'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

// Agent Memories
export const agentMemories = sqliteTable('agent_memories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  title: text('title').notNull(),
  content: text('content').notNull(),
  userId: text('user_id').notNull(),
  projectId: text('project_id'),
  agentId: text('agent_id'),
  scope: text('scope').notNull().default('user'),
  importance: integer('importance').default(5),
  accessCount: integer('access_count').default(0),
  lastAccessedAt: text('last_accessed_at'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

// Agent Todos
export const agentTodos = sqliteTable('agent_todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  projectId: text('project_id'),
  agentId: text('agent_id'),
  todoId: text('todo_id').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  order: integer('order').default(0),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

// Codebase Index（本地 SQLite 存向量 JSON）
export const codebaseIndexes = sqliteTable('codebase_indexes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  projectPath: text('project_path').notNull().unique(),
  projectName: text('project_name').notNull(),
  indexName: text('index_name').notNull(),
  totalFiles: integer('total_files').notNull().default(0),
  totalChunks: integer('total_chunks').notNull().default(0),
  totalSize: integer('total_size').notNull().default(0),
  indexedAt: text('indexed_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

export const codebaseFiles = sqliteTable('codebase_files', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  projectPath: text('project_path').notNull(),
  filePath: text('file_path').notNull(),
  relativePath: text('relative_path').notNull(),
  contentHash: text('content_hash').notNull(),
  fileSize: integer('file_size').notNull(),
  language: text('language').notNull(),
  chunkCount: integer('chunk_count').notNull().default(0),
  chunkIds: text('chunk_ids').notNull().default('[]'),
  indexedAt: text('indexed_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now)
})

// 向量已迁移至 circle-vectors.db（sqlite-vec），此处不再使用

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type MCPServer = typeof mcpServers.$inferSelect
export type NewMCPServer = typeof mcpServers.$inferInsert
export type Tool = typeof tools.$inferSelect
export type NewTool = typeof tools.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type AgentMemory = typeof agentMemories.$inferSelect
export type NewAgentMemory = typeof agentMemories.$inferInsert
export type AgentTodo = typeof agentTodos.$inferSelect
export type NewAgentTodo = typeof agentTodos.$inferInsert
