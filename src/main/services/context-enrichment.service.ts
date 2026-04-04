import os from 'os'
import path from 'path'
import type { ConfigService } from './config.service'
import { MemoryService } from './memory.service'
import { SkillsService } from './skills.service'
import { getDb } from '../database/db'
import { GitService } from './git.service'
import { AGENT_HARNESS } from '../constants/service.constants'

export class ContextEnrichmentService {
  private static instance: ContextEnrichmentService

  private constructor() {
    void 0
  }

  static getInstance(): ContextEnrichmentService {
    if (!ContextEnrichmentService.instance) {
      ContextEnrichmentService.instance = new ContextEnrichmentService()
    }
    return ContextEnrichmentService.instance
  }

  /**
   * Layered system prompt: stable intro + boundary + per-turn environment + behavior contract.
   * Boundary separates content that could be prompt-cached in the future (Anthropic) from volatile state.
   */
  async buildSystemPrompt(params: {
    modelId: string
    assistantInstructions: string
    workspaceRoot: string | null
    configService: ConfigService
    /** Injected when MCP tool catalog or connection set changes vs last turn */
    mcpEnvironmentNote?: string | null
  }): Promise<string> {
    const { modelId, assistantInstructions, workspaceRoot, configService, mcpEnvironmentNote } =
      params

    const staticIntro = `You are the AI coding assistant in Circle IDE (model: ${modelId}). You pair-program with the user: ship working changes, prefer dedicated tools over shell when available, and never claim you ran a tool without a real tool result.`

    const systemInfo = this.getSystemInfo(workspaceRoot)
    const gitSection = workspaceRoot ? await this.getGitWorkingState(workspaceRoot) : null
    const rulesAndMemories = await this.getUserRulesAndMemories()
    const skillsSection = await this.getSkillsSection({ workspaceRoot })
    const openFiles = await this.getOpenFiles(configService, workspaceRoot)

    const dynamicParts: string[] = [systemInfo]
    if (gitSection) dynamicParts.push(gitSection)
    if (rulesAndMemories) dynamicParts.push(rulesAndMemories)
    if (skillsSection) dynamicParts.push(skillsSection)
    if (openFiles) dynamicParts.push(openFiles)
    if (mcpEnvironmentNote) {
      dynamicParts.push(`<mcp_environment>\n${mcpEnvironmentNote}\n</mcp_environment>`)
    }
    dynamicParts.push(this.getContextPriorityBlock())

    const dynamicJoined = dynamicParts.filter(Boolean).join('\n\n')

    return [
      staticIntro,
      AGENT_HARNESS.DYNAMIC_CONTEXT_BOUNDARY,
      dynamicJoined,
      '',
      assistantInstructions
    ]
      .filter((s) => s.length > 0)
      .join('\n')
  }

  /**
   * Short git snapshot (branch + short status) for coding awareness.
   */
  private async getGitWorkingState(workspaceRoot: string): Promise<string | null> {
    try {
      const status = await GitService.getStatus(workspaceRoot)
      const files = [
        ...status.staged.map((p) => `staged:${p}`),
        ...status.modified.map((p) => `modified:${p}`),
        ...status.deleted.map((p) => `deleted:${p}`),
        ...status.untracked.slice(0, 30).map((p) => `untracked:${p}`)
      ]
      const body = [
        `On branch: ${status.branch}`,
        `Ahead/behind: ${status.ahead}/${status.behind}`,
        files.length
          ? `Working tree (truncated): ${files.slice(0, 80).join('; ')}`
          : 'Working tree clean.'
      ].join('\n')
      const block = `<git_working_state>\n${body}\n</git_working_state>`
      return block.length > AGENT_HARNESS.GIT_SNIPPET_MAX_CHARS
        ? block.slice(0, AGENT_HARNESS.GIT_SNIPPET_MAX_CHARS) + '\n[…]</git_working_state>'
        : block
    } catch {
      return null
    }
  }

  private getContextPriorityBlock(): string {
    return `<context_priority>
This system prompt is rebuilt for every user message. For factual questions about the current workspace (skills count, open files, git), trust the sections above — not earlier chat turns.
Answer in natural language; do not mention internal tags, XML, or tool names to the user.
</context_priority>`
  }

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
Note: Prefer absolute paths in tool arguments when possible.`
    }

    systemInfo += '\n</user_info>'

    return systemInfo
  }

  private async getUserRulesAndMemories(): Promise<string | null> {
    try {
      const db = getDb()
      const userRules = db.getUserRules()
      const rulesText = userRules.length > 0 ? userRules.map((rule) => rule.content).join('\n') : ''

      const memoryService = new MemoryService()
      const memories = await memoryService.getAllMemories()
      const memoriesText =
        memories.length > 0 ? memories.map((m) => `- ${m.content} (ID: ${m.id})`).join('\n') : ''

      let rulesContent = `<rules>
<user_rules description="User-defined rules." count="${userRules.length}">
${rulesText || '(No custom rules set)'}
</user_rules>`

      if (memoriesText) {
        rulesContent += `
<memories description="Persistent memories; use IDs with update_memory." count="${memories.length}">
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

  private async getSkillsSection(params: { workspaceRoot: string | null }): Promise<string | null> {
    try {
      const skillsService = SkillsService.getInstance()
      const allMetadata = await skillsService.getEnabledSkillsMetadata(
        params.workspaceRoot || undefined
      )

      if (allMetadata.length === 0) {
        return null
      }

      let section = `<skills>
## Available Skills (${allMetadata.length})

`

      for (const metadata of allMetadata) {
        const tagsStr = metadata.tags ? ` [${metadata.tags.join(', ')}]` : ''
        section += `- **${metadata.name}**${tagsStr}: ${metadata.description}\n`
      }

      section += `
Use \`get_skill_details\` with the exact skill name when a task matches a skill.

</skills>`

      return section
    } catch (error) {
      console.error('[ContextEnrichment] Failed to get skills section:', error)
      return null
    }
  }

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
Recently viewed (${relevantFiles.length}):
${filesList}

Focused file: ${activeFileName}
</open_and_recently_viewed_files>`
    } catch (error) {
      console.error('Failed to get open files:', error)
      return null
    }
  }
}
