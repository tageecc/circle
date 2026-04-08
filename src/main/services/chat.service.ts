/**
 * Chat Service — native agent loop; message/tool parts aligned with @ai-sdk/provider-utils.
 * 简洁、无冗余、最佳实践
 */

import type { TextPart, ToolCallPart, ToolResultPart } from '@ai-sdk/provider-utils'
import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { STREAM_CHUNK_PROTOCOL_VERSION } from '../types/stream'
import type { StreamChunk } from '../types/stream'
import type { MessageMetadata } from '../types/message'

import { ContextEnrichmentService } from './context-enrichment.service'
import { ConfigService } from './config.service'
import { SessionService } from './session.service'
import { debugLogger } from './debug-logger.service'
import type { ToolContext } from './tool-context'
import { assistantConfig, getAssistantTools } from '../assistant/assistant'
import { MessageSnapshotService, type FileSnapshot } from './message-snapshot.service'
import { getDefaultMaxInputTokensForModel, type CoreLikeMessage } from './context-budget.service'
import { formatMcpEnvironmentNote, mcpCatalogSignature } from './mcp-catalog.util'
import { logHarnessEvent } from './agent-harness-telemetry'
import { AGENT_HARNESS } from '../constants/service.constants'
import {
  prepareMessagesForAgenticTurn,
  isLikelyContextOverflowError,
  shrinkMessagesForReactiveRetry
} from './context-pipeline.service'
import {
  buildAgentStepChunk,
  buildOrchestrationChunk,
  createChainId,
  withProtocolChunk
} from '../agent/coding-session.runner'
import { getSessionHooks } from '../agent/session-hooks'
import { reportExclusiveToolBatchIfRisky } from '../tools/tool-policy'
import { shouldUsePayloadRef, storeStreamPayload } from './stream-payload-refs.service'
import {
  canUseNativeAgentLoop,
  runNativeAgentLoop,
  type NativeAgentStreamPart
} from '../agent/native'
import { stripReasoningFromModelMessages } from '../agent/native/strip-reasoning-messages'

/** Chunks from the native agent loop (single chat execution path). */
type ChatAgentStreamPart = NativeAgentStreamPart

export class ChatService {
  private contextEnrichmentService = ContextEnrichmentService.getInstance()
  private configService: ConfigService
  private snapshotService = MessageSnapshotService.getInstance()

  constructor(configService: ConfigService) {
    this.configService = configService
  }

