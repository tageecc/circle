/**
 * Submit from Previous Message Dialog
 * 参考 Cursor 设计：当用户编辑历史消息并重新提交时显示
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface SubmitFromPreviousDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (shouldRevert: boolean) => void
  filesCount?: number
}

export function SubmitFromPreviousDialog({
  open,
  onOpenChange,
  onSubmit
}: SubmitFromPreviousDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  const handleContinueWithoutReverting = () => {
    if (dontAskAgain) {
      // 保存用户偏好到本地存储
      localStorage.setItem('submitFromPrevious:dontAsk', 'true')
      localStorage.setItem('submitFromPrevious:defaultAction', 'continue')
    }
    onSubmit(false)
    onOpenChange(false)
  }

  const handleContinueAndRevert = () => {
    if (dontAskAgain) {
      // 保存用户偏好到本地存储
      localStorage.setItem('submitFromPrevious:dontAsk', 'true')
      localStorage.setItem('submitFromPrevious:defaultAction', 'revert')
    }
    onSubmit(true)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Submit from a previous message?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
            Submitting from a previous message will revert file changes to before this message and
            clear the messages after this one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="dont-ask"
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <label
            htmlFor="dont-ask"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Don't ask again
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleCancel} className="text-sm">
            Cancel <span className="text-muted-foreground ml-1 text-xs">(esc)</span>
          </Button>
          <Button variant="secondary" onClick={handleContinueWithoutReverting} className="text-sm">
            Continue without reverting
            <svg className="ml-1 size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Button>
          <Button onClick={handleContinueAndRevert} className="text-sm">
            Continue and revert
            <svg className="ml-1 size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
