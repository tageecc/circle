import { completionDebug } from '../lib/completion-debug'

export interface CompletionContext {
  filePath: string
  fileContent: string
  line: number
  column: number
  enableValidation?: boolean
}

export interface CompletionResponse {
  completionText: string
  metrics?: { validated?: boolean; attempts?: number; errors?: number }
}

const DEBOUNCE_MS = 100

export class CompletionRequestManager {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  async requestCompletion(context: CompletionContext): Promise<CompletionResponse | null> {
    const key = this.getDebounceKey(context)
    return new Promise((resolve) => {
      const existing = this.debounceTimers.get(key)
      if (existing) clearTimeout(existing)

      const timer = setTimeout(() => {
        this.debounceTimers.delete(key)
        void this.executeRequest(context)
          .then(resolve)
          .catch(() => resolve(null))
      }, DEBOUNCE_MS)
      this.debounceTimers.set(key, timer)
    })
  }

  private async executeRequest(context: CompletionContext): Promise<CompletionResponse | null> {
    try {
      const raw = await window.api.completion.generate({
        filePath: context.filePath,
        fileContent: context.fileContent,
        line: context.line,
        column: context.column,
        enableValidation: context.enableValidation
      })

      if (raw.type === 'error') {
        if (completionDebug) console.warn('[Completion]', raw.error)
        return null
      }

      return {
        completionText: raw.text,
        metrics: raw.metrics
      }
    } catch (e) {
      if (completionDebug) console.warn('[Completion] executeRequest', e)
      return null
    }
  }

  cancelAll(): void {
    for (const t of this.debounceTimers.values()) clearTimeout(t)
    this.debounceTimers.clear()
  }

  private getDebounceKey(c: CompletionContext): string {
    return `${c.filePath}:${c.line}:${c.column}`
  }
}

let singleton: CompletionRequestManager | null = null

export function getCompletionRequestManager(): CompletionRequestManager {
  if (!singleton) singleton = new CompletionRequestManager()
  return singleton
}
