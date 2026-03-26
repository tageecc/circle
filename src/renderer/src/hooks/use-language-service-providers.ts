import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { LANGUAGE_SERVICE_UI } from '@/constants/ui.constants'

interface LanguageServiceProvidersOptions {
  editor: monaco.editor.IStandaloneCodeEditor | null
  workspaceRoot: string | null
  filePath: string
  language: string
}

/**
 * 将 TypeScript CompletionItemKind 映射到 Monaco CompletionItemKind
 */
function mapCompletionKind(kind: string): monaco.languages.CompletionItemKind {
  const kindMap: Record<string, monaco.languages.CompletionItemKind> = {
    method: monaco.languages.CompletionItemKind.Method,
    function: monaco.languages.CompletionItemKind.Function,
    constructor: monaco.languages.CompletionItemKind.Constructor,
    field: monaco.languages.CompletionItemKind.Field,
    variable: monaco.languages.CompletionItemKind.Variable,
    class: monaco.languages.CompletionItemKind.Class,
    struct: monaco.languages.CompletionItemKind.Struct,
    interface: monaco.languages.CompletionItemKind.Interface,
    module: monaco.languages.CompletionItemKind.Module,
    property: monaco.languages.CompletionItemKind.Property,
    event: monaco.languages.CompletionItemKind.Event,
    operator: monaco.languages.CompletionItemKind.Operator,
    unit: monaco.languages.CompletionItemKind.Unit,
    value: monaco.languages.CompletionItemKind.Value,
    constant: monaco.languages.CompletionItemKind.Constant,
    enum: monaco.languages.CompletionItemKind.Enum,
    enumMember: monaco.languages.CompletionItemKind.EnumMember,
    keyword: monaco.languages.CompletionItemKind.Keyword,
    text: monaco.languages.CompletionItemKind.Text,
    color: monaco.languages.CompletionItemKind.Color,
    file: monaco.languages.CompletionItemKind.File,
    reference: monaco.languages.CompletionItemKind.Reference,
    customcolor: monaco.languages.CompletionItemKind.Customcolor,
    folder: monaco.languages.CompletionItemKind.Folder,
    typeParameter: monaco.languages.CompletionItemKind.TypeParameter,
    snippet: monaco.languages.CompletionItemKind.Snippet
  }
  return kindMap[kind] || monaco.languages.CompletionItemKind.Text
}

