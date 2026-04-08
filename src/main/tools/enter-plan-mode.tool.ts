/**
 * Enter Plan Mode - Switch to read-only exploration phase before coding
 */

import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { getToolContext } from '../services/tool-context'
import { SessionService } from '../services/session.service'
import { PlanService } from '../services/plan.service'
import { sendToRenderer } from '../utils/ipc'
import type { SessionMetadata } from '../types/session'

const inputSchema = z.object({})

export const enterPlanModeTool = defineTool({
  description: `Enter plan mode to explore the codebase and design an implementation approach before writing code.

## What is Plan Mode?

Plan mode is a read-only exploration phase where you:
1. Thoroughly explore the codebase using read-only tools
2. Understand existing patterns and architecture
3. Ask the user clarifying questions using ask_user
4. Design an implementation strategy
5. Write your plan to the plan file
6. Exit plan mode with exit_plan_mode to request approval

## When to Use This Tool

Use enter_plan_mode proactively for non-trivial tasks:

**Use for:**
- New feature implementation with multiple valid approaches
- Code modifications affecting existing behavior
- Architectural decisions requiring exploration
- Multi-file changes (>2-3 files)
- Unclear requirements needing investigation
- Tasks where user approval of approach is valuable

**Don't use for:**
- Simple typo fixes or single-line changes
- Tasks with very specific instructions
- Minor cosmetic changes
- Obvious bug fixes

## Important Rules in Plan Mode

While in plan mode, you can ONLY:
- ✅ Use read-only tools: read_file, grep, glob_file_search, codebase_search, list_dir
- ✅ Write to the plan file ONLY (use edit_file to update your plan)
- ✅ Use ask_user to clarify requirements or choose between approaches
- ✅ Use delegate_task with readonly=true for bounded exploration

You CANNOT:
- ❌ Edit code files
- ❌ Run terminal commands (run_terminal_cmd is disabled)
- ❌ Create/delete files (except the plan file)
- ❌ Use any write operations

## Plan File

After entering plan mode, a plan file will be created at:
- Path: {workspaceRoot}/plan_{id}.md
- You should write your plan to this file using edit_file tool
- This is the ONLY file you can edit in plan mode

## Workflow

1. Call enter_plan_mode
2. Explore the codebase thoroughly (read files, search patterns)
3. Ask clarifying questions with ask_user when needed
4. Write your findings and plan to the plan file
5. Call exit_plan_mode when your plan is complete
6. User reviews and approves the plan
7. You exit plan mode with full permissions and execute the plan

Returns JSON with success status and plan file path.`,

  inputSchema,

  execute: async (_, options: ToolCallOptions) => {
    try {
      const ctx = getToolContext(options)

      // 1. Get current session
      const session = await SessionService.getSession(ctx.sessionId)
      if (!session) {
        return JSON.stringify({
          success: false,
          error: 'Session not found'
        })
      }

      // 2. Check if already in plan mode
      const metadata = (session.metadata as SessionMetadata) || {}
      if (metadata.mode === 'plan') {
        return JSON.stringify({
          success: false,
          already_in_plan_mode: true,
          message: 'Already in plan mode',
          planFilePath: metadata.planFilePath
        })
      }

      // 3. Create plan file
      const planFilePath = await PlanService.createPlanFile(ctx.workspaceRoot)
      const relativePath = PlanService.getRelativePlanPath(planFilePath, ctx.workspaceRoot)

      // 4. Update session metadata
      await SessionService.updateSession(ctx.sessionId, {
        metadata: {
          ...metadata,
          mode: 'plan',
          planFilePath
        }
      })

      // 5. Notify frontend
      sendToRenderer('session:mode-changed', {
        sessionId: ctx.sessionId,
        mode: 'plan',
        planFilePath: relativePath
      }, ctx.senderWebContentsId ? { webContentsId: ctx.senderWebContentsId } : undefined)

      return JSON.stringify({
        success: true,
        message: `Entered plan mode. Plan file created at: ${relativePath}

You can now explore the codebase and write your plan. Remember:
- Use read-only tools to explore (read_file, grep, codebase_search, etc.)
- Write your plan to the plan file using edit_file
- Use ask_user to clarify requirements
- Call exit_plan_mode when your plan is complete

The plan file is the ONLY file you can edit in plan mode.`,
        planFilePath: relativePath
      })
    } catch (error) {
      console.error('[enter_plan_mode] Error:', error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
})
