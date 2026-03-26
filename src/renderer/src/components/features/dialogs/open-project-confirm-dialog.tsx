import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface OpenProjectConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (openInNewWindow: boolean, rememberChoice: boolean) => void
  projectName: string
}

export function OpenProjectConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  projectName
}: OpenProjectConfirmDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false)

  // ✅ 最简方案：对话框关闭时自动重置状态
  useEffect(() => {
    if (!open) {
      setRememberChoice(false)
    }
  }, [open])

  const handleConfirm = (openInNewWindow: boolean) => {
    onConfirm(openInNewWindow, rememberChoice)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>打开项目</DialogTitle>
          <DialogDescription>
            您想在新窗口中打开 &quot;{projectName}&quot; 还是在当前窗口中打开？
          </DialogDescription>
        </DialogHeader>

        {/* 记住选择选项 */}
        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="remember-choice"
            checked={rememberChoice}
            onCheckedChange={(checked) => setRememberChoice(checked as boolean)}
          />
          <Label
            htmlFor="remember-choice"
            className="text-sm font-normal cursor-pointer select-none"
          >
            记住我的选择
          </Label>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            取消
          </Button>
          <Button
            variant="outline"
            onClick={() => handleConfirm(false)}
            className="w-full sm:w-auto"
          >
            当前窗口
          </Button>
          <Button onClick={() => handleConfirm(true)} className="w-full sm:w-auto">
            新窗口
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
