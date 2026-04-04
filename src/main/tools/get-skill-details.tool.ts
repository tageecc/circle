import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { SkillsService } from '../services/skills.service'
import { getToolContext } from '../services/tool-context'

const inputSchema = z.object({
  skill_name: z
    .string()
    .describe(
      'The exact name of the skill to activate (e.g., "skill-creator", "data-analysis"). Must match the skill name exactly as listed in available skills.'
    )
})

/**
 * Load full skill instructions on demand (Progressive Disclosure).
 * System prompt only lists skill metadata; this tool returns the body.
 */
export const getSkillDetailsTool = defineTool({
  description:
    "Get the full instructions for a specific skill. Use when you need detailed guidance to complete a task that aligns with a skill's domain.",

  inputSchema,

  execute: async ({ skill_name }, options: ToolCallOptions) => {
    try {
      const { workspaceRoot } = getToolContext(options)
      const skillsService = SkillsService.getInstance()
      const skill = await skillsService.getSkillByName(skill_name, workspaceRoot || undefined)

      if (!skill) {
        return JSON.stringify({
          success: false,
          error: `Skill "${skill_name}" not found. Check the available skills list in the system prompt and ensure the name matches exactly (case-sensitive).`
        })
      }

      return JSON.stringify({
        success: true,
        skill: {
          name: skill.metadata.name,
          instructions: skill.instructions
        }
      })
    } catch (error) {
      console.error('[GetSkillDetails] Error:', error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
})
