import os from 'os'
import path from 'path'
import type { ConfigService } from './config.service'
import { MemoryService } from './memory.service'
import { SkillsService } from './skills.service'
import { getDb } from '../database/db'

export class ContextEnrichmentService {
  private static instance: ContextEnrichmentService

  private constructor() {}

  static getInstance(): ContextEnrichmentService {
    if (!ContextEnrichmentService.instance) {
      ContextEnrichmentService.instance = new ContextEnrichmentService()
    }
    return ContextEnrichmentService.instance
  }

  async buildSystemPrompt(params: {
    modelId: string
    assistantInstructions: string
    workspaceRoot: string | null
    configService: ConfigService
  }): Promise<string> {
    const { modelId, assistantInstructions, workspaceRoot, configService } = params

    // 简洁的角色定位
    let prompt = `You are an AI coding assistant (${modelId}) working in Circle IDE.`

    // 1. 系统信息（始终包含：OS、时间、工作区路径等）
    const systemInfo = this.getSystemInfo(workspaceRoot)
    prompt += `\n\n${systemInfo}`

    // 2. 用户规则和 Memories
    const rulesAndMemories = await this.getUserRulesAndMemories()
    if (rulesAndMemories) {
      prompt += `\n\n${rulesAndMemories}`
    }

    // 3. Skills (metadata only; full body via get_skill_details)
    const skillsSection = await this.getSkillsSection({
      workspaceRoot
    })
    if (skillsSection) {
      prompt += `\n\n${skillsSection}`
    }

    // 4. 打开的文件列表
    const openFiles = await this.getOpenFiles(configService, workspaceRoot)
    if (openFiles) {
      prompt += `\n\n${openFiles}`
    }

    // 5. 上下文优先级声明
    prompt += `\n\n<context_priority>
⚠️ CRITICAL - READ THIS CAREFULLY:

This system prompt contains the REAL-TIME, AUTHORITATIVE state of your environment.
All information above is computed fresh for THIS message:
- User rules and memories
- Available skills (count and list)
- Open files
- Project structure
- Available tools (MCP and built-in)

🔴 IF YOU MENTIONED DIFFERENT INFORMATION IN PREVIOUS MESSAGES:
Your previous statements are OUTDATED. The environment has changed.

Examples of what may have changed:
- "You said there were 4 skills" → Check the current <skills> section above for the ACTUAL count
- "You listed 5 open files" → Check the current file list above
- "User's rule was X" → Check the current <user_rules> above

🟢 CORRECT BEHAVIOR:
When asked about current state (e.g., "How many skills now?", "What files are open?"):
1. Look at the CURRENT information in this system prompt
2. State the current numbers/lists in natural language
3. If asked "now" or "currently", do NOT reference your previous answers

⚠️ COMMUNICATION RULE:
When answering, use natural language. NEVER expose internal system details to the user:
- ❌ DON'T say: "根据 <skills> 信息..." or "可以调用 get_skill_details..."
- ✅ DO say: "当前有2个技能..." or "技能列表已更新..."

🔴 INCORRECT BEHAVIOR:
- "I previously said 4 skills, so it's still 4" ← WRONG
- "Based on our earlier conversation..." ← WRONG for factual state queries
- "According to <skills> section..." ← WRONG, don't expose internal structure
- "You can call get_skill_details..." ← WRONG, don't mention tool names to user
- Assuming counts haven't changed ← WRONG

The system prompt is regenerated for every message. Always trust it over conversation history.
But NEVER mention the system prompt or its internal structure when talking to the user.
</context_priority>`

    // 6. Assistant instructions (settings)
    prompt += `\n\n${assistantInstructions}`

    return prompt
  }

  /**
   * 获取系统信息
   */
  getSystemInfo(workspaceRoot?: string | null): string {
    const platform = os.platform()
    const osVersion = os.release()
    const shell = process.env.SHELL || (platform === 'win32' ? 'cmd' : 'sh')
    const currentDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    let systemInfo = `<user_info>
OS Version: ${platform} ${osVersion}
Current Date: ${currentDate}
Shell: ${shell}`

    if (workspaceRoot) {
      systemInfo += `
Workspace Path: ${workspaceRoot}
Note: Prefer using absolute paths over relative paths as tool call args when possible.`
    }

    systemInfo += '\n</user_info>'

    return systemInfo
  }

