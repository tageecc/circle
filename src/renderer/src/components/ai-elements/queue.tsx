import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

/**
 * Queue - 用于显示任务列表、消息队列等
 * 基于 AI Elements 设计规范实现
 */

// ============= Queue Root =============
export const Queue = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border border-border bg-card', className)}
      {...props}
    />
  )
)
Queue.displayName = 'Queue'

// ============= Queue Section (Collapsible) =============
interface QueueSectionProps extends React.ComponentPropsWithoutRef<
  typeof CollapsiblePrimitive.Root
> {
  defaultOpen?: boolean
}

export const QueueSection = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  QueueSectionProps
>(({ defaultOpen = true, ...props }, ref) => (
  <CollapsiblePrimitive.Root ref={ref} defaultOpen={defaultOpen} {...props} />
))
QueueSection.displayName = 'QueueSection'

// ============= Queue Section Trigger =============
export const QueueSectionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger asChild>
    <button
      ref={ref}
      className={cn(
        'flex w-full items-center justify-between px-4 py-3',
        'text-sm font-medium text-foreground',
        'hover:bg-accent/50 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'group',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
          'group-data-[state=open]:rotate-180'
        )}
      />
    </button>
  </CollapsiblePrimitive.Trigger>
))
QueueSectionTrigger.displayName = 'QueueSectionTrigger'

// ============= Queue Section Label =============
interface QueueSectionLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  count?: number
  icon?: React.ReactNode
}

export const QueueSectionLabel = React.forwardRef<HTMLSpanElement, QueueSectionLabelProps>(
  ({ label, count, icon, className, ...props }, ref) => (
    <span ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
      {icon}
      {count !== undefined && (
        <span className="text-xs font-medium text-muted-foreground">({count})</span>
      )}
      <span>{label}</span>
    </span>
  )
)
QueueSectionLabel.displayName = 'QueueSectionLabel'

// ============= Queue Section Content =============
export const QueueSectionContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden',
      'data-[state=closed]:animate-collapsible-up',
      'data-[state=open]:animate-collapsible-down',
      className
    )}
    {...props}
  />
))
QueueSectionContent.displayName = 'QueueSectionContent'

// ============= Queue List =============
export const QueueList = React.forwardRef<
  React.ElementRef<typeof ScrollArea>,
  React.ComponentPropsWithoutRef<typeof ScrollArea>
>(({ className, children, ...props }, ref) => (
  <ScrollArea ref={ref} className={cn('max-h-[300px]', className)} {...props}>
    <ul className="space-y-0 divide-y divide-border">{children}</ul>
  </ScrollArea>
))
QueueList.displayName = 'QueueList'

// ============= Queue Item =============
export const QueueItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, children, ...props }, ref) => (
    <li
      ref={ref}
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'hover:bg-accent/50 transition-colors',
        'group',
        className
      )}
      {...props}
    >
      {children}
    </li>
  )
)
QueueItem.displayName = 'QueueItem'

// ============= Queue Item Indicator =============
interface QueueItemIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  completed?: boolean
}

export const QueueItemIndicator = React.forwardRef<HTMLSpanElement, QueueItemIndicatorProps>(
  ({ completed = false, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center',
        completed && 'opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
)
QueueItemIndicator.displayName = 'QueueItemIndicator'

// ============= Queue Item Content =============
interface QueueItemContentProps extends React.HTMLAttributes<HTMLSpanElement> {
  completed?: boolean
}

export const QueueItemContent = React.forwardRef<HTMLSpanElement, QueueItemContentProps>(
  ({ completed = false, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('flex-1 text-sm', completed && 'line-through opacity-50', className)}
      {...props}
    >
      {children}
    </span>
  )
)
QueueItemContent.displayName = 'QueueItemContent'

// ============= Queue Item Description =============
interface QueueItemDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  completed?: boolean
}

export const QueueItemDescription = React.forwardRef<HTMLDivElement, QueueItemDescriptionProps>(
  ({ completed = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-xs text-muted-foreground', completed && 'opacity-50', className)}
      {...props}
    >
      {children}
    </div>
  )
)
QueueItemDescription.displayName = 'QueueItemDescription'

// ============= Queue Item Actions =============
export const QueueItemActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center gap-1',
      'opacity-0 group-hover:opacity-100 transition-opacity',
      className
    )}
    {...props}
  >
    {children}
  </div>
))
QueueItemActions.displayName = 'QueueItemActions'

// ============= Queue Item Action (Button) =============
export const QueueItemAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex h-7 w-7 items-center justify-center',
      'rounded-sm border border-transparent',
      'text-muted-foreground hover:text-foreground',
      'hover:bg-accent hover:border-border',
      'focus:outline-none focus:ring-2 focus:ring-ring',
      'transition-colors',
      className
    )}
    {...props}
  />
))
QueueItemAction.displayName = 'QueueItemAction'

// ============= Queue Item Attachment =============
export const QueueItemAttachment = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mt-2 flex items-center gap-2', className)} {...props} />
))
QueueItemAttachment.displayName = 'QueueItemAttachment'

// ============= Queue Item Image =============
export const QueueItemImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, ...props }, ref) => (
  <img
    ref={ref}
    className={cn('h-16 w-16 rounded border border-border object-cover', className)}
    {...props}
  />
))
QueueItemImage.displayName = 'QueueItemImage'

// ============= Queue Item File =============
export const QueueItemFile = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 text-xs',
      'text-muted-foreground hover:text-foreground',
      'transition-colors',
      className
    )}
    {...props}
  />
))
QueueItemFile.displayName = 'QueueItemFile'
