'use client'

import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { BrainIcon, ChevronDownIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { createContext, memo, useContext, useEffect, useState, useRef } from 'react'
import { Streamdown } from 'streamdown'
import { Shimmer } from './shimmer'

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning')
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const AUTO_CLOSE_DELAY = 300
const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    // 智能默认状态：
    // - 正在 streaming（实时思考）→ 展开，让用户看到思考过程
    // - 非 streaming（历史消息）→ 收起，避免占用空间
    const computedDefaultOpen = defaultOpen ?? isStreaming

    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: computedDefaultOpen,
      onChange: onOpenChange
    })
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: undefined
    })

    const [hasAutoClosed, setHasAutoClosed] = useState(false)
    const [startTime, setStartTime] = useState<number | null>(null)
    const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Track duration and auto-close
    useEffect(() => {
      // 开始 streaming：记录开始时间
      if (isStreaming && startTime === null) {
        setStartTime(Date.now())
        return undefined
      }

      // 结束 streaming：计算时长 + 自动关闭
      if (!isStreaming && startTime !== null) {
        const durationSeconds = Math.ceil((Date.now() - startTime) / MS_IN_S)
        setDuration(durationSeconds)
        setStartTime(null)

        // 自动关闭（仅当未手动关闭过）
        if (isOpen && !hasAutoClosed) {
          // 清除之前的 timer（如果有）
          if (autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current)
          }

          autoCloseTimerRef.current = setTimeout(() => {
            setIsOpen(false)
            setHasAutoClosed(true)
            autoCloseTimerRef.current = null
          }, AUTO_CLOSE_DELAY)
        }
      }

      return undefined
    }, [isStreaming, startTime, setDuration, isOpen, hasAutoClosed, setIsOpen])

    // Cleanup timer on unmount
    useEffect(() => {
      return () => {
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current)
        }
      }
    }, [])

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen)
    }

    return (
      <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration }}>
        <Collapsible
          className={cn('not-prose mb-4', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    )
  }
)

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode
}

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Thinking...</Shimmer>
  }
  if (duration === undefined) {
    return <p>Thought for a few seconds</p>
  }
  return <p>Thought for {duration} seconds</p>
}

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning()

    return (
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground',
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn('size-4 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
            />
          </>
        )}
      </CollapsibleTrigger>
    )
  }
)

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string
}

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => (
  <CollapsibleContent
    className={cn(
      'mt-4 text-sm',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  >
    <Streamdown {...props}>{children}</Streamdown>
  </CollapsibleContent>
))

Reasoning.displayName = 'Reasoning'
ReasoningTrigger.displayName = 'ReasoningTrigger'
ReasoningContent.displayName = 'ReasoningContent'
