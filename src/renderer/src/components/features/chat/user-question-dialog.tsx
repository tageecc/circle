import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface UserQuestionPayload {
  questionId: string
  sessionId: string
  assistantMessageId: number
  question: string
  options?: string[]
  allowFreeText: boolean
}

interface UserQuestionDialogProps {
  payload: UserQuestionPayload | null
  onSubmit: (answer: string) => void
}

export function UserQuestionDialog({ payload, onSubmit }: UserQuestionDialogProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  useEffect(() => {
    if (payload) setText('')
  }, [payload?.questionId])

  const open = Boolean(payload)
  if (!payload) return null

  const hasChoices = Boolean(payload.options?.length)
  const showTextarea = !hasChoices || payload.allowFreeText

  const handleChoice = (value: string) => {
    onSubmit(value)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v && hasChoices && !payload.allowFreeText) return
    onSubmit(v || '(empty reply)')
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onSubmit('(skipped)')
        }}
        className="sm:max-w-lg"
      >
        <form onSubmit={handleFormSubmit}>
          <DialogHeader>
            <DialogTitle>{t('chat.user_question_title')}</DialogTitle>
            <DialogDescription className="text-left text-foreground/90">
              {payload.question}
            </DialogDescription>
          </DialogHeader>

          {hasChoices && (
            <div className="flex flex-col gap-2 py-2">
              {payload.options!.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-9 justify-start whitespace-normal py-2 text-left font-normal"
                  onClick={() => handleChoice(opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          )}

          {showTextarea && (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('chat.user_question_placeholder')}
              className="min-h-[88px] resize-y"
              autoFocus={!hasChoices}
            />
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {showTextarea && (
              <Button type="submit" disabled={!text.trim()}>
                {t('chat.user_question_submit')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
