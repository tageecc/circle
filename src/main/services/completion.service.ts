/**
 * 代码补全服务
 *
 * FIM (Fill-in-the-Middle) 代码补全：
 * - 上下文窗口（前30行+后10行）
 * - 多模型支持
 * - 超时保护（5秒）
 * - 可选的 Shadow Workspace 验证（提升准确率）
 */

const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG_COMPLETION === 'true'
const debug = (...args: any[]) => DEBUG && console.log('[CompletionService]', ...args)
debug // prevent unused warning

import { generateTextOneShot } from '../agent/llm-one-shot'
import type { ConfigService } from './config.service'
import { getShadowWorkspace } from './shadow-workspace.service'
import type { Diagnostic } from './language-service'
import { COMPLETION } from '../constants/service.constants'
import * as path from 'path'
import * as fs from 'fs'

export interface CompletionRequest {
  filePath: string
  fileContent: string
  language: string
  cursorPosition: {
    line: number
    column: number
  }
  modelId: string
  enableValidation?: boolean // 🔥 可选：启用 Shadow Workspace 验证
}

export interface CompletionChunk {
  type: 'done' | 'error'
  text?: string
  error?: string
  metrics?: {
    requestTime: number
    completeTime?: number
    tokenCount?: number
    validated?: boolean // 是否经过验证
    attempts?: number // 重试次数
    errors?: number // 错误数量
  }
}

// 使用常量配置
const TIMEOUT_MS = COMPLETION.TIMEOUT
const PREFIX_CONTEXT_LINES = COMPLETION.PREFIX_CONTEXT_LINES
const SUFFIX_CONTEXT_LINES = COMPLETION.SUFFIX_CONTEXT_LINES
const TEMPERATURE = COMPLETION.TEMPERATURE
const MAX_RETRY_ATTEMPTS = COMPLETION.MAX_RETRY_ATTEMPTS

export class CompletionService {
  private configService: ConfigService

  constructor(configService: ConfigService) {
    this.configService = configService
  }

  async generateCompletion(
    request: CompletionRequest,
    abortSignal?: AbortSignal
  ): Promise<CompletionChunk> {
    if (!request.modelId?.trim()) {
      return { type: 'error', error: 'Inline completion requires an explicitly selected model.' }
    }

    if (!this.configService.isConfiguredModel(request.modelId)) {
      return {
        type: 'error',
        error: 'The selected completion model is not configured anymore.'
      }
    }

    const startTime = Date.now()

    // 🔥 如果启用验证 + 是 TS/JS 文件，使用 Shadow Workspace
    if (request.enableValidation && request.filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      return await this.generateWithValidation(request, abortSignal, startTime)
    }

    // 否则，直接生成（快速模式）
    return await this.generateWithoutValidation(request, abortSignal, startTime)
  }

  /**
   * 带验证的补全生成（使用 Shadow Workspace）
   */
  private async generateWithValidation(
    request: CompletionRequest,
    abortSignal: AbortSignal | undefined,
    startTime: number
  ): Promise<CompletionChunk> {
    try {
      // 1. 获取 Shadow Workspace
      const projectRoot = this.getProjectRoot(request.filePath)
      if (!projectRoot) {
        debug('No project root found, skipping validation')
        return await this.generateWithoutValidation(request, abortSignal, startTime)
      }

      const shadowWorkspace = await getShadowWorkspace(projectRoot)

      // 2. 生成 + 验证（带重试）
      let attempt = 0
      let lastErrors: Diagnostic[] = []

      while (attempt <= MAX_RETRY_ATTEMPTS) {
        if (abortSignal?.aborted) {
          return { type: 'error', error: 'Aborted' }
        }

        // 生成补全
        const completion = await this.generateText(request, lastErrors, abortSignal)
        if (!completion) {
          return { type: 'error', error: 'Generation failed' }
        }

        // 验证补全
        const validation = await shadowWorkspace.validateCompletion(
          request.filePath,
          request.fileContent,
          completion,
          request.cursorPosition
        )

        if (validation.isValid) {
          // ✅ 验证通过
          debug(`Validation passed on attempt ${attempt + 1}`)
          return {
            type: 'done',
            text: completion,
            metrics: {
              requestTime: startTime,
              completeTime: Date.now(),
              tokenCount: this.estimateTokenCount(completion),
              validated: true,
              attempts: attempt + 1,
              errors: 0
            }
          }
        } else {
          // ❌ 有错误
          lastErrors = validation.errors
          attempt++

          debug(`Validation failed on attempt ${attempt}, errors:`, lastErrors.length)

          if (attempt > MAX_RETRY_ATTEMPTS) {
            // 达到最大重试，返回最后的补全（即使有错误）
            debug('Max retry reached, returning with errors')
            return {
              type: 'done',
              text: completion,
              metrics: {
                requestTime: startTime,
                completeTime: Date.now(),
                tokenCount: this.estimateTokenCount(completion),
                validated: true,
                attempts: attempt,
                errors: lastErrors.length
              }
            }
          }
        }
      }

      throw new Error('Unexpected: should not reach here')
    } catch (error) {
      console.error('[CompletionService] Validation failed:', error)
      // 验证失败时退回无验证模式，但仍使用同一个显式模型
      return await this.generateWithoutValidation(request, abortSignal, startTime)
    }
  }

