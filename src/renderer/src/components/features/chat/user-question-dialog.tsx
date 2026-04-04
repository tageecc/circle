/**
 * User Question Dialog for interactive AI-user communication
 * Supports batch questions, structured options with previews, multiSelect, and Skip/Continue semantics
 */

import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export interface QuestionOption {
  label: string
  description: string
  preview?: string
}

export interface Question {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

export interface UserQuestionPayload {
  questionId: string
  sessionId: string
  assistantMessageId: number
  questions: Question[]
  metadata?: {
    source?: string
  }
  isInPlanMode?: boolean
}

interface UserQuestionDialogProps {
  questionId: string
  sessionId: string
  questions: Question[]
  metadata?: {
    source?: string
  }
  isInPlanMode?: boolean
  onSubmit: (
    result:
      | { type: 'answered'; answers: Record<string, string>; annotations?: Record<string, any> }
      | { type: 'skipped' }
      | { type: 'rejected'; feedback: string }
  ) => void
  onClose: () => void
}

export function UserQuestionDialog({
  questions,
  isInPlanMode = false,
  onSubmit,
  onClose
}: UserQuestionDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [annotations, setAnnotations] = useState<
    Record<string, { notes?: string; images?: Array<{ dataUrl: string; name: string }> }>
  >({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Set<string>>>({})
  const [focusedOption, setFocusedOption] = useState<string | null>(null)
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({})
  const [skipFeedback, setSkipFeedback] = useState('')
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  if (!questions || questions.length === 0) {
    return null
  }

  const currentQuestion = questions[currentIndex]
  const questionKey = currentQuestion.question

  useEffect(() => {
    // Auto-focus first option on mount and when changing questions
    if (currentQuestion.options[0]) {
      setFocusedOption(currentQuestion.options[0].label)
    }
  }, [currentIndex])

  const handleOptionClick = (optionLabel: string) => {
    const currentSet = selectedOptions[questionKey] || new Set()

    if (currentQuestion.multiSelect) {
      const newSet = new Set(currentSet)
      if (newSet.has(optionLabel)) {
        newSet.delete(optionLabel)
      } else {
        newSet.add(optionLabel)
      }
      setSelectedOptions({ ...selectedOptions, [questionKey]: newSet })
    } else {
      setSelectedOptions({ ...selectedOptions, [questionKey]: new Set([optionLabel]) })
    }
    setFocusedOption(optionLabel)
  }

  const handleOtherInput = (value: string) => {
    setOtherInputs({ ...otherInputs, [questionKey]: value })
  }

  const handleNotesChange = (notes: string) => {
    setAnnotations({
      ...annotations,
      [questionKey]: { ...annotations[questionKey], notes }
    })
  }

  const handleRemoveImage = (imageIndex: number) => {
    const currentImages = annotations[questionKey]?.images || []
    setAnnotations({
      ...annotations,
      [questionKey]: {
        ...annotations[questionKey],
        images: currentImages.filter((_, idx) => idx !== imageIndex)
      }
    })
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handlePaste = (e: Event) => {
      const clipboardEvent = e as globalThis.ClipboardEvent
      const items = clipboardEvent.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          clipboardEvent.preventDefault()
          const file = item.getAsFile()
          if (!file) continue

          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            setAnnotations((prev) => {
              const currentImages = prev[questionKey]?.images || []
              return {
                ...prev,
                [questionKey]: {
                  ...prev[questionKey],
                  images: [...currentImages, { dataUrl, name: file.name || 'pasted-image.png' }]
                }
              }
            })
          }
          reader.readAsDataURL(file)
        }
      }
    }

    dialog.addEventListener('paste', handlePaste)
    return () => {
      dialog.removeEventListener('paste', handlePaste)
    }
  }, [questionKey])

  const handleNext = () => {
    const currentSet = selectedOptions[questionKey] || new Set()
    const currentOther = otherInputs[questionKey]

    if (currentSet.size > 0 || currentOther) {
      const answerText = currentOther || Array.from(currentSet).join(', ')
      setAnswers({ ...answers, [questionKey]: answerText })
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleContinue = () => {
    // Collect current question's answer
    const currentSet = selectedOptions[questionKey] || new Set()
    const currentOther = otherInputs[questionKey]

    const finalAnswers = { ...answers }
    if (currentSet.size > 0 || currentOther) {
      finalAnswers[questionKey] = currentOther || Array.from(currentSet).join(', ')
    }

    // If any question lacks an answer, warn user
    const unansweredQuestions = questions.filter((q) => !finalAnswers[q.question])
    if (unansweredQuestions.length > 0) {
      const proceed = confirm(
        `${unansweredQuestions.length} question(s) not answered. Continue anyway?`
      )
      if (!proceed) return
    }

    onSubmit({
      type: 'answered',
      answers: finalAnswers,
      annotations: Object.keys(annotations).length > 0 ? annotations : undefined
    })
    onClose()
  }

  const handleSkip = () => {
    setShowSkipDialog(true)
  }

  const handleSkipConfirm = () => {
    if (!skipFeedback.trim()) {
      onSubmit({ type: 'skipped' })
    } else {
      onSubmit({ type: 'rejected', feedback: skipFeedback })
    }
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleSkip()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleContinue()
    }
  }

  const renderPreview = () => {
    if (!focusedOption) return null
    const option = currentQuestion.options.find((opt) => opt.label === focusedOption)
    if (!option?.preview) return null

    const isHtml = option.preview.trim().startsWith('<')
    if (isHtml) {
      const sanitized = DOMPurify.sanitize(option.preview, {
        ALLOWED_TAGS: [
          'div',
          'span',
          'p',
          'pre',
          'code',
          'strong',
          'em',
          'ul',
          'ol',
          'li',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'a',
          'br'
        ],
        ALLOWED_ATTR: ['class', 'href', 'target', 'style']
      })
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none overflow-auto"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )
    } else {
      const html = marked.parse(option.preview, { async: false }) as string
      const sanitized = DOMPurify.sanitize(html)
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none overflow-auto"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )
    }
  }

  const hasPreview = currentQuestion.options.some((opt) => opt.preview)
  const currentSet = selectedOptions[questionKey] || new Set()
  const currentOther = otherInputs[questionKey]

  return (
    <Dialog.Root open={true} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" onKeyDown={handleKeyDown} />
        <Dialog.Content
          ref={dialogRef}
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'bg-background border border-border rounded-lg shadow-lg',
            'w-[90vw] max-w-5xl max-h-[85vh]',
            'flex flex-col',
            'focus:outline-none'
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </div>
              <div className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                {currentQuestion.header}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main content */}
            <div className={cn('flex-1 flex flex-col overflow-hidden', hasPreview && 'w-1/2')}>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Question */}
                <div className="text-lg font-semibold">{currentQuestion.question}</div>

                {/* Options */}
                <div className="space-y-2">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = currentSet.has(option.label)
                    const isFocused = focusedOption === option.label
                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionClick(option.label)}
                        onMouseEnter={() => setFocusedOption(option.label)}
                        className={cn(
                          'w-full text-left p-4 rounded border transition-all',
                          isSelected
                            ? 'bg-primary/10 border-primary'
                            : isFocused
                              ? 'bg-muted border-muted-foreground'
                              : 'bg-card border-border hover:bg-muted'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 w-4 h-4 rounded border flex items-center justify-center',
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'bg-transparent border-border'
                            )}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-primary-foreground"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {option.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Other input */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Other (optional)</div>
                  <Textarea
                    ref={textareaRef}
                    value={currentOther || ''}
                    onChange={(e) => handleOtherInput(e.target.value)}
                    placeholder="Type a custom answer..."
                    className="min-h-[80px] resize-none"
                  />
                </div>

                {/* Annotations */}
                {focusedOption && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Notes (optional) - Paste images with Cmd+V
                    </div>
                    <Textarea
                      value={annotations[questionKey]?.notes || ''}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Add any clarifying notes about your selection..."
                      className="min-h-[60px] resize-none"
                    />
                    {annotations[questionKey]?.images &&
                      annotations[questionKey].images!.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {annotations[questionKey].images!.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={img.dataUrl}
                                alt={img.name}
                                className="h-20 w-20 object-cover rounded border border-border"
                              />
                              <button
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
                <Button variant="outline" onClick={handleSkip}>
                  Skip (ESC)
                </Button>
                <div className="flex items-center gap-2">
                  {questions.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {currentIndex < questions.length - 1 && (
                        <Button onClick={handleNext}>
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </>
                  )}
                  {currentIndex === questions.length - 1 && (
                    <Button onClick={handleContinue}>Continue (⌘↵)</Button>
                  )}

                  {/* Plan Mode: Skip interview and plan immediately */}
                  {isInPlanMode && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const currentAnswers: Record<string, string> = {}
                        Object.keys(answers).forEach((key) => {
                          if (answers[key]) {
                            currentAnswers[key] = answers[key]
                          }
                        })

                        const feedbackText =
                          `The user has indicated they have provided enough answers for the plan interview.
Stop asking clarifying questions and proceed to finish the plan with the information you have.

Questions asked and answers provided:
${
  Object.entries(currentAnswers)
    .map(([q, a]) => `- "${q}"\n  Answer: ${a}`)
    .join('\n') || '(No answers provided yet)'
}`.trim()

                        onSubmit({ type: 'rejected', feedback: feedbackText })
                        onClose()
                      }}
                      className="whitespace-nowrap text-xs"
                    >
                      Skip interview and plan immediately
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Preview pane */}
            {hasPreview && (
              <div className="w-1/2 border-l border-border bg-muted/30 overflow-y-auto p-6">
                <div className="text-sm font-medium text-muted-foreground mb-3">Preview</div>
                {renderPreview() || (
                  <div className="text-sm text-muted-foreground italic">
                    Hover over an option to see preview
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Skip feedback dialog */}
      <Dialog.Root open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-60 bg-background border border-border rounded-lg shadow-lg w-[90vw] max-w-md p-6 focus:outline-none">
            <Dialog.Title className="text-lg font-semibold mb-3">
              Skip these questions?
            </Dialog.Title>
            <div className="text-sm text-muted-foreground mb-4">
              You can skip without feedback, or provide clarification about what you need instead.
            </div>
            <Textarea
              value={skipFeedback}
              onChange={(e) => setSkipFeedback(e.target.value)}
              placeholder="Optional: Explain what you'd prefer or need clarification on..."
              className="min-h-[100px] mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSkipDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSkipConfirm}>
                {skipFeedback.trim() ? 'Send feedback' : 'Skip'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  )
}
