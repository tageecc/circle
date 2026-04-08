/**
 * Exit Plan Mode - Request user approval of the plan and exit to implementation phase
 */

import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { getToolContext } from '../services/tool-context'
import { SessionService } from '../services/session.service'
import { PlanService } from '../services/plan.service'
import { sendToRenderer } from '../utils/ipc'
import type { SessionMetadata } from '../types/session'

const pendingPlanApprovals = new Map<string, (result: PlanApprovalResult) => void>()

type PlanApprovalResult =
  | { type: 'approved'; feedback?: string }
  | { type: 'rejected'; feedback: string }

export function resolvePlanApproval(approvalId: string, result: PlanApprovalResult): void {
  const pending = pendingPlanApprovals.get(approvalId)
  if (pending) {
    pending(result)
    pendingPlanApprovals.delete(approvalId)
  } else {
    console.warn('[exit_plan_mode] No pending approval for id:', approvalId)
  }
}

const inputSchema = z.object({})

export const exitPlanModeTool = defineTool({
  description: `Exit plan mode and request user approval of your plan.

## When to Use This Tool

Use this tool when:
- ✅ You have finished writing your plan to the plan file
- ✅ The plan is complete and unambiguous
- ✅ All clarifying questions have been resolved
- ✅ You are ready for user review and approval

## IMPORTANT Rules

**DO:**
- Use THIS tool to request plan approval
- Ensure your plan file is complete before calling this tool
- Include clear implementation steps in your plan

**DO NOT:**
- Use ask_user to ask "Is this plan okay?" or "Should I proceed?"
- Call this tool with an empty or incomplete plan
- Ask about plan approval in any other way

## What Happens

When you call this tool:
1. The plan file content is read
2. A plan approval dialog is shown to the user
3. User can either:
   - **Approve**: Exit plan mode and proceed with implementation
   - **Reject with feedback**: Stay in plan mode to revise the plan
4. You receive the approval result and can proceed accordingly

## After Approval

If the user approves:
- Plan mode is exited
- Full tool permissions are restored
- You should implement the plan step by step
- The plan file remains as reference

If the user rejects:
- You stay in plan mode
- User provides feedback on what needs to change
- You should revise the plan based on feedback
- Call exit_plan_mode again when ready

Returns JSON with approval status and user feedback if provided.`,

  inputSchema,

  execute: async (_, options: ToolCallOptions) => {
    try {
      const ctx = getToolContext(options)

      // 1. Get session and check mode
      const session = await SessionService.getSession(ctx.sessionId)
      if (!session) {
        return JSON.stringify({
          success: false,
          error: 'Session not found'
        })
      }

      const metadata = (session.metadata as SessionMetadata) || {}

      if (metadata.mode !== 'plan') {
        return JSON.stringify({
          success: false,
          error: 'Not in plan mode. Use enter_plan_mode first.'
        })
      }

      const planFilePath = metadata.planFilePath
      if (!planFilePath) {
        return JSON.stringify({
          success: false,
          error: 'No plan file found. This should not happen.'
        })
      }

      // 2. Read plan content
      const planContent = await PlanService.readPlanFile(planFilePath)

      if (!planContent || planContent.trim().length === 0) {
        return JSON.stringify({
          success: false,
          error: 'Plan file is empty. Please write a plan before exiting plan mode.'
        })
      }

      // Check if plan is just the template
      if (planContent.includes('[Describe the overall goal') || planContent.trim().length < 200) {
        return JSON.stringify({
          success: false,
          error:
            'Plan appears incomplete (still contains template placeholders or is too short). Please complete your plan before requesting approval.',
          hint: 'A good plan should include: goal, current understanding, approach, implementation steps, and testing strategy.'
        })
      }

      // 3. Wait for user approval
      const approvalId = options.toolCallId || `exit_plan_${nanoid()}`
      const relativePath = PlanService.getRelativePlanPath(planFilePath, ctx.workspaceRoot)

      // Set tool to pending approval state
      await SessionService.updateToolApprovalStatus(ctx.assistantMessageId, approvalId, {
        needsApproval: true,
        approvalStatus: 'pending'
      })

      // Send to frontend
      sendToRenderer('plan:approval-required', {
        approvalId,
        sessionId: ctx.sessionId,
        assistantMessageId: ctx.assistantMessageId,
        planContent,
        planFilePath: relativePath
      }, ctx.senderWebContentsId ? { webContentsId: ctx.senderWebContentsId } : undefined)

      // Wait for user decision
      const result = await new Promise<PlanApprovalResult>((resolve) => {
        pendingPlanApprovals.set(approvalId, resolve)
      })

      // 4. Process approval result
      if (result.type === 'approved') {
        // Exit plan mode
        await SessionService.updateSession(ctx.sessionId, {
          metadata: {
            ...metadata,
            mode: 'default',
            planFilePath: undefined
          }
        })

        sendToRenderer('session:mode-changed', {
          sessionId: ctx.sessionId,
          mode: 'default',
          planFilePath: null
        }, ctx.senderWebContentsId ? { webContentsId: ctx.senderWebContentsId } : undefined)

        await SessionService.updateToolApprovalStatus(ctx.assistantMessageId, approvalId, {
          needsApproval: false,
          approvalStatus: 'approved'
        })

        return JSON.stringify({
          success: true,
          approved: true,
          message: `Plan approved! You can now proceed with implementation. Follow the steps in your plan (${relativePath}).`,
          userFeedback: result.feedback,
          planFilePath: relativePath
        })
      } else {
        // Rejected - stay in plan mode
        await SessionService.updateToolApprovalStatus(ctx.assistantMessageId, approvalId, {
          needsApproval: false,
          approvalStatus: 'rejected'
        })

        return JSON.stringify({
          success: false,
          approved: false,
          rejected: true,
          message:
            'Plan not approved. User wants adjustments. Please revise your plan based on the feedback below.',
          userFeedback: result.feedback,
          hint: 'Read the user feedback carefully, update the plan file accordingly, and call exit_plan_mode again when ready.'
        })
      }
    } catch (error) {
      console.error('[exit_plan_mode] Error:', error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
})
