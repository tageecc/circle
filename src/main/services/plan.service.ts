/**
 * Plan Service - Manages plan files for Plan Mode
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { nanoid } from 'nanoid'

export class PlanService {
  /**
   * Create a plan file in the workspace root
   */
  static async createPlanFile(workspaceRoot: string): Promise<string> {
    const planId = nanoid(8)
    const fileName = `plan_${planId}.md`
    const planFilePath = path.join(workspaceRoot, fileName)

    const initialContent = `# Implementation Plan

## Goal
[Describe the overall goal of this task]

## Current Understanding
[What you've learned about the codebase so far]

## Approach
[Your proposed implementation strategy]

## Implementation Steps
1. [First step]
2. [Second step]
3. [Additional steps...]

## Open Questions
- [Any remaining questions or uncertainties]

## Testing Strategy
[How to verify the implementation works correctly]

## Risks & Considerations
[Potential issues or edge cases to watch out for]
`

    await fs.writeFile(planFilePath, initialContent, 'utf-8')

    return planFilePath
  }

  /**
   * Read plan file content
   */
  static async readPlanFile(planFilePath: string): Promise<string> {
    try {
      return await fs.readFile(planFilePath, 'utf-8')
    } catch (error) {
      console.error(`[PlanService] Failed to read plan file: ${planFilePath}`, error)
      return ''
    }
  }

  /**
   * Check if plan file exists
   */
  static async planFileExists(planFilePath: string): Promise<boolean> {
    try {
      await fs.access(planFilePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete plan file (cleanup after approval or cancellation)
   */
  static async deletePlanFile(planFilePath: string): Promise<void> {
    try {
      await fs.unlink(planFilePath)
      console.log(`[PlanService] Deleted plan file: ${planFilePath}`)
    } catch (error) {
      console.error(`[PlanService] Failed to delete plan file: ${planFilePath}`, error)
    }
  }

  /**
   * Get the relative path of the plan file from workspace root
   */
  static getRelativePlanPath(planFilePath: string, workspaceRoot: string): string {
    return path.relative(workspaceRoot, planFilePath)
  }
}
