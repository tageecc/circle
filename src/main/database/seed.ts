import { getDatabase, getSchema, initDatabase } from './client'

export async function seedDatabase(): Promise<{ agents: number; mcpServers: number }> {
  console.log('🌱 开始填充种子数据...\n')

  try {
    const db = getDatabase() as any
    const schema = getSchema()
    const { agents: agentsTable, mcpServers: mcpServersTable } = schema

    // 1. 创建示例 Agents
    console.log('📦 创建示例 Agents...')
    const agentsData: Array<Record<string, unknown>> = [
      {
        name: 'Cursor Agent',
        description: 'AI 编程助手，可自动创建项目、编写代码、操作文件系统',
        model: 'gpt-4o',
        provider: 'openai',
        instructions: `你是一个专业的 AI 编程助手，专注于帮助用户创建和修改代码项目。

# 核心能力

你拥有以下核心能力：
1. **代码理解与生成**：理解用户需求并生成高质量代码
2. **文件操作**：创建、读取、修改、删除项目文件
3. **项目结构设计**：设计合理的项目目录结构
4. **技术栈选择**：根据需求选择合适的技术栈和框架

# 工作原则

1. **清晰沟通**：在执行重要操作前，简要说明你的计划
2. **渐进式开发**：从核心功能开始，逐步完善
3. **最佳实践**：遵循行业最佳实践和代码规范
4. **用户确认**：对于重大决策（如技术栈选择），征求用户意见

# 代码质量标准

- 代码应具有良好的可读性和可维护性
- 适当添加注释，解释复杂逻辑
- 遵循所用语言/框架的命名规范
- 考虑错误处理和边界情况
- 代码应模块化，职责分明

# 项目创建流程

当用户要求创建新项目时：
1. 分析用户需求，提取关键信息
2. 提出项目结构和技术栈建议
3. 逐步创建文件和目录
4. 生成核心代码
5. 创建必要的配置文件（package.json, README等）
6. 总结已完成的工作和后续建议`,
        temperature: 7,
        maxTokens: 4096,
        tools: [],
        metadata: {
          avatar: null,
          category: 'Development',
          isCodingAgent: true
        }
      },
      {
        name: '代码助手',
        description: '专业的编程助手，帮助你编写、调试和优化代码',
        model: 'gpt-4o',
        provider: 'openai',
        instructions: `你是一个专业的编程助手。你的职责是：
1. 帮助用户编写高质量、可维护的代码
2. 提供代码审查和优化建议
3. 解释复杂的编程概念
4. 帮助调试和解决问题

请始终提供清晰、详细的解释，并附带代码示例。`,
        temperature: 7,
        maxTokens: 4096,
        tools: [],
        metadata: {
          avatar: null,
          category: 'Development'
        }
      },
      {
        name: '文档写手',
        description: '专注于技术文档、API 文档和用户指南的编写',
        model: 'gpt-4o-mini',
        provider: 'openai',
        instructions: `你是一个专业的技术文档写手。你擅长：
1. 编写清晰易懂的技术文档
2. 创建详细的 API 文档
3. 撰写用户指南和教程
4. 优化文档结构和可读性

请使用简洁明了的语言，适当使用代码示例和图表说明。`,
        temperature: 5,
        maxTokens: 2048,
        tools: [],
        metadata: {
          avatar: null,
          category: 'Writing'
        }
      },
      {
        name: '数据分析师',
        description: '帮助分析数据、生成报表和可视化',
        model: 'gpt-4o',
        provider: 'openai',
        instructions: `你是一个专业的数据分析师。你的专长包括：
1. 数据清洗和预处理
2. 统计分析和建模
3. 数据可视化
4. 生成分析报告和洞察

请提供数据驱动的见解，并用图表和统计数据支持你的结论。`,
        temperature: 3,
        maxTokens: 3072,
        tools: [],
        metadata: {
          avatar: null,
          category: 'Analytics'
        }
      }
    ]

    const createdAgents: unknown[] = []
    for (const agentData of agentsData) {
      const row = {
        ...agentData,
        tools: JSON.stringify(agentData.tools ?? []),
        metadata: JSON.stringify(agentData.metadata ?? {})
      }
      const [agent] = await db
        .insert(agentsTable)
        .values(row as any)
        .returning()
      createdAgents.push(agent)
      console.log(`  ✓ 创建 Agent: ${agent.name}`)
    }

    console.log(`✅ 成功创建 ${createdAgents.length} 个 Agents\n`)

    // 2. 创建示例 MCP Servers
    console.log('📦 创建示例 MCP Servers...')
    const os = await import('os')
    const defaultHome = os.homedir?.() || process.env.HOME || '/tmp'
    const mcpServersData: Array<{
      name: string
      description: string
      config: { command: string; args: string[]; env: Record<string, string> }
      status: string
      tools: string[]
      metadata: { category: string; icon: string }
    }> = [
      {
        name: 'filesystem',
        description: '文件系统操作工具，支持读写文件和目录管理',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', defaultHome],
          env: {}
        },
        status: 'disconnected',
        tools: [],
        metadata: { category: 'System', icon: '📁' }
      },
      {
        name: 'github',
        description: 'GitHub API 工具，支持仓库管理、PR 创建等操作',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
          }
        },
        status: 'disconnected',
        tools: [],
        metadata: { category: 'Development', icon: '🐙' }
      }
    ]
    const createdMCPServers: unknown[] = []
    for (const mcpData of mcpServersData) {
      try {
        console.log(`  📝 尝试创建 MCP Server: ${mcpData.name}`)
        const mcpRow = {
          ...mcpData,
          config: JSON.stringify(mcpData.config),
          metadata: JSON.stringify(mcpData.metadata)
        }
        const [server] = await db
          .insert(mcpServersTable)
          .values(mcpRow as any)
          .returning()
        createdMCPServers.push(server)
        console.log(`  ✓ 创建 MCP Server: ${server.name} (ID: ${server.id})`)
      } catch (error) {
        console.error(`  ❌ 创建 MCP Server ${mcpData.name} 失败:`, error)
        throw error
      }
    }

    console.log(`✅ 成功创建 ${createdMCPServers.length} 个 MCP Servers\n`)

    // 注意：conversations 和 messages 现在由 Mastra Memory 管理
    // threads 和 messages_v2 表会在首次使用时自动创建

    // 总结
    console.log('='.repeat(50))
    console.log('🎉 数据库种子数据填充完成！')
    console.log('='.repeat(50))
    console.log(`✓ Agents: ${createdAgents.length}`)
    console.log(`✓ MCP Servers: ${createdMCPServers.length}`)
    console.log('='.repeat(50))
    console.log('\n💡 提示：')
    console.log('  - MCP Servers 需要手动连接和导入工具')
    console.log('  - 可以在 Agents 页面为 Agent 配置工具')
    console.log('  - 会话历史现在由 Mastra Memory 管理（threads 表）')
    console.log('')

    return {
      agents: createdAgents.length,
      mcpServers: createdMCPServers.length
    }
  } catch (error) {
    console.error('❌ 填充种子数据失败:', error)
    throw error
  }
}

