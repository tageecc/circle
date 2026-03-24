-- Circle Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 清理旧的 conversations 和 messages 表（迁移到 Mastra Memory）
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP INDEX IF EXISTS idx_conversations_agent_id;
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_conversations_updated_at;
DROP INDEX IF EXISTS idx_messages_created_at;

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    tools JSONB DEFAULT '[]'::jsonb,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migration: Add enable_reasoning column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agents' AND column_name='enable_reasoning'
    ) THEN
        ALTER TABLE agents ADD COLUMN enable_reasoning INTEGER DEFAULT 0;
    END IF;
END $$;

-- Migration: Add thinking_budget column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agents' AND column_name='thinking_budget'
    ) THEN
        ALTER TABLE agents ADD COLUMN thinking_budget INTEGER;
    END IF;
END $$;

-- Tools table
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,
    source TEXT NOT NULL DEFAULT 'custom',
    mcp_server_id UUID,
    mcp_server_name TEXT,
    code TEXT,
    parameters JSONB,
    status TEXT NOT NULL DEFAULT 'active',
    enabled INTEGER NOT NULL DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tool usage stats table
CREATE TABLE IF NOT EXISTS tool_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name TEXT NOT NULL REFERENCES tools(name) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    total_calls INTEGER NOT NULL DEFAULT 0,
    success_calls INTEGER NOT NULL DEFAULT 0,
    failed_calls INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP,
    avg_execution_time INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'paused',
    config JSONB,
    last_run TIMESTAMP,
    success_rate INTEGER DEFAULT 0,
    total_runs INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MCP Servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    config JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    description TEXT,
    tools JSONB DEFAULT '[]'::jsonb,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent Memories table - 存储 Agent 的长期记忆
CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT,
    importance INTEGER DEFAULT 5,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_id ON agent_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance DESC);

-- Agent Todos table - 存储 Agent 的任务列表
CREATE TABLE IF NOT EXISTS agent_todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL,
    todo_id TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT,
    "order" INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT agent_todos_session_todo_unique UNIQUE (session_id, todo_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_todos_session_id ON agent_todos(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_todos_agent_id ON agent_todos(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_todos_status ON agent_todos(status);

-- Mastra Memory 会自动创建以下表：
-- - threads (对话线程)
-- - messages_v2 (消息，支持 AI SDK V2 格式)
-- - resources (用户资源和 working memory)
-- 无需手动创建这些表

