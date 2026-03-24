const SQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT,
  instructions TEXT,
  temperature INTEGER DEFAULT 7,
  max_tokens INTEGER DEFAULT 2048,
  enable_reasoning INTEGER DEFAULT 0,
  thinking_budget INTEGER,
  tools TEXT DEFAULT '[]',
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  description TEXT,
  tools TEXT DEFAULT '[]',
  error TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  mcp_server_id TEXT,
  mcp_server_name TEXT,
  code TEXT,
  parameters TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  enabled INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tool_usage_stats (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  agent_id TEXT,
  total_calls INTEGER NOT NULL DEFAULT 0,
  success_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  avg_execution_time INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'paused',
  config TEXT,
  last_run TEXT,
  success_rate INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  title TEXT DEFAULT 'New Chat',
  agent_id TEXT,
  thread_id TEXT,
  message_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  last_message_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_pinned INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  framework TEXT,
  language TEXT,
  is_indexed INTEGER DEFAULT 0,
  last_indexed_at TEXT,
  index_status TEXT DEFAULT 'idle',
  session_count INTEGER DEFAULT 0,
  last_opened_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  project_id TEXT,
  agent_id TEXT,
  scope TEXT NOT NULL DEFAULT 'global',
  importance INTEGER DEFAULT 5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS agent_todos (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT,
  agent_id TEXT,
  todo_id TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "order" INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS codebase_indexes (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  index_name TEXT NOT NULL,
  total_files INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  total_size INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS codebase_files (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  language TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  chunk_ids TEXT NOT NULL DEFAULT '[]',
  indexed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_path, file_path)
);
CREATE TABLE IF NOT EXISTS codebase_vectors (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  embedding TEXT NOT NULL,
  metadata TEXT NOT NULL
);
DROP TABLE IF EXISTS codebase_vectors;
`

export async function runSqliteMigrations(
  execute: (sql: string) => Promise<unknown>
): Promise<boolean> {
  try {
    for (const stmt of SQL.split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await execute(stmt)
    }
    console.log('✅ SQLite migrations completed')
    return true
  } catch (error) {
    console.error('❌ SQLite migration failed:', error)
    return false
  }
}
