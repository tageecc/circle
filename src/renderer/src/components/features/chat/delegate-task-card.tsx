/**
 * Delegate Task Card - Display running/completed delegate task with progress
 */

import { Bot, FileSearch, Search, Edit, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DelegateTaskCardProps {
  task: {
    id: string
    description: string
    subagentType?: string
    subagentName?: string
    icon?: string
    color?: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    createdAt: number
    startedAt?: number
    completedAt?: number
    progress: {
      filesExplored: number
      searches: number
      edits: number
      toolCalls: number
    }
    currentOperation?: string
    result?: string
    error?: string
    durationMs?: number
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const STATUS_COLORS: Record<string, string> = {
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500'
}

const SUBAGENT_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20',
  purple: 'bg-purple-500/10 border-purple-500/20',
  red: 'bg-red-500/10 border-red-500/20',
  green: 'bg-green-500/10 border-green-500/20',
  orange: 'bg-orange-500/10 border-orange-500/20',
  cyan: 'bg-cyan-500/10 border-cyan-500/20',
  yellow: 'bg-yellow-500/10 border-yellow-500/20'
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'text-muted-foreground'
}

function getSubagentColor(color?: string): string {
  return (color && SUBAGENT_COLORS[color]) || 'bg-muted/50 border-border'
}

export function DelegateTaskCard({ task }: DelegateTaskCardProps) {
  const isRunning = task.status === 'running'
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'

  const duration = task.durationMs
    ? formatDuration(task.durationMs)
    : task.startedAt
      ? formatDuration(Date.now() - task.startedAt)
      : '0s'

  return (
    <div className={cn('rounded-lg border p-3 mb-3 transition-all', getSubagentColor(task.color))}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {isRunning && <Loader2 className="size-4 animate-spin text-blue-500 shrink-0" />}
        {isCompleted && <CheckCircle className="size-4 text-green-500 shrink-0" />}
        {isFailed && <XCircle className="size-4 text-red-500 shrink-0" />}
        {task.status === 'pending' && <Bot className="size-4 text-muted-foreground shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{task.subagentName || 'Sub-agent'}</span>
            <span className={cn('text-xs font-medium', getStatusColor(task.status))}>
              {task.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{task.description}</div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="size-3" />
          <span>{duration}</span>
        </div>
      </div>

      {/* Progress Stats (only for running tasks) */}
      {isRunning && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-1">
            <FileSearch className="size-3" />
            <span>{task.progress.filesExplored}</span>
          </div>
          <div className="flex items-center gap-1">
            <Search className="size-3" />
            <span>{task.progress.searches}</span>
          </div>
          <div className="flex items-center gap-1">
            <Edit className="size-3" />
            <span>{task.progress.edits}</span>
          </div>
        </div>
      )}

      {/* Current Operation (only for running) */}
      {isRunning && task.currentOperation && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span>{task.currentOperation}</span>
        </div>
      )}

      {/* Result Preview (completed) */}
      {isCompleted && task.result && (
        <div className="mt-2 text-xs text-foreground/80 line-clamp-3 bg-background/50 rounded p-2">
          {task.result}
        </div>
      )}

      {/* Error Message (failed) */}
      {isFailed && task.error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded p-2">
          {task.error}
        </div>
      )}

      {/* Summary Stats (completed/failed) */}
      {(isCompleted || isFailed) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {task.progress.toolCalls} tool calls · {task.progress.filesExplored} files ·{' '}
            {task.progress.searches} searches
          </span>
        </div>
      )}
    </div>
  )
}
