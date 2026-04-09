/**
 * Ask the user questions and block until they answer.
 * Supports batch questions, structured options with previews, multiSelect, and annotations.
 */

import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { getToolContext } from '../services/tool-context'
import { sendToRenderer } from '../utils/ipc'
import { SessionService } from '../services/session.service'
import type { SessionMetadata } from '../types/session'

const pendingAnswers = new Map<string, (result: AnswerResult) => void>()

const questionOptionSchema = z.object({
  label: z
    .string()
    .describe(
      'The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.'
    ),
  description: z
    .string()
    .describe(
      'Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.'
    ),
  preview: z
    .string()
    .optional()
    .describe(
      'Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. HTML fragment (no <html>/<body>, no <script>/<style>) or Markdown text.'
    )
})

const questionSchema = z.object({
  question: z
    .string()
    .describe(
      'The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"'
    ),
  header: z
    .string()
    .max(20)
    .describe(
      'Very short label displayed as a chip/tag (max 20 chars). Examples: "Auth method", "Library", "Approach".'
    ),
  options: z
    .array(questionOptionSchema)
    .min(2)
    .max(6)
    .describe(
      'The available choices for this question. Must have 2-6 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled).'
    ),
  multiSelect: z
    .boolean()
    .default(false)
    .describe(
      'Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.'
    )
})

const inputSchema = z.object({
  questions: z
    .array(questionSchema)
    .min(1)
    .max(4)
    .describe(
      'Questions to ask the user (1-4 questions). Multiple questions are presented with navigation.'
    ),
  metadata: z
    .object({
      source: z
        .string()
        .optional()
        .describe(
          'Optional identifier for the source of this question (e.g., "brainstorm", "plan"). Used for analytics.'
        )
    })
    .optional()
    .describe('Optional metadata for tracking and analytics purposes. Not displayed to user.')
})

type AnswerResult =
  | { type: 'answered'; answers: Record<string, string>; annotations?: Record<string, any> }
  | { type: 'skipped' }
  | { type: 'rejected'; feedback: string }

export function resolveUserQuestionAnswer(questionId: string, result: AnswerResult): void {
  const pending = pendingAnswers.get(questionId)
  if (pending) {
    pending(result)
    pendingAnswers.delete(questionId)
  } else {
    console.warn('[ask_user] No pending question for id:', questionId)
  }
}

export function cancelUserQuestion(questionId: string): boolean {
  const pending = pendingAnswers.get(questionId)
  if (!pending) {
    return false
  }
  pendingAnswers.delete(questionId)
  pending({ type: 'skipped' })
  return true
}

