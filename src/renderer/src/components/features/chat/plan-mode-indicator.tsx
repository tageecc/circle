/**
 * Plan Mode Indicator - Displayed at the top of chat when in plan mode
 */

import { AlertCircle } from 'lucide-react'

interface PlanModeIndicatorProps {
  planFilePath: string
}

export function PlanModeIndicator({ planFilePath }: PlanModeIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20 text-sm">
      <AlertCircle className="size-4 text-blue-500 shrink-0" />
      <div className="flex-1 flex items-center gap-3">
        <span className="font-medium text-blue-600 dark:text-blue-400">Plan Mode Active</span>
        <span className="text-muted-foreground hidden sm:inline">
          Exploring codebase (read-only)
        </span>
        <span className="text-xs text-muted-foreground hidden md:inline">
          · Plan file: {planFilePath}
        </span>
      </div>
    </div>
  )
}