  /**
   * 不带验证的补全生成（快速模式）
   */
  private async generateWithoutValidation(
    request: CompletionRequest,
    abortSignal: AbortSignal | undefined,
    startTime: number
  ): Promise<CompletionChunk> {
    try {
      const completion = await this.generateText(request, [], abortSignal)
      if (!completion) {
        return { type: 'error', error: 'Generation failed' }
      }

      return {
        type: 'done',
        text: completion,
        metrics: {
          requestTime: startTime,
          completeTime: Date.now(),
          tokenCount: this.estimateTokenCount(completion),
          validated: false
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (!errorMessage.includes('timeout') && !errorMessage.includes('abort')) {
        console.error('[CompletionService] Error:', {
          error: errorMessage,
          file: request.filePath,
          line: request.cursorPosition.line
        })
      }

      return {
        type: 'error',
        error: errorMessage
      }
    }
  }

  /**
   * 生成文本（核心 LLM 调用）
   */
  private async generateText(
    request: CompletionRequest,
    previousErrors: Diagnostic[],
    abortSignal?: AbortSignal
  ): Promise<string | null> {
    try {
      const modelId = request.modelId
      const prompt = this.buildPrompt(request)

      // 如果有错误，增强 system prompt
      const systemPrompt =
        previousErrors.length > 0
          ? `Complete code at <|fim_middle|>. Output only code.\n\n🔥 FIX THESE ERRORS:\n${this.formatErrors(previousErrors)}`
          : 'Complete code at <|fim_middle|>. Output only code.'

      // 超时保护
      let timeoutId: NodeJS.Timeout | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      })

      const textPromise = generateTextOneShot({
        modelId,
        configService: this.configService,
        system: systemPrompt,
        prompt,
        temperature: TEMPERATURE,
        abortSignal
      })

      let result: string
      try {
        result = await Promise.race([textPromise, timeoutPromise])
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (!errorMessage.includes('timeout') && !errorMessage.includes('abort')) {
        console.error('[CompletionService] Generation error:', errorMessage)
      }
      return null
    }
  }

  private buildPrompt(request: CompletionRequest): string {
    const { fileContent, filePath, cursorPosition } = request

    const lines = fileContent.split('\n')
    const currentLine = lines[cursorPosition.line - 1] || ''
    const beforeCursor = currentLine.substring(0, cursorPosition.column - 1)
    const afterCursor = currentLine.substring(cursorPosition.column - 1)

    let prompt = `<|file_sep|>${filePath}\n`

    let prefix = this.buildPrefix(lines, cursorPosition, beforeCursor)
    if (this.shouldStartNewLine(beforeCursor, afterCursor)) {
      prefix += '\n'
    }
    prompt += `<|fim_prefix|>${prefix}`

    const suffix = this.buildSuffix(lines, cursorPosition, afterCursor)
    prompt += `<|fim_suffix|>${suffix}`

    prompt += `<|fim_middle|>`

    return prompt
  }

  private buildPrefix(
    lines: string[],
    cursorPosition: { line: number; column: number },
    beforeCursor: string
  ): string {
    const startLine = Math.max(0, cursorPosition.line - PREFIX_CONTEXT_LINES - 1)
    const beforeLines = lines.slice(startLine, cursorPosition.line - 1)

    let prefix = ''
    if (beforeLines.length > 0) {
      prefix += beforeLines.join('\n') + '\n'
    }
    prefix += beforeCursor

    return prefix
  }

  private buildSuffix(
    lines: string[],
    cursorPosition: { line: number; column: number },
    afterCursor: string
  ): string {
    let suffix = afterCursor

    const endLine = Math.min(lines.length, cursorPosition.line + SUFFIX_CONTEXT_LINES)
    const afterLines = lines.slice(cursorPosition.line, endLine)

    if (afterLines.length > 0) {
      suffix += '\n' + afterLines.join('\n')
    }

    return suffix
  }

  private shouldStartNewLine(beforeCursor: string, afterCursor: string): boolean {
    const before = beforeCursor.trim()
    const after = afterCursor.trim()

    // 行中间或空行，不换行
    if (after !== '' || before === '') {
      return false
    }

    // 行尾且有一定长度，换行
    return before.length > 20
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * 获取项目根目录（基于文件路径向上查找项目标识文件）
   */
  private getProjectRoot(filePath: string): string | null {
    let currentDir = path.dirname(filePath)
    let depth = 0
    const maxDepth = 10

    while (depth < maxDepth) {
      // 检查是否存在项目标识文件
      const indicators = ['package.json', 'tsconfig.json', 'jsconfig.json', '.git']
      for (const indicator of indicators) {
        const indicatorPath = path.join(currentDir, indicator)
        if (fs.existsSync(indicatorPath)) {
          return currentDir
        }
      }

      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        break
      }

      currentDir = parentDir
      depth++
    }

    return null
  }

  /**
   * 格式化错误信息（用于重试时的 prompt）
   */
  private formatErrors(errors: Diagnostic[]): string {
    return errors
      .slice(0, 3) // 最多显示 3 个错误
      .map((e) => `Line ${e.line}: ${e.message}`)
      .join('\n')
  }
}
