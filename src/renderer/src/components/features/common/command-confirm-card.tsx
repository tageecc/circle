/**
 * 命令确认卡片
 *
 * 基于 LangGraph Human-in-the-Loop 实现，类似 Cursor 的交互体验
 * 显示待执行命令，用户可以选择执行或取消
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
import { Badge } from '@/components/ui/badge'
import { Terminal, Play, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandConfirmCardProps {
  command: string
  explanation?: string
  isDangerous?: boolean
  dangerReason?: string
  requiredPermissions?: string[]
  workflowRunId: string
  suspendedStep: string
  onApprove: () => void
  onCancel: () => void
  isProcessing?: boolean
}

export function CommandConfirmCard({
  command,
  explanation,
  isDangerous,
  dangerReason,
  requiredPermissions,
  workflowRunId,
  suspendedStep,
  onApprove,
  onCancel,
  isProcessing = false
}: CommandConfirmCardProps) {
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
    <Card
      className={cn(
        'border-2 transition-colors',
        isDangerous ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30 bg-primary/5'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal
              className={cn('h-5 w-5', isDangerous ? 'text-destructive' : 'text-primary')}
            />
            <CardTitle className="text-base">命令执行确认</CardTitle>
          </div>
          {isDangerous && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              危险命令
            </Badge>
          )}
        </div>
        {explanation && <CardDescription className="text-sm mt-1.5">{explanation}</CardDescription>}
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* 命令显示 */}
        <div className="rounded-md bg-muted p-3 font-mono text-sm">
          <code className={cn(isDangerous && 'text-destructive font-semibold')}>{command}</code>
        </div>

        {/* 危险警告 */}
        {isDangerous && dangerReason && (
          <div className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold mb-1">⚠️ 警告</div>
              <div className="text-xs">{dangerReason}</div>
            </div>
          </div>
        )}

        {/* 权限要求 */}
        {requiredPermissions && requiredPermissions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">需要权限:</span>
            {requiredPermissions.map((perm) => (
              <Badge key={perm} variant="outline" className="text-xs">
                {perm}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button
          onClick={handleCancel}
          variant="outline"
          size="sm"
          disabled={isExecuting || isProcessing}
          className="flex-1 gap-2"
        >
          <X className="h-4 w-4" />
          取消
        </Button>
        <Button
          onClick={handleApprove}
          variant={isDangerous ? 'destructive' : 'default'}
          size="sm"
          disabled={isExecuting || isProcessing}
          className="flex-1 gap-2"
        >
          <Play className="h-4 w-4" />
          {isDangerous ? '确认执行（危险）' : '执行'}
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
