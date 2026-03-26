/**
 * 删除确认卡片
 *
 * 基于 LangGraph Human-in-the-Loop 实现，类似 Cursor 的交互体验
 * 显示待删除的文件/目录，用户可以选择删除或取消
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Trash2, AlertTriangle, File, Folder } from 'lucide-react'

interface DeleteConfirmCardProps {
  target_file: string
  displayPath: string
  explanation?: string
  isDirectory: boolean
  workflowRunId: string
  suspendedStep: string
  onApprove: () => void
  onCancel: () => void
  isProcessing?: boolean
}

export function DeleteConfirmCard({
  target_file: _target_file,
  displayPath,
  explanation,
  isDirectory,
  workflowRunId,
  suspendedStep,
  onApprove,
  onCancel,
  isProcessing = false
}: DeleteConfirmCardProps) {
  const [isExecuting, setIsExecuting] = useState(false)

  const handleApprove = async () => {
    setIsExecuting(true)
    try {
      await onApprove()
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCancel = async () => {
    setIsExecuting(true)
    try {
      await onCancel()
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <Card className="border-2 border-destructive/50 bg-destructive/5 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/10">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">删除确认</CardTitle>
              <div className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="text-[10px] font-medium text-destructive">危险</span>
              </div>
            </div>
            {explanation && (
              <CardDescription className="text-xs mt-1 line-clamp-2">{explanation}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {/* 文件/目录信息 - 精简版 */}
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
          {isDirectory ? (
            <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <code className="text-xs font-semibold text-destructive truncate">{displayPath}</code>
        </div>

        {/* 警告信息 - 精简版 */}
        <div className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive leading-relaxed">
            {isDirectory
              ? '此操作将永久删除目录及其所有内容，不可撤销'
              : '此操作将永久删除文件，不可撤销'}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0 pb-3">
        <Button
          onClick={handleCancel}
          variant="outline"
          size="sm"
          disabled={isExecuting || isProcessing}
          className="flex-1 h-8"
        >
          取消
        </Button>
        <Button
          onClick={handleApprove}
          variant="destructive"
          size="sm"
          disabled={isExecuting || isProcessing}
          className="flex-1 h-8"
        >
          确认删除
        </Button>
      </CardFooter>

      {/* Workflow 信息（调试用） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 pb-3 text-xs text-muted-foreground">
          <div>Run ID: {workflowRunId}</div>
          <div>Step: {suspendedStep}</div>
        </div>
      )}
    </Card>
  )
}
