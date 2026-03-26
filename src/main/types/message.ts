/**
 * 后端消息类型 - 仅定义 UI 状态的 metadata
 * 业务数据直接使用 AI SDK 标准类型
 */

/**
 * ============================================
 * Metadata - UI 状态（不污染标准内容）
 * ============================================
 */

export interface MessageMetadata {
  // 工具调用的运行时状态（按 toolCallId 索引）
  // ✅ 简化：只存储无法从消息推导的运行时状态
  toolStates?: Record<string, ToolUIState>

  // 流式状态（reasoning/text/tool）
  streamingStates?: Record<string, StreamingState>
}

// 工具运行时状态
// ✅ 简化：移除state字段，从tool-result消息推导
export interface ToolUIState {
  // ✅ 保留：运行时状态，无法从静态消息推导
  terminalId?: string // Terminal ID（后台任务）
  needsApproval?: boolean // 是否需要审批
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'skipped' // 审批状态
  streamOutput?: string // 流式输出（Terminal）
}

// 流式状态
export interface StreamingState {
  isStreaming: boolean
  type: 'reasoning' | 'text'
}
