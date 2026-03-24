import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface CollapsiblePanelProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function CollapsiblePanel({
  title,
  isExpanded,
  onToggle,
  actions,
  children,
  className
}: CollapsiblePanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 transition-all duration-200 group/panel',
        className
      )}
    >
      <div
        className="px-3 py-2 flex items-center justify-between gap-2 shrink-0 border-b border-sidebar-border/50 cursor-pointer hover:bg-muted/30"
        onClick={onToggle}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 truncate">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {isExpanded && (
            <div className="opacity-0 group-hover/panel:opacity-100 transition-opacity">
              {actions}
            </div>
          )}
          <div className="h-6 w-6 flex items-center justify-center shrink-0">
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform duration-200',
                !isExpanded && '-rotate-90'
              )}
            />
          </div>
        </div>
      </div>
      {isExpanded && <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>}
    </div>
  )
}
