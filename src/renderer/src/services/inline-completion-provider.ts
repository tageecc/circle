import type { Monaco } from '@monaco-editor/react'
import type { CancellationToken, Position, editor, languages } from 'monaco-editor'
import { completionDebug } from '../lib/completion-debug'
import { getCompletionRequestManager, type CompletionContext } from './completion-request-manager'

export interface InlineCompletionProviderOptions {
  enableValidation?: boolean
}

class InlineCompletionProvider implements languages.InlineCompletionsProvider {
  private requestManager = getCompletionRequestManager()

  constructor(private options: InlineCompletionProviderOptions = {}) {}

  async provideInlineCompletions(
    model: editor.ITextModel,
    position: Position,
    context: languages.InlineCompletionContext,
    token: CancellationToken
  ): Promise<languages.InlineCompletions | undefined> {
    if (token.isCancellationRequested) return undefined

    if (context.selectedSuggestionInfo) {
      return undefined
    }

    const filePath = model.uri.fsPath
    const fileContent = model.getValue()

    const ctx: CompletionContext = {
      filePath,
      fileContent,
      line: position.lineNumber,
      column: position.column,
      enableValidation: this.options.enableValidation === true
    }

    const res = await this.requestManager.requestCompletion(ctx)
    if (token.isCancellationRequested || !res?.completionText) return undefined

    if (completionDebug) console.log('[InlineCompletion] len=', res.completionText.length)

    return {
      items: [
        {
          insertText: res.completionText,
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
  }

  disposeInlineCompletions(_completions: languages.InlineCompletions, _reason: unknown): void {}

  dispose(): void {
    this.requestManager.cancelAll()
  }
}

export function registerInlineCompletionProvider(
  monacoInstance: Monaco,
  options?: InlineCompletionProviderOptions
): { dispose: () => void } {
  const provider = new InlineCompletionProvider(options ?? {})

  const disposable = monacoInstance.languages.registerInlineCompletionsProvider('*', provider)

  return {
    dispose: () => {
      disposable.dispose()
      provider.dispose()
    }
  }
}
