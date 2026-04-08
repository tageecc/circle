/**
 * Exit Plan Mode Approval Dialog - Show plan and request user approval
 */

import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, FileText } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

interface ExitPlanApprovalDialogProps {
  approvalId: string
  planContent: string
  planFilePath: string
  onClose: () => void
}

export function ExitPlanApprovalDialog({
  approvalId,
  planContent,
  planFilePath,
  onClose
}: ExitPlanApprovalDialogProps) {
  const [feedback, setFeedback] = useState('')
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const renderPlan = () => {
    try {
      const html = marked.parse(planContent, { async: false }) as string
      const sanitized = DOMPurify.sanitize(html)
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )
    } catch (error) {
      console.error('Failed to render plan:', error)
      return <pre className="text-xs whitespace-pre-wrap">{planContent}</pre>
    }
  }

  const handleApprove = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      await window.api.plan.resolveApproval({
        approvalId,
        result: { type: 'approved', feedback: feedback.trim() || undefined }
      })
      onClose()
    } catch (error) {
      console.error('Failed to approve plan:', error)
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (isSubmitting) return

    if (!showFeedbackInput) {
      setShowFeedbackInput(true)
      return
    }

    if (!feedback.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      await window.api.plan.resolveApproval({
        approvalId,
        result: { type: 'rejected', feedback: feedback.trim() }
      })
      onClose()
    } catch (error) {
      console.error('Failed to reject plan:', error)
      setIsSubmitting(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return

      // ⌘/Ctrl + Enter to approve
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !showFeedbackInput) {
        e.preventDefault()
        handleApprove()
      }
      // Escape to toggle feedback input
      else if (e.key === 'Escape' && !showFeedbackInput) {
        e.preventDefault()
        setShowFeedbackInput(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, showFeedbackInput, feedback])

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          ref={dialogRef}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-lg shadow-lg w-[90vw] max-w-4xl max-h-[85vh] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-blue-500" />
              <Dialog.Title className="text-lg font-semibold">Ready to code?</Dialog.Title>
            </div>
            <Dialog.Description className="text-sm text-muted-foreground mt-1">
              Here is the AI's implementation plan:
            </Dialog.Description>
          </div>

          {/* Plan Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 border-y border-dashed border-border">
            {renderPlan()}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 space-y-3 shrink-0">
            <div className="text-sm text-muted-foreground">
              Would you like to proceed with this plan?
            </div>

            {/* Feedback Input (conditional) */}
            {showFeedbackInput && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  What needs to change in the plan?
                </label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide specific feedback on what needs to be adjusted..."
                  className="min-h-[100px] resize-none"
                  autoFocus
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <Check className="size-4" />
                Yes, implement this
                <span className="text-xs text-muted-foreground ml-1">(⌘↵)</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isSubmitting || (showFeedbackInput && !feedback.trim())}
                className={cn(
                  'flex items-center gap-2',
                  showFeedbackInput && feedback.trim() && 'bg-destructive/10 border-destructive/50'
                )}
              >
                <X className="size-4" />
                {showFeedbackInput ? 'Submit feedback' : 'No, need to adjust'}
                {!showFeedbackInput && (
                  <span className="text-xs text-muted-foreground ml-1">(ESC)</span>
                )}
              </Button>

              {showFeedbackInput && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowFeedbackInput(false)
                    setFeedback('')
                  }}
                  disabled={isSubmitting}
                  className="ml-auto"
                >
                  Cancel feedback
                </Button>
              )}
            </div>

            {/* Plan file path */}
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Plan file: <code className="text-foreground">{planFilePath}</code>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
