/**
 * Hook: 管理消息回滚功能
 * 包含：Revert 按钮功能、Edit & Resubmit 功能、对话框管理
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { RevertFilesDialog } from '@/components/features/chat/revert-files-dialog'
import { SubmitFromPreviousDialog } from '@/components/features/chat/submit-from-previous-dialog'

type RevertAction = 'cancelled' | 'overwrite' | 'continue'

export function useMessageRevert() {
  const { t } = useTranslation()
  const [isReverting, setIsReverting] = useState(false)

  // Revert Dialog 状态
  const [showRevertDialog, setShowRevertDialog] = useState(false)
  const [revertMessageId, setRevertMessageId] = useState<number>(0)

  // Submit Dialog 状态
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [submitMessageId, setSubmitMessageId] = useState<number>(0)
  const [submitFilesCount, setSubmitFilesCount] = useState(0)
  const [submitResolver, setSubmitResolver] = useState<((value: RevertAction) => void) | null>(null)

  /**
   * 获取受影响的文件数量
   */
  const fetchAffectedFilesCount = useCallback(async (messageId: number) => {
    try {
      const files = await window.api.message.getAffectedFiles(messageId)
      return files.length
    } catch (error) {
      console.error('[MessageRevert] Failed to get affected files:', error)
      return 0
    }
  }, [])

  /**
   * 处理 Revert 按钮点击
   * 显示确认对话框，用户确认后执行文件回退
   */
  const handleRevert = useCallback(
    async (messageId: number) => {
      try {
        // 获取受影响的文件数量
        const count = await fetchAffectedFilesCount(messageId)

        if (count === 0) {
          toast.info(t('chat.toast_revert_no_files'))
          return
        }

        // 设置对话框数据并显示
        setRevertMessageId(messageId)
        setShowRevertDialog(true)
      } catch (error) {
        console.error('[MessageRevert] Failed to handle revert:', error)
        toast.error(t('errors.operation_failed'))
      }
    },
    [fetchAffectedFilesCount, t]
  )

  /**
   * 执行文件回退（由 RevertDialog 调用）
   */
  const executeRevert = useCallback(async () => {
    try {
      setIsReverting(true)

      const result = await window.api.message.revertFiles(revertMessageId)

      if (result.success) {
        toast.success(t('chat.toast_reverted_files', { count: result.filesRestored }))
      } else {
        throw new Error(t('chat.revert_failed_generic'))
      }

      return result
    } catch (error) {
      console.error('[MessageRevert] Failed to execute revert:', error)
      const err = error instanceof Error ? error : new Error('Unknown error')
      toast.error(t('chat.toast_revert_failed', { message: err.message }))
      throw err
    } finally {
      setIsReverting(false)
    }
  }, [revertMessageId, t])

  /**
   * 处理 Edit & Resubmit 功能
   * 显示确认对话框，返回用户选择
   */
  const handleEditAndResubmit = useCallback(
    async (messageId: number): Promise<RevertAction> => {
      try {
        // 获取受影响的文件数量
        const count = await fetchAffectedFilesCount(messageId)

        if (count === 0) {
          // 没有文件需要回退，直接继续
          return 'continue'
        }

        // 检查用户偏好
        const dontAskAgain = localStorage.getItem('submitFromPrevious:dontAsk') === 'true'
        const defaultAction = localStorage.getItem('submitFromPrevious:defaultAction')

        if (dontAskAgain && defaultAction) {
          // 用户设置了不再询问，直接执行默认操作
          if (defaultAction === 'revert') {
            await window.api.message.revertFiles(messageId)
            return 'overwrite'
          } else {
            return 'continue'
          }
        }

        // 显示对话框
        setSubmitMessageId(messageId)
        setSubmitFilesCount(count)
        setShowSubmitDialog(true)

        // 返回 Promise，等待用户选择
        return new Promise((resolve) => {
          setSubmitResolver(() => resolve)
        })
      } catch (error) {
        console.error('[MessageRevert] Failed to handle edit and resubmit:', error)
        toast.error(t('errors.operation_failed'))
        return 'cancelled'
      }
    },
    [fetchAffectedFilesCount, t]
  )

  /**
   * 处理 Submit Dialog 的提交
   */
  const handleSubmitDialogSubmit = useCallback(
    async (shouldRevert: boolean) => {
      try {
        // 如果选择覆盖，执行文件回退
        if (shouldRevert) {
          setIsReverting(true)
          await window.api.message.revertFiles(submitMessageId)
          setIsReverting(false)
          toast.success(t('chat.toast_reverted_files', { count: submitFilesCount }))
          submitResolver?.('overwrite')
        } else {
          submitResolver?.('continue')
        }
      } catch (error) {
        console.error('[MessageRevert] Failed to submit:', error)
        toast.error(t('errors.operation_failed'))
        setIsReverting(false)
        submitResolver?.('cancelled')
      }
    },
    [submitMessageId, submitFilesCount, submitResolver, t]
  )

  /**
   * 处理对话框关闭（包括取消）
   */
  const handleSubmitDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setShowSubmitDialog(false)
        // 如果对话框关闭但没有调用 submit，说明用户取消了
        if (submitResolver) {
          submitResolver('cancelled')
          setSubmitResolver(null)
        }
      }
    },
    [submitResolver]
  )

  // Revert Dialog 组件
  const RevertDialog = showRevertDialog ? (
    <RevertFilesDialog
      open={showRevertDialog}
      onOpenChange={setShowRevertDialog}
      messageId={revertMessageId}
      onConfirm={executeRevert}
    />
  ) : null

  // Submit Dialog 组件
  const SubmitDialog = showSubmitDialog ? (
    <SubmitFromPreviousDialog
      open={showSubmitDialog}
      onOpenChange={handleSubmitDialogClose}
      onSubmit={handleSubmitDialogSubmit}
      filesCount={submitFilesCount}
    />
  ) : null

  return {
    isReverting,
    handleRevert,
    handleEditAndResubmit,
    RevertDialog,
    SubmitDialog
  }
}