export const askUserTool = defineTool({
  description: `Ask the user multiple choice questions to gather information, clarify ambiguity, understand preferences, make decisions or offer them choices. Returns JSON: {"success":true,"answers":{...},"annotations":{...}} or {"success":false,"skipped":true} or {"success":false,"rejected":true,"feedback":"..."}.

### When to Use This Tool

Use when you need to:
- Gather user preferences or requirements
- Clarify ambiguous instructions
- Get decisions on implementation choices as you work
- Offer choices to the user about what direction to take
- Present multiple options with trade-offs

### Question Structure

Each question can have:
- **question**: Complete question text
- **header**: Short label (max 20 chars) for UI chip
- **options**: 2-6 structured options, each with:
  - **label**: Short choice text (1-5 words)
  - **description**: Detailed explanation of this choice
  - **preview** (optional): HTML or Markdown mockup for visual comparison
- **multiSelect**: Allow selecting multiple options (default false)

### Preview Feature

Use \`preview\` field when presenting concrete artifacts users need to visually compare:
- Code snippets showing different implementations
- ASCII/HTML mockups of UI layouts
- Configuration examples
- Architecture diagrams

Preview content is rendered in a side-by-side layout. Use HTML fragments (no <html>/<body>, no <script>/<style>) or Markdown. Do not use previews for simple preference questions where labels and descriptions suffice.

### Skip vs Continue

Users can:
- **Skip (ESC)**: Reject the questions and provide feedback about what they want to clarify
- **Continue (Enter)**: Submit their current answers and let you proceed
- **Other**: Type custom answer for any question (automatically available)

When the user skips, you receive \`skipped: true\`.
When the user rejects to clarify, you receive \`rejected: true\` with their feedback text, allowing you to reformulate questions or ask differently.

### Examples

<example>
  Single question with previews:
  {
    questions: [{
      question: "Which authentication method should we use?",
      header: "Auth method",
      options: [
        {
          label: "JWT tokens",
          description: "Stateless auth with signed tokens, scales horizontally",
          preview: "// JWT implementation\\nconst token = jwt.sign(payload, secret)\\n..."
        },
        {
          label: "Session cookies",
          description: "Server-side sessions, simpler but requires sticky sessions",
          preview: "// Session implementation\\nreq.session.userId = user.id\\n..."
        }
      ]
    }]
  }
</example>

<example>
  Multiple questions without previews:
  {
    questions: [
      {
        question: "What is your experience level with React?",
        header: "Experience",
        options: [
          { label: "Beginner", description: "New to React, learning basics" },
          { label: "Intermediate", description: "Comfortable with hooks and state" },
          { label: "Expert", description: "Deep knowledge of internals" }
        ]
      },
      {
        question: "Do you prefer TypeScript?",
        header: "Language",
        options: [
          { label: "Yes", description: "Use TypeScript for type safety" },
          { label: "No", description: "Use plain JavaScript" }
        ]
      }
    ]
  }
</example>

<example>
  Multi-select question:
  {
    questions: [{
      question: "Which features do you want to enable?",
      header: "Features",
      multiSelect: true,
      options: [
        { label: "Dark mode", description: "Toggle between light and dark themes" },
        { label: "Notifications", description: "Push notifications for updates" },
        { label: "Analytics", description: "Usage tracking and insights" }
      ]
    }]
  }
</example>`,
  inputSchema,
  execute: async ({ questions, metadata }, toolOptions: ToolCallOptions) => {
    const ctx = getToolContext(toolOptions)
    const questionId = toolOptions.toolCallId || `ask_user_${nanoid()}`

    await new Promise((r) => setTimeout(r, 80))

    await SessionService.updateToolApprovalStatus(ctx.assistantMessageId, questionId, {
      needsApproval: true,
      approvalStatus: 'pending',
      state: 'pending'
    })

    // Check if in plan mode
    const session = await SessionService.getSession(ctx.sessionId)
    const sessionMetadata = (session?.metadata as SessionMetadata) || {}
    const isInPlanMode = sessionMetadata.mode === 'plan'

    sendToRenderer(
      'chat:user-question',
      {
        questionId,
        sessionId: ctx.sessionId,
        assistantMessageId: ctx.assistantMessageId,
        questions,
        metadata,
        isInPlanMode
      },
      ctx.senderWebContentsId ? { webContentsId: ctx.senderWebContentsId } : undefined
    )

    if (ctx.abortSignal?.aborted) {
      await SessionService.updateToolApprovalStatus(ctx.assistantMessageId, questionId, {
        needsApproval: false,
        approvalStatus: 'skipped',
        state: 'completed'
      })
      return JSON.stringify({ success: false, skipped: true })
    }

    const result = await new Promise<AnswerResult>((resolve) => {
      const finalize = (value: AnswerResult) => {
        ctx.abortSignal?.removeEventListener('abort', handleAbort)
        resolve(value)
      }

      const handleAbort = () => {
        cancelUserQuestion(questionId)
      }

      pendingAnswers.set(questionId, finalize)
      if (ctx.abortSignal) {
        ctx.abortSignal.addEventListener('abort', handleAbort, { once: true })
      }
    })

    await SessionService.updateToolApprovalStatus(ctx.assistantMessageId, questionId, {
      needsApproval: false,
      approvalStatus:
        result.type === 'answered'
          ? 'approved'
          : result.type === 'skipped'
            ? 'skipped'
            : 'rejected',
      state: 'completed'
    })

    if (result.type === 'skipped') {
      return JSON.stringify({ success: false, skipped: true })
    }

    if (result.type === 'rejected') {
      return JSON.stringify({
        success: false,
        rejected: true,
        feedback: result.feedback,
        message:
          'User wants to clarify or provide additional context. Take their feedback into account and reformulate questions if appropriate.'
      })
    }

    return JSON.stringify({
      success: true,
      questions,
      answers: result.answers,
      annotations: result.annotations
    })
  }
})
