/**
 * Monaco inline completion provider (FIM): completion at any position with project context.
 */

const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG_COMPLETION === 'true'
const debug = (...args: any[]) => DEBUG && console.log('[InlineCompletion]', ...args)

import type * as monaco from 'monaco-editor'
import { getCompletionRequestManager, type CompletionContext } from './completion-request-manager'

export interface InlineCompletionProviderOptions {
  enabled?: boolean
  /** Shadow workspace validation (default off for latency). */
  enableValidation?: boolean
}

export class InlineCompletionProvider implements monaco.languages.InlineCompletionsProvider {
  private options: {
    enabled: boolean
    enableValidation: boolean
  }
  private requestManager = getCompletionRequestManager()

  constructor(_monacoInstance: typeof monaco, options?: InlineCompletionProviderOptions) {
    this.options = {
      enabled: options?.enabled ?? true,
      enableValidation: options?.enableValidation ?? false
    }
  }

  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions | undefined> {
    if (!this.options.enabled || token.isCancellationRequested) {
      return undefined
    }

    if (context.selectedSuggestionInfo) {
      return undefined
    }

    try {
      const completionContext = this.buildCompletionContext(model, position)
      const response = await this.requestManager.requestCompletion(completionContext)

      if (!response || !response.completionText || token.isCancellationRequested) {
        return undefined
      }

      return {
        items: [
          {
            insertText: response.completionText,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            }
          }
        ],
        enableForwardStability: true
      }
    } catch {
      return undefined
    }
  }

  freeInlineCompletions(): void {}
  handleItemDidShow(): void {}
  disposeInlineCompletions(): void {}

  private buildCompletionContext(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): CompletionContext {
    return {
      filePath: model.uri.path,
      fileContent: model.getValue(),
      language: model.getLanguageId(),
      cursorPosition: {
        line: position.lineNumber,
        column: position.column
      },
      enableValidation: this.options.enableValidation
    }
  }

  dispose(): void {
    this.requestManager.cancelAll()
  }
}

// Retain provider reference so it is not collected while registered.
let globalProvider: InlineCompletionProvider | null = null

export function registerInlineCompletionProvider(
  monacoInstance: typeof monaco,
  options?: InlineCompletionProviderOptions
): monaco.IDisposable {
  const provider = new InlineCompletionProvider(monacoInstance, options)
  globalProvider = provider

  const disposable = monacoInstance.languages.registerInlineCompletionsProvider('*', provider)
  debug('Provider registered')

  return {
    dispose: () => {
      disposable.dispose()
      provider.dispose()
      globalProvider = null
      debug('Provider disposed')
    }
  }
}

export { globalProvider }
