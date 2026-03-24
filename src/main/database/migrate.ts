import { getDatabase } from './client'

const migrationSQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tools table (删除旧表，重建新表以支持 MCP/Custom)
DROP TABLE IF EXISTS tool_usage_stats CASCADE;
DROP TABLE IF EXISTS tools CASCADE;

CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,
    
    -- 工具来源
    source TEXT NOT NULL DEFAULT 'custom', -- 'mcp' | 'custom'
    
    -- MCP 工具相关
    mcp_server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
    mcp_server_name TEXT,
    
    -- 自定义工具相关
    code TEXT,
    
    -- 工具定义
    parameters JSONB,
    
    -- 状态
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'error'
    enabled INTEGER NOT NULL DEFAULT 1, -- 1=enabled, 0=disabled
    
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 工具使用统计表
CREATE TABLE tool_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name TEXT NOT NULL REFERENCES tools(name) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    
    -- 统计数据
    total_calls INTEGER NOT NULL DEFAULT 0,
    success_calls INTEGER NOT NULL DEFAULT 0,
    failed_calls INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- 平均执行时间（毫秒）
    avg_execution_time INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- 唯一约束：每个 agent 对每个工具只有一条统计记录
    UNIQUE(tool_name, agent_id)
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

-- MCP Servers table (删除旧表，重建新表)
DROP TABLE IF EXISTS mcp_servers CASCADE;

CREATE TABLE mcp_servers (
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

-- Add api_key column to agents table (for existing databases)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Add enable_reasoning column to agents table (for existing databases)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enable_reasoning INTEGER DEFAULT 0;

-- Add thinking_budget column to agents table (for existing databases)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS thinking_budget INTEGER;

-- Remove builtin tools support: delete handler column and builtin data
DO $$ 
BEGIN
    -- Delete all builtin tools data first
    DELETE FROM tools WHERE source = 'builtin';
    
    -- Drop handler column if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'tools' AND column_name = 'handler') THEN
        ALTER TABLE tools DROP COLUMN handler;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Tools 表索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_tools_source ON tools(source);
CREATE INDEX IF NOT EXISTS idx_tools_mcp_server_id ON tools(mcp_server_id);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tools_enabled ON tools(enabled);

-- 工具使用统计索引
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool_name ON tool_usage_stats(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_usage_agent_id ON tool_usage_stats(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_total_calls ON tool_usage_stats(total_calls DESC);
CREATE INDEX IF NOT EXISTS idx_tool_usage_last_used ON tool_usage_stats(last_used_at DESC);
`

export async function runMigrations() {
  try {
    const db = getDatabase() as ReturnType<typeof getDatabase> & {
      $client: { execute: (sql: string) => Promise<unknown> }
    }
    await db.$client.execute(migrationSQL)

    console.log('✅ Database migrations completed successfully')
    return true
  } catch (error) {
    console.error('❌ Database migration failed:', error)
    return false
  }
}
