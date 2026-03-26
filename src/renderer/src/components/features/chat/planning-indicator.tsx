import { Loader2 } from 'lucide-react'
import type { Message, ToolCallPart } from '@/types/chat'
import { getContentParts, getToolUIState } from '@/utils/message-adapter'

interface PlanningIndicatorProps {
  message: Message
  isSending: boolean
}

/**
 * ✅ Planning Indicator 组件 - 最佳实践实现
 * 显示 "Planning next moves..." 状态
 *
 * 设计原则：
 * - content 提供业务数据（part 类型）
 * - metadata 提供 UI 状态（streaming/tool state）
 */
export function PlanningIndicator({ message, isSending }: PlanningIndicatorProps) {
  if (!isSending) return null

  // ✅ 从 content 获取 parts
  const parts = getContentParts(message)
  const lastPart = parts[parts.length - 1]

  // 1. 如果没有内容块（刚开始），显示
  if (!lastPart) return <PlanningIndicatorView />

  // 2. 如果是文本块，不显示（认为是正在输出，避免打字时一直显示）
  if (lastPart.type === 'text') return null

  // 3. 如果是 reasoning 块 ✅ 从 metadata 读取状态
  if (lastPart.type === 'reasoning') {
    const isStreaming = message.metadata?.streamingStates?.reasoning?.isStreaming
    // 正在思考(streaming) -> 不显示(有打字机)
    // 思考完(非streaming) -> 显示(等待下一步)
    return isStreaming ? null : <PlanningIndicatorView />
  }

  // 4. 如果是 tool-call 块 ✅ 简化判断
  if (lastPart.type === 'tool-call') {
    const toolCall = lastPart as ToolCallPart
    const uiState = getToolUIState(message, toolCall.toolCallId)

    // ✅ 简化：只检查等待审批状态
    // 工具等待审批 -> 不显示
    const isPendingApproval = uiState?.needsApproval && uiState?.approvalStatus === 'pending'

    if (isPendingApproval) {
      return null
    }

    // ✅ 其他情况显示（等待模型根据结果响应）
    return <PlanningIndicatorView />
  }

  return null
}

function PlanningIndicatorView() {
  return (
    <div className="flex items-center gap-2 px-1 py-2 animate-in fade-in duration-300">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin opacity-60" />
        <span className="animate-shimmer font-medium">Planning next moves...</span>
      </div>
    </div>
  )
}