/**
 * 清空所有数据（危险操作！）
 */
export async function clearDatabase(): Promise<void> {
  console.log('⚠️  警告：即将清空所有数据...\n')

  try {
    const db = getDatabase()
    const { agents: agentsTable, mcpServers: mcpServersTable } = getSchema()

    console.log('🗑️  删除 agents...')
    await db.delete(agentsTable as any)

    console.log('🗑️  删除 mcp_servers...')
    await db.delete(mcpServersTable as any)

    console.log('✅ 数据库已清空')
    console.log('ℹ️  注意：Mastra Memory 表（threads, messages_v2）未被清空\n')
  } catch (error) {
    console.error('❌ 清空数据库失败:', error)
    throw error
  }
}

/**
 * 重置数据库：清空 + 填充
 */
export async function resetDatabase() {
  console.log('🔄 重置数据库...\n')
  await clearDatabase()
  await seedDatabase()
  console.log('✅ 数据库重置完成！\n')
}

// 如果直接运行此脚本（pnpm db:seed / db:clear / db:reset）
if (require.main === module) {
  const command = process.argv[2] || 'seed'

  const run = async (): Promise<void> => {
    try {
      const path = await import('path')
      const os = await import('os')
      const defaultUserData = path.join(os.homedir(), '.circle')
      const ok = await initDatabase(defaultUserData)
      if (!ok) {
        console.error('❌ 无法初始化数据库')
        process.exit(1)
      }
      switch (command) {
        case 'seed':
          await seedDatabase()
          break
        case 'clear':
          await clearDatabase()
          break
        case 'reset':
          await resetDatabase()
          break
        default:
          console.error('❌ 未知命令:', command)
          console.log('\n使用方法:')
          console.log('  pnpm run db:seed   - 填充种子数据')
          console.log('  pnpm run db:clear  - 清空数据库')
          console.log('  pnpm run db:reset  - 重置数据库（清空+填充）')
          process.exit(1)
      }
      process.exit(0)
    } catch (error) {
      console.error('❌ 执行失败:', error)
      process.exit(1)
    }
  }

  run()
}