  async *streamChat(options: {
    sessionId: string
    message: string
    workspaceRoot?: string | null
    onStream?: (chunk: StreamChunk) => void
    abortSignal?: AbortSignal
    senderWebContentsId?: number
    images?: Array<{ id: string; dataUrl: string; name: string; size: number }>
  }): AsyncGenerator<StreamChunk> {
    const { sessionId, message, workspaceRoot, onStream, abortSignal, senderWebContentsId, images } =
      options

    let textContent = ''
    let reasoningContent = ''
    const contentParts: Array<TextPart | ReasoningPart | ToolCallPart> = []
    const metadata: MessageMetadata = {
      streamingStates: {}
      // ✅ 移除toolStates：状态直接从tool-result消息推导
    }

    let userMessageId: number = 0
    let assistantMessageId: number = 0

    // 收集当前消息的文件变更（用于快照）
    const messageFileChanges: Record<string, FileSnapshot> = {}

    // 辅助函数：保存消息
    const saveMessage = async () => {
      const content: Array<TextPart | ReasoningPart | ToolCallPart> = [...contentParts]
      if (textContent) {
        content.push({ type: 'text', text: textContent })
      }
      await SessionService.updateMessage(assistantMessageId, { content, metadata }).catch((err) =>
        console.error('[ChatService] Save failed:', err)
      )
    }

    // 辅助函数：关闭流状态
    const closeStreaming = () => {
      Object.values(metadata.streamingStates || {}).forEach((state) => {
        if (state) state.isStreaming = false
      })
    }

    let chainId = ''

    try {
      if (!workspaceRoot) {
        throw new Error('workspaceRoot is required')
      }

      chainId = createChainId()

      const emitChunk = (chunk: StreamChunk) => {
        const c = withProtocolChunk(chunk, chainId)
        onStream?.(c)
        return c
      }

      const defaultModelId = this.configService.getDefaultModel()
      const session = await SessionService.getSession(sessionId)
      const modelId =
        session?.modelId && session.modelId !== 'assistant' ? session.modelId : defaultModelId
      console.log(`[ChatService] Using model: ${modelId}`)
      const totalUsage = (session?.metadata?.totalUsage as any) || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }

      // 1. 先保存消息获取真实 ID
      userMessageId = await SessionService.saveMessage(sessionId, {
        role: 'user',
        content: message
      })

      assistantMessageId = await SessionService.saveMessage(sessionId, {
        role: 'assistant',
        content: []
      })

      // 2. 加载历史消息（排除刚保存的消息）
      const historyMessages = await SessionService.getMessages(sessionId)

      // ✅ 检查并清理pending approval的tool-calls
      // 当用户发送新消息时，自动为所有pending的tool添加"cancelled"的tool-result
      await this.cleanupPendingToolCalls(sessionId, historyMessages)

      // 3. 重新加载消息（包含添加的tool-result）
      const updatedHistoryMessages = await SessionService.getMessages(sessionId)

      // 4. 构造 AI 上下文（排除刚保存的消息）
      const messages = updatedHistoryMessages
        .filter((msg) => msg.role !== 'system')
        .filter((msg) => msg.id !== userMessageId && msg.id !== assistantMessageId)
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'tool',
          content: msg.content
        }))

      // 4. 添加当前用户消息
      messages.push({
        role: 'user',
        content: message
      })

      // Show user + empty assistant immediately so the UI does not wait on system prompt / pruning
      yield emitChunk({
        type: 'message-start',
        messages: [
          {
            id: userMessageId,
            role: 'user',
            content: [{ type: 'text', text: message }],
            timestamp: Date.now(),
            images: images || undefined
          },
          {
            id: assistantMessageId,
            role: 'assistant',
            content: [],
            timestamp: Date.now()
          }
        ]
      })

      const tools = getAssistantTools()
      const mcpSig = mcpCatalogSignature(tools)
      const prevMcpSig = session?.metadata?.mcpToolCatalogSignature as string | undefined
      const mcpNote = formatMcpEnvironmentNote(prevMcpSig ?? null, mcpSig, Object.keys(tools))

      const svcSettings = this.configService.getServiceSettings()
      const maxInput =
        svcSettings.maxContextInputTokens ?? getDefaultMaxInputTokensForModel(modelId)
      const reserveOut =
        svcSettings.contextReserveOutputTokens ?? AGENT_HARNESS.RESERVE_OUTPUT_TOKENS

      const prepT0 = Date.now()
      const t = prepT0

      const systemPrompt = await this.contextEnrichmentService.buildSystemPrompt({
        modelId,
        assistantInstructions: assistantConfig.instructions,
        workspaceRoot,
        configService: this.configService,
        mcpEnvironmentNote: mcpNote
      })

      const buildSystemMs = Date.now() - t

      logHarnessEvent('system_prompt.layers', {
        static_dynamic_bytes: systemPrompt.length,
        has_mcp_note: mcpNote ? 1 : 0
      })

      let coreMessages: CoreLikeMessage[] = messages as CoreLikeMessage[]
      const maxAgentSteps = 100

      const prepFirst = await prepareMessagesForAgenticTurn({
        messages: coreMessages,
        systemPrompt,
        modelId,
        configService: this.configService,
        maxInputTokens: maxInput,
        reserveOutputTokens: reserveOut,
        summarizationEnabled: svcSettings.contextSummarizationEnabled !== false,
        abortSignal
      })

      logHarnessEvent('harness.prep_timings', {
        build_system_ms: buildSystemMs,
        summarize_ms: 0,
        prune_ms: Date.now() - prepT0 - buildSystemMs,
        total_prep_ms: Date.now() - prepT0,
        summarized: prepFirst.conversationSummarized ? 1 : 0
      })

      let messagesForModel = prepFirst.messagesForModel
      let pruned = prepFirst.pruned
      let conversationSummarized = prepFirst.conversationSummarized

      const emitContextNotice = (reactiveRetry?: boolean) => {
        if (
          pruned.prunedCount > 0 ||
          pruned.toolResultsTruncated ||
          conversationSummarized ||
          pruned.aggressiveToolTruncation ||
          pruned.longTextTruncated ||
          reactiveRetry
        ) {
          return emitChunk({
            type: 'context-notice',
            contextNotice: {
              prunedMessageCount: pruned.prunedCount,
              toolResultsTruncated: pruned.toolResultsTruncated,
              estimatedInputTokensAfter: pruned.estimatedInputTokensAfter,
              conversationSummarized,
              aggressiveToolTruncation: pruned.aggressiveToolTruncation,
              longTextTruncated: pruned.longTextTruncated,
              reactiveRetry: reactiveRetry === true
            }
          })
        }
        return undefined
      }

      {
        const notice = emitContextNotice(false)
        if (notice) yield notice
      }

      debugLogger.logChatRequest(sessionId, messagesForModel, { workspaceRoot })

      await getSessionHooks().beforeModelCall?.({
        chainId,
        sessionId,
        workspaceRoot,
        modelId,
        messageCount: messagesForModel.length,
        estimatedInputTokens: pruned.estimatedInputTokensAfter
      })

      yield emitChunk(
        buildOrchestrationChunk(
          {
            protocolVersion: STREAM_CHUNK_PROTOCOL_VERSION,
            chainId,
            maxSteps: maxAgentSteps,
            modelId
          },
          chainId
        )
      )

      const toolContext: ToolContext = {
        sessionId,
        workspaceRoot,
        assistantMessageId,
        abortSignal,
        senderWebContentsId,
        modelId,
        delegateDepth: 0
      }

      let reactiveRetryUsed = false
      let allowReactiveRetry = true
      let stepIndex = 0
      const toolNamesSinceLastFinish: string[] = []

      if (!canUseNativeAgentLoop(modelId, this.configService)) {
        const msg = `No API credentials for native agent (model: ${modelId}). Configure the provider API key in Settings.`
        closeStreaming()
        await saveMessage()
        yield emitChunk({
          type: 'error',
          error: msg,
          v: STREAM_CHUNK_PROTOCOL_VERSION
        })
        return
      }

      outer: while (true) {
        const streamIterable: AsyncIterable<ChatAgentStreamPart> = runNativeAgentLoop({
          modelId,
          configService: this.configService,
          systemPrompt,
          initialMessages: messagesForModel,
          tools,
          toolContext,
          temperature: this.configService.getTemperature(),
          maxSteps: maxAgentSteps,
          abortSignal,
          prepareStepMessages: stripReasoningFromModelMessages
        })

        try {
          for await (const part of streamIterable) {
            if (
              part.type === 'error' &&
              isLikelyContextOverflowError(part.error) &&
              allowReactiveRetry &&
              !reactiveRetryUsed
            ) {
              reactiveRetryUsed = true
              coreMessages = shrinkMessagesForReactiveRetry(
                coreMessages,
                AGENT_HARNESS.SUMMARY_TAIL_MESSAGES
              )
              const prepAgain = await prepareMessagesForAgenticTurn({
                messages: coreMessages,
                systemPrompt,
                modelId,
                configService: this.configService,
                maxInputTokens: maxInput,
                reserveOutputTokens: reserveOut,
                summarizationEnabled: svcSettings.contextSummarizationEnabled !== false,
                abortSignal
              })
              messagesForModel = prepAgain.messagesForModel
              pruned = prepAgain.pruned
              conversationSummarized = prepAgain.conversationSummarized
              {
                const notice = emitContextNotice(true)
                if (notice) yield notice
              }
              logHarnessEvent('context.reactive_retry', { chain_id: chainId })
              continue outer
            }

            if (
              part.type === 'text-delta' ||
              part.type === 'tool-call' ||
              part.type === 'reasoning-delta'
            ) {
              allowReactiveRetry = false
            }

            switch (part.type) {
              case 'start-step': {
                break
              }

              case 'reasoning-start': {
                reasoningContent = ''
                metadata.streamingStates!.reasoning = { isStreaming: true, type: 'reasoning' }
                break
              }

              case 'reasoning-delta': {
                reasoningContent += part.text
                yield emitChunk({ type: 'reasoning', content: part.text })
                break
              }

              case 'reasoning-end': {
                if (metadata.streamingStates?.reasoning) {
                  metadata.streamingStates.reasoning.isStreaming = false
                }
                if (reasoningContent) {
                  contentParts.push({
                    type: 'reasoning',
                    text: reasoningContent
                  } as ReasoningPart)
                }
                reasoningContent = ''
                await saveMessage() // ✅ 恢复保存：防止用户停止时丢失思考内容
                break
              }

              case 'text-delta': {
                textContent += part.text
                yield emitChunk({ type: 'text', content: part.text })
                break
              }

              case 'tool-call': {
                // 固化之前的 text 内容（如果有）
                if (textContent) {
                  contentParts.push({ type: 'text', text: textContent })
                  textContent = ''
                }

                const toolCallPart: ToolCallPart = {
                  type: 'tool-call',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input
                }
                contentParts.push(toolCallPart)

                // ✅ 移除toolStates初始化：不再需要

                yield emitChunk({
                  type: 'tool-call',
                  toolCall: {
                    id: part.toolCallId,
                    name: part.toolName,
                    args: part.input as Record<string, unknown>
                  }
                })

                stepIndex += 1
                toolNamesSinceLastFinish.push(part.toolName)
                yield emitChunk(
                  buildAgentStepChunk(
                    {
                      chainId,
                      index: stepIndex,
                      phase: 'tool_call',
                      toolName: part.toolName,
                      toolCallId: part.toolCallId
                    },
                    chainId
                  )
                )

                await saveMessage() // ✅ 恢复保存：工具调用是关键状态点
                break
              }

              case 'tool-result': {
                // ✅ AI SDK 类型定义：tool-result 事件包含 input 和 output 字段
                // 参考：node_modules/ai/dist/index.d.ts:503-529
                // type DynamicToolResult = {
                //   type: 'tool-result'
                //   toolCallId: string
                //   toolName: string
                //   input: unknown
                //   output: unknown  // ← 工具执行结果在这里！
                // }
                const partWithOutput = part as {
                  toolCallId: string
                  toolName: string
                  output: unknown
                }

                const toolResultPart: ToolResultPart = {
                  type: 'tool-result',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  output: {
                    type: typeof partWithOutput.output === 'string' ? 'text' : 'json',
                    value: (partWithOutput.output !== undefined
                      ? partWithOutput.output
                      : null) as any
                  }
                }

                // ✅ 保存tool-result消息（AI SDK标准）
                const toolMessageId = await SessionService.saveMessage(sessionId, {
                  role: 'tool',
                  content: [toolResultPart]
                })

                // ✅ 发送tool消息到前端（关键：让前端能找到tool-result）
                const toolMsgPayload = [
                  {
                    id: toolMessageId,
                    role: 'tool' as const,
                    content: [toolResultPart],
                    timestamp: Date.now()
                  }
                ]
                const serializedTool = JSON.stringify(toolMsgPayload)
                if (shouldUsePayloadRef(serializedTool)) {
                  const ref = storeStreamPayload(serializedTool)
                  yield emitChunk({
                    type: 'message-start',
                    payloadRef: ref,
                    messages: [
                      {
                        id: toolMessageId,
                        role: 'tool',
                        content: [
                          {
                            type: 'text',
                            text: '[Large tool result omitted — resolve payloadRef in renderer]'
                          }
                        ],
                        timestamp: Date.now()
                      }
                    ]
                  })
                } else {
                  yield emitChunk({
                    type: 'message-start',
                    messages: toolMsgPayload
                  })
                }

                stepIndex += 1
                yield emitChunk(
                  buildAgentStepChunk(
                    {
                      chainId,
                      index: stepIndex,
                      phase: 'tool_result',
                      toolName: part.toolName,
                      toolCallId: part.toolCallId
                    },
                    chainId
                  )
                )

                await getSessionHooks().afterToolResult?.({
                  chainId,
                  sessionId,
                  workspaceRoot,
                  modelId,
                  toolName: part.toolName,
                  toolCallId: part.toolCallId,
                  output: partWithOutput.output
                })

                // ✅ 移除toolStates更新：状态从tool-result消息推导

                await saveMessage() // ✅ 持久化assistant消息

                const toolCallPart = contentParts.find(
                  (p): p is ToolCallPart =>
                    p.type === 'tool-call' && p.toolCallId === part.toolCallId
                )
                debugLogger.logToolCall(
                  sessionId,
                  part.toolName,
                  part.toolCallId,
                  toolCallPart?.input,
                  partWithOutput.output
                )

                // ✅ 处理工具结果（存储快照等）但不发送chunk到前端
                // 前端已经从message-start中的tool消息提取所有信息
                for await (const _chunk of this.processToolResult(
                  part.toolCallId,
                  part.toolName,
                  partWithOutput.output,
                  metadata,
                  messageFileChanges
                )) {
                  // 不再发送chunk到前端（优化性能，减少网络传输）
                }

                break
              }

              case 'tool-error': {
                console.error('[ChatService] Tool error:', {
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  error: part.error
                })

                const errorMessage =
                  part.error instanceof Error ? part.error.message : String(part.error)

                // 保存为 tool-result 格式（AI SDK 兼容）
                const toolResultPart: ToolResultPart = {
                  type: 'tool-result',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  output: {
                    type: 'text',
                    value: JSON.stringify({
                      success: false,
                      error: errorMessage,
                      isError: true
                    })
                  }
                }

                const toolErrorMessageId = await SessionService.saveMessage(sessionId, {
                  role: 'tool',
                  content: [toolResultPart]
                })

                // 发送消息到前端
                yield emitChunk({
                  type: 'message-start',
                  messages: [
                    {
                      id: toolErrorMessageId,
                      role: 'tool',
                      content: [toolResultPart],
                      timestamp: Date.now()
                    }
                  ]
                })

                await saveMessage()

                yield emitChunk({
                  type: 'tool-result',
                  toolResult: {
                    tool_call_id: part.toolCallId,
                    content: errorMessage,
                    isError: true
                  }
                })

                break
              }

              case 'finish': {
                reportExclusiveToolBatchIfRisky(toolNamesSinceLastFinish)
                toolNamesSinceLastFinish.length = 0

                closeStreaming()
                await saveMessage()

                if (part.totalUsage) {
                  totalUsage.inputTokens =
                    (totalUsage.inputTokens || 0) + (part.totalUsage.inputTokens || 0)
                  totalUsage.outputTokens =
                    (totalUsage.outputTokens || 0) + (part.totalUsage.outputTokens || 0)
                  totalUsage.totalTokens =
                    (totalUsage.totalTokens || 0) + (part.totalUsage.totalTokens || 0)
                  if (part.totalUsage.reasoningTokens) {
                    totalUsage.reasoningTokens =
                      (totalUsage.reasoningTokens || 0) + part.totalUsage.reasoningTokens
                  }

                  await SessionService.updateSessionMetadata(sessionId, {
                    lastUsage: part.totalUsage,
                    totalUsage,
                    mcpToolCatalogSignature: mcpSig
                  })

                  yield emitChunk({
                    type: 'usage',
                    usage: part.totalUsage
                  })
                } else {
                  await SessionService.updateSessionMetadata(sessionId, {
                    mcpToolCatalogSignature: mcpSig
                  })
                }

                // 如果有文件变更，创建快照
                if (Object.keys(messageFileChanges).length > 0) {
                  console.log(
                    `[ChatService] Creating snapshot for message ${assistantMessageId}, files: ${Object.keys(messageFileChanges).length}`
                  )
                  await this.snapshotService.createSnapshot({
                    messageId: assistantMessageId,
                    sessionId,
                    timestamp: Date.now(),
                    files: messageFileChanges
                  })
                }

                yield emitChunk({ type: 'text', content: '' })
                break
              }

              case 'error': {
                const errorMsg =
                  part.error instanceof Error
                    ? part.error.message
                    : String(part.error || 'Unknown error')
                console.error('[ChatService] Stream error:', errorMsg)
                closeStreaming()
                await saveMessage()

                yield emitChunk({ type: 'error', error: errorMsg })
                break
              }
            }
          }
          break outer
        } catch (innerErr: unknown) {
          if (isLikelyContextOverflowError(innerErr) && !reactiveRetryUsed) {
            reactiveRetryUsed = true
            coreMessages = shrinkMessagesForReactiveRetry(
              coreMessages,
              AGENT_HARNESS.SUMMARY_TAIL_MESSAGES
            )
            const prepThrow = await prepareMessagesForAgenticTurn({
              messages: coreMessages,
              systemPrompt,
              modelId,
              configService: this.configService,
              maxInputTokens: maxInput,
              reserveOutputTokens: reserveOut,
              summarizationEnabled: svcSettings.contextSummarizationEnabled !== false,
              abortSignal
            })
            messagesForModel = prepThrow.messagesForModel
            pruned = prepThrow.pruned
            conversationSummarized = prepThrow.conversationSummarized
            {
              const notice = emitContextNotice(true)
              if (notice) yield notice
            }
            logHarnessEvent('context.reactive_retry_throw', { chain_id: chainId })
            continue outer
          }
          throw innerErr
        }
      }

      await getSessionHooks().onSessionIdle?.({
        chainId,
        sessionId,
        workspaceRoot,
        modelId
      })

      // 异步生成标题（不阻塞流完成）
      SessionService.maybeGenerateTitle(sessionId).catch((error) => {
        console.error('[ChatService] Failed to generate title:', error)
      })
    } catch (error) {
      console.error('[ChatService] Stream error:', error)
      closeStreaming()
      await saveMessage()

      const errChunk: StreamChunk = {
        type: 'error',
        v: STREAM_CHUNK_PROTOCOL_VERSION,
        error: error instanceof Error ? error.message : String(error),
        ...(chainId ? { chainId } : {})
      }
      const out = chainId ? withProtocolChunk(errChunk, chainId) : errChunk
      onStream?.(out)
      yield out
    }
  }

  /**
   * 处理工具结果（applied-file-edit 等）
   */
  private async *processToolResult(
    toolCallId: string,
    toolName: string,
    result: unknown,
    _metadata: MessageMetadata,
    messageFileChanges: Record<string, FileSnapshot>
  ): AsyncGenerator<StreamChunk> {
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result)

    let parsedContent = resultStr
    let isApplied = false
    let appliedAction: any
    let isErrorResult = false

    try {
      const parsed = JSON.parse(resultStr)

      if (parsed.type === 'edit_file_failed' && toolName === 'edit_file') {
        isErrorResult = true
        parsedContent = `edit_file failed (${String(parsed.reason)}): ${parsed.message}${parsed.hint ? ` — ${parsed.hint}` : ''}`
      } else if (parsed.type === 'applied-file-edit') {
        isApplied = true
        appliedAction = {
          type: 'file-edit',
          data: {
            toolName: parsed.toolName || toolName,
            filePath: parsed.filePath,
            absolutePath: parsed.absolutePath,
            oldContent: parsed.oldContent,
            newContent: parsed.newContent,
            fileExists: parsed.fileExists,
            stats: parsed.stats
          }
        }

        // 收集文件变更到快照（用于消息级别的 undo）
        // 对于删除操作，存储原文件内容（oldContent）以便回退时恢复
        // 对于创建/编辑操作，存储新文件内容（newContent）
        const snapshotContent =
          parsed.toolName === 'delete_file' ? parsed.oldContent : parsed.newContent
        messageFileChanges[parsed.absolutePath] = {
          content: snapshotContent,
          contentHash: this.snapshotService.hashContent(snapshotContent),
          action:
            parsed.toolName === 'delete_file' ? 'delete' : parsed.fileExists ? 'edit' : 'create',
          size: snapshotContent.length
        }

        // 根据 toolName 显示不同的消息
        if (parsed.toolName === 'delete_file') {
          parsedContent = `File deleted: ${parsed.filePath}`
        } else {
          parsedContent = parsed.fileExists
            ? `File edited: ${parsed.filePath}`
            : `File created: ${parsed.filePath}`
        }

        if (parsed.stats?.linesAdded || parsed.stats?.linesRemoved) {
          parsedContent += ` (+${parsed.stats.linesAdded || 0}/-${parsed.stats.linesRemoved || 0} lines)`
        }
      }
    } catch {
      // 不是 JSON，保持原样
    }

    // 返回 tool-result
    yield {
      type: 'tool-result',
      toolResult: {
        tool_call_id: toolCallId,
        content: parsedContent,
        isError: isErrorResult,
        isApplied,
        appliedAction
      }
    }
  }

  /**
   * 处理工具审批
   */
  async approveToolCall(
    _sessionId: string,
    messageId: number,
    toolCallId: string,
    approved: boolean
  ): Promise<void> {
    await SessionService.updateToolApprovalStatus(messageId, toolCallId, {
      needsApproval: true,
      approvalStatus: approved ? 'approved' : 'rejected',
      state: approved ? 'running' : 'error'
    })
  }

  // Note: SessionService is now all static methods
  getSessionService(): typeof SessionService {
    return SessionService
  }

  cleanup(): void {
    // 清理逻辑已移到工具内部
  }

  onSessionDeleted(_sessionId: string): void {
    // Pending edits 现在由前端 Zustand Store 管理
  }

  /**
   * 公开方法：清理指定会话的 pending tool-calls
   * 用于用户停止流式响应时立即清理
   */
  async cleanupPendingTools(sessionId: string): Promise<void> {
    const historyMessages = await SessionService.getMessages(sessionId)
    await this.cleanupPendingToolCalls(sessionId, historyMessages)
  }

  /**
   * 清理所有未完成的 tool-calls
   * 当用户发送新消息时，自动为所有没有 result 的 tool-call 添加 cancelled 的 tool-result
   */
  private async cleanupPendingToolCalls(
    sessionId: string,
    historyMessages: Array<{
      id: number
      role: string
      content: any
      metadata?: MessageMetadata
    }>
  ): Promise<void> {
    const pendingToolCalls: Array<{ messageId: number; toolCallId: string; toolName: string }> = []

    // 查找所有没有 result 的 tool-calls
    for (const msg of historyMessages) {
      if (msg.role !== 'assistant') continue

      const content = Array.isArray(msg.content) ? msg.content : []

      for (const part of content) {
        if (part.type === 'tool-call') {
          const toolCallId = part.toolCallId

          // 检查是否已有 tool-result
          const hasResult = historyMessages.some(
            (m) =>
              m.role === 'tool' &&
              Array.isArray(m.content) &&
              m.content.some((p: any) => p.type === 'tool-result' && p.toolCallId === toolCallId)
          )

          if (!hasResult) {
            pendingToolCalls.push({
              messageId: msg.id,
              toolCallId,
              toolName: part.toolName
            })
          }
        }
      }
    }

    // 为所有 pending 的 tool-calls 添加 cancelled 的 tool-result
    for (const { messageId, toolCallId, toolName } of pendingToolCalls) {
      console.log(`[ChatService] Cancelling pending tool: ${toolName} (${toolCallId})`)

      // 使用标准的 tool-result 格式（AI SDK 兼容）
      const toolResultPart: ToolResultPart = {
        type: 'tool-result',
        toolCallId,
        toolName,
        output: {
          type: 'text',
          value: JSON.stringify({
            success: false,
            stderr: 'Tool execution cancelled by user',
            exitCode: 130
          })
        }
      }

      await SessionService.saveMessage(sessionId, {
        role: 'tool',
        content: [toolResultPart]
      })

      // 更新 approval 状态（如果有）
      const metadata = historyMessages.find((m) => m.id === messageId)?.metadata
      if (metadata?.toolStates?.[toolCallId]?.needsApproval) {
        await SessionService.updateToolApprovalStatus(messageId, toolCallId, {
          needsApproval: false,
          approvalStatus: 'skipped'
        })
      }
    }
  }
}
