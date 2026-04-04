import { promises as fs } from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * Debug Logger Service
 * 用于记录大模型对话内容和调试数据到本地文件
 * 注意：logs 目录已添加到 .gitignore，不会提交到 git
 */
class DebugLoggerService {
  private logsDir: string
  private enabled: boolean = true

  constructor() {
    // 使用 app.getPath('userData') 获取应用数据目录，或使用项目根目录的 logs 文件夹
    const userDataPath = app?.getPath?.('userData') || process.cwd()
    this.logsDir = path.join(userDataPath, 'logs')
    this.ensureLogsDir()
  }

  private async ensureLogsDir() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create logs directory:', error)
    }
  }

  /**
   * 记录 AI 对话请求
   */
  async logChatRequest(sessionId: string, messages: unknown[], metadata?: Record<string, unknown>) {
    if (!this.enabled) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `chat-request-${sessionId}-${timestamp}.json`
    const filepath = path.join(this.logsDir, filename)

    const logData = {
      type: 'chat-request',
      timestamp: new Date().toISOString(),
      sessionId,
      messages,
      metadata
    }

    try {
      await fs.writeFile(filepath, JSON.stringify(logData, null, 2), 'utf-8')
      console.log(`[DebugLogger] Chat request logged to: ${filename}`)
    } catch (error) {
      console.error('[DebugLogger] Failed to log chat request:', error)
    }
  }

  /**
   * 记录 AI 对话响应
   */
  async logChatResponse(sessionId: string, response: unknown, metadata?: Record<string, unknown>) {
    if (!this.enabled) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `chat-response-${sessionId}-${timestamp}.json`
    const filepath = path.join(this.logsDir, filename)

    const logData = {
      type: 'chat-response',
      timestamp: new Date().toISOString(),
      sessionId,
      response,
      metadata
    }

    try {
      await fs.writeFile(filepath, JSON.stringify(logData, null, 2), 'utf-8')
      console.log(`[DebugLogger] Chat response logged to: ${filename}`)
    } catch (error) {
      console.error('[DebugLogger] Failed to log chat response:', error)
    }
  }

  /**
   * 记录工具调用
   */
  async logToolCall(
    sessionId: string,
    toolName: string,
    toolCallId: string,
    input: unknown,
    output: unknown
  ) {
    if (!this.enabled) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `tool-call-${toolName}-${sessionId}-${timestamp}.json`
    const filepath = path.join(this.logsDir, filename)

    const logData = {
      type: 'tool-call',
      timestamp: new Date().toISOString(),
      sessionId,
      toolName,
      toolCallId,
      input,
      output
    }

    try {
      await fs.writeFile(filepath, JSON.stringify(logData, null, 2), 'utf-8')
      console.log(`[DebugLogger] Tool call logged to: ${filename}`)
    } catch (error) {
      console.error('[DebugLogger] Failed to log tool call:', error)
    }
  }

  /**
   * 记录通用调试信息
   */
  async logDebug(category: string, data: unknown) {
    if (!this.enabled) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `debug-${category}-${timestamp}.json`
    const filepath = path.join(this.logsDir, filename)

    const logData = {
      type: 'debug',
      category,
      timestamp: new Date().toISOString(),
      data
    }

    try {
      await fs.writeFile(filepath, JSON.stringify(logData, null, 2), 'utf-8')
      console.log(`[DebugLogger] Debug info logged to: ${filename}`)
    } catch (error) {
      console.error('[DebugLogger] Failed to log debug info:', error)
    }
  }

  /**
   * 启用/禁用日志
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    console.log(`[DebugLogger] Logging ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * 获取日志目录路径
   */
  getLogsDir(): string {
    return this.logsDir
  }

  /**
   * Temporary: append one JSON line per native agent event (OpenAI-compatible loop debugging).
   * File: native-agent-trace-<sessionId>.log under userData/logs/
   */
  async logNativeAgentTrace(sessionId: string, record: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return
    try {
      await this.ensureLogsDir()
      const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
      const filepath = path.join(this.logsDir, `native-agent-trace-${safe}.log`)
      const line = JSON.stringify({ ts: new Date().toISOString(), sessionId, ...record }) + '\n'
      await fs.appendFile(filepath, line, 'utf-8')
      if (process.env.CIRCLE_DEBUG_NATIVE_TRACE === '1') {
        const phase = typeof record.phase === 'string' ? record.phase : 'event'
        console.log(`[NativeAgentTrace] ${phase}`, { ...record, sessionId: sessionId.slice(-12) })
      }
    } catch (e) {
      console.error('[DebugLogger] logNativeAgentTrace failed:', e)
    }
  }
}

export const debugLogger = new DebugLoggerService()