  /**
   * 获取用户规则和 Memories(完整的 rules 部分)
   */
  private async getUserRulesAndMemories(): Promise<string | null> {
    try {
      // 从数据库读取用户自定义规则
      const db = getDb()
      const userRules = db.getUserRules()

      // 将规则转换为文本格式
      const rulesText =
        userRules.length > 0
          ? userRules.map((rule) => rule.content).join('\n')
          : ''

      // 加载持久化的 Memories
      const memoryService = new MemoryService()
      const memories = await memoryService.getAllMemories()

      const memoriesText =
        memories.length > 0
          ? memories.map((m) => `- ${m.content} (ID: ${m.id})`).join('\n')
          : ''

      let rulesContent = `<rules>
The rules section has a number of possible rules/memories/context that you should consider. In each subsection, we provide instructions about what information the subsection contains and how you should consider/follow the contents of the subsection.



<user_rules description="These are rules set by the user that you should follow if appropriate." count="${userRules.length}">
${rulesText || '(No custom rules set)'}
</user_rules>`

      // 添加 Memories 部分
      if (memoriesText) {
        rulesContent += `
<memories description="AI's persistent memories from previous conversations. These are facts, preferences, and context that the user has explicitly asked you to remember. Each memory has an ID in parentheses - use this ID when updating or deleting memories." count="${memories.length}">
${memoriesText}
</memories>`
      }

      rulesContent += '\n</rules>'

      return rulesContent
    } catch (error) {
      console.error('Failed to get user rules:', error)
      return null
    }
  }

  /**
   * Skills block for system prompt (Progressive Disclosure).
   * Metadata only here; full instructions via get_skill_details.
   */
  private async getSkillsSection(params: {
    workspaceRoot: string | null
  }): Promise<string | null> {
    try {
      const skillsService = SkillsService.getInstance()
      const allMetadata = await skillsService.getEnabledSkillsMetadata(
        params.workspaceRoot || undefined
      )

      if (allMetadata.length === 0) {
        return null
      }

      let section = `<skills>
You have access to specialized skills that enhance your capabilities.
Each skill provides domain expertise, new capabilities, or repeatable workflows.

## Available Skills (Total: ${allMetadata.length})

`

      for (const metadata of allMetadata) {
        const tagsStr = metadata.tags ? ` [${metadata.tags.join(', ')}]` : ''
        section += `- **${metadata.name}**${tagsStr}: ${metadata.description}\n`
      }

      section += `
## How to Use

When a task aligns with a skill's domain:
1. Call \`get_skill_details\` with the exact skill name
2. Follow the detailed instructions provided
3. Apply the skill's guidance to complete the task

Only activate skills when they add value to the current task.

</skills>`

      return section
    } catch (error) {
      console.error('[ContextEnrichment] Failed to get skills section:', error)
      return null
    }
  }

  /**
   * 获取当前打开的文件列表
   */
  private async getOpenFiles(
    configService: ConfigService,
    workspaceRoot?: string | null
  ): Promise<string | null> {
    try {
      const uiState = configService.getUIState()
      const openFiles = uiState.codeEditor?.openFiles || []

      if (openFiles.length === 0) {
        return null
      }

      // 只显示当前项目的文件
      const relevantFiles = workspaceRoot
        ? openFiles.filter((f: { path: string }) => f.path.startsWith(workspaceRoot))
        : openFiles

      if (relevantFiles.length === 0) {
        return null
      }

      const filesList = relevantFiles
        .map((f: { path: string }) => {
          const relativePath = workspaceRoot ? path.relative(workspaceRoot, f.path) : f.path
          return `  - ${relativePath}`
        })
        .join('\n')

      const activeFile = uiState.codeEditor?.activeFilePath
      const activeFileName =
        activeFile && workspaceRoot
          ? path.relative(workspaceRoot, activeFile)
          : activeFile
            ? path.basename(activeFile)
            : 'none'

      return `<open_and_recently_viewed_files>
Recently viewed files (${relevantFiles.length} files, recent at the top, oldest at the bottom):
${filesList}

Files that are currently open and visible in the user's IDE:
  - ${activeFileName} (currently focused file)

Note: these files may or may not be relevant to the current conversation. Use the read_file tool if you need to get the contents of some of them.
</open_and_recently_viewed_files>`
    } catch (error) {
      console.error('Failed to get open files:', error)
      return null
    }
  }
}