export function useLanguageServiceProviders({
  editor,
  workspaceRoot,
  filePath,
  language
}: LanguageServiceProvidersOptions) {
  const disposablesRef = useRef<monaco.IDisposable[]>([])
  const hoverCacheRef = useRef<
    Map<string, { result: monaco.languages.Hover | null; timestamp: number }>
  >(new Map())

  useEffect(() => {
    if (!editor || !workspaceRoot || !filePath) {
      return
    }

    // 只为 TypeScript/JavaScript 文件提供增强功能
    const supportedLanguages = ['typescript', 'typescriptreact', 'javascript', 'javascriptreact']
    if (!supportedLanguages.includes(language)) {
      return
    }

    const model = editor.getModel()
    if (!model) return

    // 清理之前的 disposables
    disposablesRef.current.forEach((d) => d.dispose())
    disposablesRef.current = []

    // 超时辅助函数
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
      ])
    }

    // 🔥 0. Completion Item Provider - LSP 补全（下拉列表）
    const completionProvider = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.', '"', "'", '/', '@', '<'],
      provideCompletionItems: async (model, position) => {
        try {
          const offset = model.getOffsetAt(position)

          // 设置超时（补全要快）
          const completions = await withTimeout(
            window.api.languageService.getCompletions(workspaceRoot, filePath, offset),
            LANGUAGE_SERVICE_UI.COMPLETION_TIMEOUT
          )

          if (!completions || completions.length === 0) {
            return { suggestions: [] }
          }

          const suggestions: monaco.languages.CompletionItem[] = completions.map((item) => ({
            label: item.name,
            kind: mapCompletionKind(item.kind),
            insertText: item.insertText || item.name,
            sortText: item.sortText,
            detail: item.kindModifiers || '',
            range: undefined as any // Monaco 会自动计算
          }))

          return { suggestions }
        } catch (error) {
          if ((error as Error).message !== 'Timeout') {
            console.error('Completion provider error:', error)
          }
          return { suggestions: [] }
        }
      }
    })
    disposablesRef.current.push(completionProvider)

    // 1. Hover Provider - 增强的类型信息（带超时和缓存）
    const hoverProvider = monaco.languages.registerHoverProvider(language, {
      provideHover: async (model, position) => {
        try {
          const offset = model.getOffsetAt(position)
          const cacheKey = `${filePath}:${offset}`

          // 检查缓存
          const cached = hoverCacheRef.current.get(cacheKey)
          if (cached && Date.now() - cached.timestamp < LANGUAGE_SERVICE_UI.HOVER_CACHE_TTL) {
            return cached.result
          }

          // 设置超时
          const quickInfo = await withTimeout(
            window.api.languageService.getQuickInfo(workspaceRoot, filePath, offset),
            LANGUAGE_SERVICE_UI.HOVER_TIMEOUT
          )

          if (!quickInfo) {
            const result = null
            hoverCacheRef.current.set(cacheKey, { result, timestamp: Date.now() })
            return result
          }

          const displayText = quickInfo.displayParts.map((p) => p.text).join('')
          const docText = quickInfo.documentation.map((d) => d.text).join('\n')

          const result = {
            contents: [
              { value: `\`\`\`${language}\n${displayText}\n\`\`\`` },
              ...(docText ? [{ value: docText }] : [])
            ]
          }

          // 缓存结果
          hoverCacheRef.current.set(cacheKey, { result, timestamp: Date.now() })

          return result
        } catch (error) {
          if ((error as Error).message !== 'Timeout') {
            console.error('Hover provider error:', error)
          }
          return null
        }
      }
    })
    disposablesRef.current.push(hoverProvider)

    // 2. Definition Provider - 跨文件跳转
    const definitionProvider = monaco.languages.registerDefinitionProvider(language, {
      provideDefinition: async (model, position) => {
        try {
          const offset = model.getOffsetAt(position)
          const definitions = await window.api.languageService.getDefinition(
            workspaceRoot,
            filePath,
            offset
          )

          return definitions.map((def) => ({
            uri: monaco.Uri.file(def.fileName),
            range: {
              startLineNumber: model.getPositionAt(def.textSpan.start).lineNumber,
              startColumn: model.getPositionAt(def.textSpan.start).column,
              endLineNumber: model.getPositionAt(def.textSpan.start + def.textSpan.length)
                .lineNumber,
              endColumn: model.getPositionAt(def.textSpan.start + def.textSpan.length).column
            }
          }))
        } catch (error) {
          console.error('Definition provider error:', error)
          return []
        }
      }
    })
    disposablesRef.current.push(definitionProvider)

    // 3. References Provider - 查找所有引用
    const referencesProvider = monaco.languages.registerReferenceProvider(language, {
      provideReferences: async (model, position) => {
        try {
          const offset = model.getOffsetAt(position)
          const references = await window.api.languageService.getReferences(
            workspaceRoot,
            filePath,
            offset
          )

          return references.map((ref) => ({
            uri: monaco.Uri.file(ref.fileName),
            range: {
              startLineNumber: model.getPositionAt(ref.textSpan.start).lineNumber,
              startColumn: model.getPositionAt(ref.textSpan.start).column,
              endLineNumber: model.getPositionAt(ref.textSpan.start + ref.textSpan.length)
                .lineNumber,
              endColumn: model.getPositionAt(ref.textSpan.start + ref.textSpan.length).column
            }
          }))
        } catch (error) {
          console.error('References provider error:', error)
          return []
        }
      }
    })
    disposablesRef.current.push(referencesProvider)

    // 4. Rename Provider - 跨文件重命名
    const renameProvider = monaco.languages.registerRenameProvider(language, {
      provideRenameEdits: async (model, position, newName) => {
        try {
          const offset = model.getOffsetAt(position)
          const locations = await window.api.languageService.getRenameLocations(
            workspaceRoot,
            filePath,
            offset
          )

          const edits: monaco.languages.IWorkspaceTextEdit[] = locations.map((loc) => ({
            resource: monaco.Uri.file(loc.fileName),
            versionId: undefined,
            textEdit: {
              range: {
                startLineNumber: model.getPositionAt(loc.textSpan.start).lineNumber,
                startColumn: model.getPositionAt(loc.textSpan.start).column,
                endLineNumber: model.getPositionAt(loc.textSpan.start + loc.textSpan.length)
                  .lineNumber,
                endColumn: model.getPositionAt(loc.textSpan.start + loc.textSpan.length).column
              },
              text: newName
            }
          }))

          return { edits }
        } catch (error) {
          console.error('Rename provider error:', error)
          return { edits: [] }
        }
      }
    })
    disposablesRef.current.push(renameProvider)

    // 5. Document Formatting Provider
    const formattingProvider = monaco.languages.registerDocumentFormattingEditProvider(language, {
      provideDocumentFormattingEdits: async (model) => {
        try {
          const textChanges = await window.api.languageService.formatDocument(
            workspaceRoot,
            filePath
          )

          return textChanges.map((change) => ({
            range: {
              startLineNumber: model.getPositionAt(change.span.start).lineNumber,
              startColumn: model.getPositionAt(change.span.start).column,
              endLineNumber: model.getPositionAt(change.span.start + change.span.length).lineNumber,
              endColumn: model.getPositionAt(change.span.start + change.span.length).column
            },
            text: change.newText
          }))
        } catch (error) {
          console.error('Formatting provider error:', error)
          return []
        }
      }
    })
    disposablesRef.current.push(formattingProvider)

    // 6. Signature Help Provider - 函数签名提示
    const signatureHelpProvider = monaco.languages.registerSignatureHelpProvider(language, {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: async (model, position) => {
        try {
          const offset = model.getOffsetAt(position)
          const signatures = await window.api.languageService.getSignatureHelp(
            workspaceRoot,
            filePath,
            offset
          )

          if (signatures.length === 0) return null

          return {
            value: {
              activeSignature: 0,
              activeParameter: 0,
              signatures: signatures.map((sig) => ({
                label:
                  sig.prefix +
                  sig.parameters
                    .map((p) => p.displayParts.map((dp) => dp.text).join(''))
                    .join(sig.separator) +
                  sig.suffix,
                documentation: sig.documentation.map((d) => d.text).join('\n'),
                parameters: sig.parameters.map((param) => ({
                  label: param.displayParts.map((p) => p.text).join(''),
                  documentation: param.documentation.map((d) => d.text).join('\n')
                }))
              }))
            },
            dispose: () => {}
          }
        } catch (error) {
          console.error('Signature help provider error:', error)
          return null
        }
      }
    })
    disposablesRef.current.push(signatureHelpProvider)

    // 7. Code Actions Provider - 空实现，避免Monaco一直显示"Checking for quick fixes..."
    const codeActionsProvider = monaco.languages.registerCodeActionProvider(language, {
      provideCodeActions: () => {
        return {
          actions: [],
          dispose: () => {}
        }
      }
    })
    disposablesRef.current.push(codeActionsProvider)

    // 定期清理过期缓存
    const cacheCleanupInterval = setInterval(() => {
      const now = Date.now()
      const cache = hoverCacheRef.current
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > LANGUAGE_SERVICE_UI.CACHE_EXPIRY_THRESHOLD) {
          cache.delete(key)
        }
      }
    }, LANGUAGE_SERVICE_UI.CACHE_CLEANUP_INTERVAL)

    return () => {
      disposablesRef.current.forEach((d) => d.dispose())
      disposablesRef.current = []
      clearInterval(cacheCleanupInterval)
      hoverCacheRef.current.clear()
    }
  }, [editor, workspaceRoot, filePath, language])

  // 当内容改变时更新 Language Service（带 debounce）
  useEffect(() => {
    if (!editor || !workspaceRoot || !filePath) {
      return
    }

    const model = editor.getModel()
    if (!model) return

    const updateContent = () => {
      const content = model.getValue()
      window.api.languageService.updateFile(workspaceRoot, filePath, content).catch((err) => {
        console.error('Failed to update language service:', err)
      })
    }

    // 初始更新
    updateContent()

    // 监听内容变化（debounce）
    let timeoutId: NodeJS.Timeout
    const disposable = model.onDidChangeContent(() => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateContent, LANGUAGE_SERVICE_UI.UPDATE_DEBOUNCE)
    })

    return () => {
      clearTimeout(timeoutId)
      disposable.dispose()
    }
  }, [editor, workspaceRoot, filePath])
}
