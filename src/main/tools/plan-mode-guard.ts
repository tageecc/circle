/**
 * Plan Mode Guard - Shared utility for checking if session is in plan mode
 */

import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { getToolContext } from '../services/tool-context'
import { SessionService } from '../services/session.service'
import type { SessionMetadata } from '../types/session'

interface PlanModeCheck {
  isInPlanMode: boolean
  planFilePath?: string
}

/**
 * Check if the current session is in plan mode
 */
export async function checkPlanMode(options: ToolCallOptions): Promise<PlanModeCheck> {
  const ctx = getToolContext(options)

  const session = await SessionService.getSession(ctx.sessionId)
  const metadata = (session?.metadata as SessionMetadata) || {}

  return {
    isInPlanMode: metadata.mode === 'plan',
    planFilePath: metadata.planFilePath
  }
}

/**
 * Guard that blocks tool execution if in plan mode
 * Returns error JSON if blocked, null if allowed to proceed
 */
export async function guardAgainstPlanMode(
  options: ToolCallOptions,
  operationName: string
): Promise<string | null> {
  const { isInPlanMode } = await checkPlanMode(options)

  if (isInPlanMode) {
    return JSON.stringify({
      success: false,
      error: `${operationName} is not allowed in plan mode.`,
      hint: 'Plan mode is read-only. To make changes, exit plan mode first by calling exit_plan_mode.'
    })
  }

  return null
}
