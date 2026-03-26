/**
 * Debounced inline completion requests with per-file cancellation and post-processing.
 */

const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG_COMPLETION === 'true'
const debug = (...args: any[]) => DEBUG && console.log('[CompletionManager]', ...args)

export interface CompletionContext {
  filePath: string
  fileContent: string
  language: string
  cursorPosition: {
    line: number
    column: number
  }
  enableValidation?: boolean
}

export interface CompletionResponse {
  completionText: string
  metrics?: {
    requestTime: number
    completeTime?: number
    tokenCount?: number
  }
}

const DEFAULT_DEBOUNCE_MS = 100
const MAX_COMPLETION_LINES = 20

export class CompletionRequestManager {
  private debounceMs: number
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private activeFileRequests = new Map<string, AbortController>()

  constructor(options?: { debounceMs?: number }) {
    this.debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  async requestCompletion(context: CompletionContext): Promise<CompletionResponse | null> {
    const debounceKey = this.getDebounceKey(context)

    const existingTimer = this.debounceTimers.get(debounceKey)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(debounceKey)
        const result = await this.executeRequest(context)
        resolve(result)
      }, this.debounceMs)

      this.debounceTimers.set(debounceKey, timer)
    })
  }

  private async executeRequest(context: CompletionContext): Promise<CompletionResponse | null> {
    const filePath = context.filePath

    const oldController = this.activeFileRequests.get(filePath)
    if (oldController) {
      oldController.abort()
      this.activeFileRequests.delete(filePath)
    }

    const controller = new AbortController()
    const startTime = Date.now()
    this.activeFileRequests.set(filePath, controller)

    try {
      const result = await this.handleIPCResponse(context, startTime)
      return result
    } catch {
      return null
    } finally {
      if (this.activeFileRequests.get(filePath) === controller) {
        this.activeFileRequests.delete(filePath)
      }
    }
  }

  private async handleIPCResponse(
    context: CompletionContext,
    startTime: number
  ): Promise<CompletionResponse> {
    const result = await window.api.completion.generate(context)

    if (result.type === 'error') {
      throw new Error(result.error || 'Unknown error')
    }

    if (!result.text) {
      throw new Error('Empty completion')
    }

    const completionText = this.postProcessCompletion(result.text, context)

    return {
      completionText,
      metrics: result.metrics ?? {
        requestTime: startTime,
        completeTime: Date.now(),
        tokenCount: this.estimateTokenCount(completionText)
      }
    }
  }

  private postProcessCompletion(text: string, context: CompletionContext): string {
    let result = text

    result = result.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')

    result = result
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<\/?(?:think|thinking)>/gi, '')
      .replace(/<\|(?:fim_prefix|fim_suffix|fim_middle|endoftext|file_sep|repo_name)\|>/g, '')

    result = result.trim()

    const lines = context.fileContent.split('\n')
    const currentLine = lines[context.cursorPosition.line - 1] || ''
    const beforeCursor = currentLine.substring(0, context.cursorPosition.column - 1)

    const prefixTokens = beforeCursor.trim().split(/\s+/)
    const lastTokens = prefixTokens.slice(-3).join(' ')

    const resultTrimmed = result.trimStart()
    if (lastTokens && resultTrimmed.startsWith(lastTokens)) {
      result = resultTrimmed.slice(lastTokens.length).trimStart()
      debug('Removed duplicate prefix:', lastTokens)
    }

    const resultLines = result.split('\n')
    if (resultLines.length > MAX_COMPLETION_LINES) {
      result = resultLines.slice(0, MAX_COMPLETION_LINES).join('\n')
      debug('Truncated to', MAX_COMPLETION_LINES, 'lines')
    }

    return result
  }

  cancelAll(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer))
    this.debounceTimers.clear()

    this.activeFileRequests.forEach((controller) => controller.abort())
    this.activeFileRequests.clear()
  }

  private getDebounceKey(context: CompletionContext): string {
    return `${context.filePath}:${context.cursorPosition.line}:${context.cursorPosition.column}`
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

let globalManager: CompletionRequestManager | null = null

export function getCompletionRequestManager(): CompletionRequestManager {
  if (!globalManager) {
    globalManager = new CompletionRequestManager()
  }
  return globalManager
}
