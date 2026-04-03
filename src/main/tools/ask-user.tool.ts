/**
 * Ask the user a question and block until they answer (Cursor / Claude Code-style HITL).
 * Mirrors the terminal approval Promise pattern.
 */

import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { getToolContext } from '../services/tool-context'
import { sendToRenderer } from '../utils/ipc'
import { SessionService } from '../services/session.service'

const pendingAnswers = new Map<string, (answer: string) => void>()

const inputSchema = z.object({
  question: z.string().min(1).describe('Clear question for the user (one sentence preferred).'),
  options: z
    .array(z.string())
    .max(12)
    .optional()
    .describe(
      'Optional short choices (e.g. ["Option A", "Option B"]). If omitted, the user types a free-form reply.'
    ),
  allow_free_text: z
    .boolean()
    .optional()
    .default(true)
    .describe('If options are provided, whether the user can still type a custom answer instead of picking one.')
})

export function resolveUserQuestionAnswer(questionId: string, answer: string): void {
  const pending = pendingAnswers.get(questionId)
  if (pending) {
    pending(answer.trim() || '(empty reply)')
    pendingAnswers.delete(questionId)
  } else {
    console.warn('[ask_user] No pending question for id:', questionId)
  }
}

export const askUserTool = defineTool({
  description: `Ask the user a clarifying question and pause until they respond. Use when:
- Requirements are ambiguous or multiple valid approaches exist
- You need a preference (library, style, scope) before editing code
- A destructive or irreversible step needs explicit confirmation

Keep questions short. Prefer giving options when there are 2–6 realistic choices.
Do not use this for trivial confirmations; use it when the answer changes the plan.`,
  inputSchema,
  execute: async (
    { question, options: choiceOptions, allow_free_text: allowFreeText },
    toolOptions: ToolCallOptions
  ) => {
    const ctx = getToolContext(toolOptions)
    const questionId = toolOptions.toolCallId || `ask_user_${nanoid()}`
    const sessionService = new SessionService()

    await new Promise((r) => setTimeout(r, 80))

    await sessionService.updateToolApprovalStatus(ctx.assistantMessageId, questionId, {
      needsApproval: true,
      approvalStatus: 'pending',
      state: 'pending'
    })

    sendToRenderer('chat:user-question', {
      questionId,
      sessionId: ctx.sessionId,
      assistantMessageId: ctx.assistantMessageId,
      question,
      options: choiceOptions?.length ? choiceOptions : undefined,
      allowFreeText: allowFreeText !== false
    })

    const answer = await new Promise<string>((resolve) => {
      pendingAnswers.set(questionId, resolve)
    })

    await sessionService.updateToolApprovalStatus(ctx.assistantMessageId, questionId, {
      needsApproval: false,
      approvalStatus: 'approved',
      state: 'completed'
    })

    return `User replied: ${answer}`
  }
})
