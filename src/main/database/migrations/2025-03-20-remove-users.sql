-- 完全移除用户系统迁移
-- 日期: 2025-03-20
-- 说明: Circle 是本地桌面 IDE，不需要用户认证系统

-- ============================================================
-- 第一步：创建新表（无 user_id 字段）
-- ============================================================

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  projectPath TEXT,
  title TEXT DEFAULT 'New Chat',
  agentId TEXT,
  threadId TEXT,
  messageCount INTEGER DEFAULT 0,
  toolCallCount INTEGER DEFAULT 0,
  lastMessageAt TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  isPinned INTEGER DEFAULT 0,
  metadata TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE projects_new (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  projectType TEXT,
  framework TEXT,
  language TEXT,
  isIndexed INTEGER DEFAULT 0,
  lastIndexedAt TEXT,
  indexStatus TEXT DEFAULT 'idle',
  sessionCount INTEGER DEFAULT 0,
  lastOpenedAt TEXT,
  metadata TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE agent_memories_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  projectId TEXT,
  agentId TEXT,
  scope TEXT NOT NULL DEFAULT 'global',
  importance INTEGER DEFAULT 5,
  accessCount INTEGER DEFAULT 0,
  lastAccessedAt TEXT,
  metadata TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE agent_todos_new (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  projectId TEXT,
  agentId TEXT,
  todoId TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "order" INTEGER DEFAULT 0,
  metadata TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- ============================================================
-- 第二步：迁移现有数据（排除 user_id 列）
-- ============================================================

INSERT INTO sessions_new (id, projectPath, title, agentId, threadId, messageCount, toolCallCount, lastMessageAt, status, isPinned, metadata, createdAt, updatedAt)
SELECT id, projectPath, title, agentId, threadId, messageCount, toolCallCount, lastMessageAt, status, isPinned, metadata, createdAt, updatedAt
FROM sessions;

INSERT INTO projects_new (id, path, name, description, projectType, framework, language, isIndexed, lastIndexedAt, indexStatus, sessionCount, lastOpenedAt, metadata, createdAt, updatedAt)
SELECT id, path, name, description, projectType, framework, language, isIndexed, lastIndexedAt, indexStatus, sessionCount, lastOpenedAt, metadata, createdAt, updatedAt
FROM projects;

INSERT INTO agent_memories_new (id, title, content, projectId, agentId, scope, importance, accessCount, lastAccessedAt, metadata, createdAt, updatedAt)
SELECT id, title, content, projectId, agentId, scope, importance, accessCount, lastAccessedAt, metadata, createdAt, updatedAt
FROM agent_memories;

INSERT INTO agent_todos_new (id, sessionId, projectId, agentId, todoId, content, status, "order", metadata, createdAt, updatedAt)
SELECT id, sessionId, projectId, agentId, todoId, content, status, "order", metadata, createdAt, updatedAt
FROM agent_todos;

-- ============================================================
-- 第三步：删除旧表
-- ============================================================

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS agent_memories;
DROP TABLE IF EXISTS agent_todos;
DROP TABLE IF EXISTS users;

-- ============================================================
-- 第四步：重命名新表
-- ============================================================

ALTER TABLE sessions_new RENAME TO sessions;
ALTER TABLE projects_new RENAME TO projects;
ALTER TABLE agent_memories_new RENAME TO agent_memories;
ALTER TABLE agent_todos_new RENAME TO agent_todos;

-- ============================================================
-- 第五步：创建索引（优化查询性能）
-- ============================================================

CREATE INDEX idx_projects_path ON projects(path);
CREATE INDEX idx_projects_last_opened ON projects(lastOpenedAt DESC);

CREATE INDEX idx_sessions_project_path ON sessions(projectPath);
CREATE INDEX idx_sessions_status ON sessions(status);

CREATE INDEX idx_agent_memories_project ON agent_memories(projectId);
CREATE INDEX idx_agent_memories_agent ON agent_memories(agentId);
CREATE INDEX idx_agent_memories_scope ON agent_memories(scope);

CREATE INDEX idx_agent_todos_session ON agent_todos(sessionId);
CREATE INDEX idx_agent_todos_status ON agent_todos(status);
