import * as ts from 'typescript'
import * as path from 'path'
import * as fs from 'fs/promises'

interface LanguageServiceFile {
  version: number
  content: string
}

export interface QuickInfo {
  kind: string
  kindModifiers: string
  displayParts: { text: string; kind: string }[]
  documentation: { text: string; kind: string }[]
}

export interface DefinitionInfo {
  fileName: string
  textSpan: { start: number; length: number }
  kind: string
  name: string
  containerKind: string
  containerName: string
}

export interface ReferenceEntry {
  fileName: string
  textSpan: { start: number; length: number }
  isWriteAccess: boolean
  isDefinition: boolean
}

export interface RenameLocation {
  fileName: string
  textSpan: { start: number; length: number }
}

export interface CompletionEntry {
  name: string
  kind: string
  kindModifiers: string
  sortText: string
  insertText?: string
  replacementSpan?: { start: number; length: number }
}

export interface SignatureHelpItem {
  prefix: string
  suffix: string
  separator: string
  parameters: Array<{
    name: string
    documentation: Array<{ text: string; kind: string }>
    displayParts: Array<{ text: string; kind: string }>
  }>
  documentation: Array<{ text: string; kind: string }>
}

export interface Diagnostic {
  line: number
  column: number
  length: number
  message: string
  category: 'error' | 'warning' | 'suggestion'
  code: number
}

export class LanguageService {
  private static instances: Map<string, LanguageService> = new Map()
  private service: ts.LanguageService
  private files: Map<string, LanguageServiceFile> = new Map()
  private compilerOptions: ts.CompilerOptions
  private projectRoot: string

  private constructor(projectRoot: string, compilerOptions: ts.CompilerOptions) {
    this.projectRoot = projectRoot
    this.compilerOptions = compilerOptions

    const serviceHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => Array.from(this.files.keys()),
      getScriptVersion: (fileName) => this.files.get(fileName)?.version.toString() || '0',
      getScriptSnapshot: (fileName) => {
        const file = this.files.get(fileName)
        if (file) {
          return ts.ScriptSnapshot.fromString(file.content)
        }

        try {
          const content = ts.sys.readFile(fileName)
          if (content) {
            return ts.ScriptSnapshot.fromString(content)
          }
        } catch (e) {
          return undefined
        }
        return undefined
      },
      getCurrentDirectory: () => this.projectRoot,
      getCompilationSettings: () => this.compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: (fileName) => {
        if (this.files.has(fileName)) {
          return true
        }
        return ts.sys.fileExists(fileName)
      },
      readFile: (fileName) => {
        const file = this.files.get(fileName)
        if (file) {
          return file.content
        }
        return ts.sys.readFile(fileName)
      },
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories
    }

    this.service = ts.createLanguageService(serviceHost, ts.createDocumentRegistry())
  }

  static async getInstance(projectRoot: string): Promise<LanguageService> {
    if (LanguageService.instances.has(projectRoot)) {
      return LanguageService.instances.get(projectRoot)!
    }

    const compilerOptions = await LanguageService.loadCompilerOptions(projectRoot)
    const instance = new LanguageService(projectRoot, compilerOptions)
    LanguageService.instances.set(projectRoot, instance)
    return instance
  }

  private static async loadCompilerOptions(projectRoot: string): Promise<ts.CompilerOptions> {
    const defaultOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      allowJs: true,
      checkJs: false,
      esModuleInterop: true,
      skipLibCheck: true,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      allowSyntheticDefaultImports: true,
      strict: false
    }

    const configFiles = ['tsconfig.json', 'jsconfig.json']

    for (const configFile of configFiles) {
      try {
        const configPath = path.join(projectRoot, configFile)
        const configContent = await fs.readFile(configPath, 'utf-8')

        // 使用 parseJsonConfigFileContent 正确解析配置，将字符串值转换为枚举值
        const parseResult = ts.parseConfigFileTextToJson(configPath, configContent)
        if (parseResult.error || !parseResult.config) continue

        const parsedConfig = ts.parseJsonConfigFileContent(
          parseResult.config,
          ts.sys,
          projectRoot,
          undefined,
          configPath
        )

        if (parsedConfig.options) {
          return { ...defaultOptions, ...parsedConfig.options }
        }
      } catch (error) {
        continue
      }
    }

    return defaultOptions
  }

  updateFile(fileName: string, content: string): void {
    const existing = this.files.get(fileName)
    if (existing) {
      existing.version++
      existing.content = content
    } else {
      this.files.set(fileName, { version: 1, content })
    }
  }

  getQuickInfoAtPosition(fileName: string, position: number): QuickInfo | null {
    const info = this.service.getQuickInfoAtPosition(fileName, position)
    if (!info) return null

    return {
      kind: info.kind,
      kindModifiers: info.kindModifiers || '',
      displayParts: info.displayParts?.map((p) => ({ text: p.text, kind: p.kind })) || [],
      documentation: info.documentation?.map((d) => ({ text: d.text, kind: d.kind })) || []
    }
  }

  getDefinitionAtPosition(fileName: string, position: number): DefinitionInfo[] {
    const definitions = this.service.getDefinitionAtPosition(fileName, position)
    if (!definitions) return []

    return definitions.map((def) => ({
      fileName: def.fileName,
      textSpan: { start: def.textSpan.start, length: def.textSpan.length },
      kind: def.kind,
      name: def.name || '',
      containerKind: def.containerKind || '',
      containerName: def.containerName || ''
    }))
  }

  getReferencesAtPosition(fileName: string, position: number): ReferenceEntry[] {
    const references = this.service.getReferencesAtPosition(fileName, position)
    if (!references) return []

    return references.map((ref) => ({
      fileName: ref.fileName,
      textSpan: { start: ref.textSpan.start, length: ref.textSpan.length },
      isWriteAccess: ref.isWriteAccess,
      isDefinition: (ref as any).isDefinition || false
    }))
  }

  getRenameLocations(fileName: string, position: number): RenameLocation[] {
    const renameInfo = this.service.findRenameLocations(fileName, position, false, false)
    if (!renameInfo) return []

    return renameInfo.map((loc) => ({
      fileName: loc.fileName,
      textSpan: { start: loc.textSpan.start, length: loc.textSpan.length }
    }))
  }

  getCompletionsAtPosition(
    fileName: string,
    position: number,
    options?: ts.GetCompletionsAtPositionOptions
  ): CompletionEntry[] {
    const completions = this.service.getCompletionsAtPosition(fileName, position, options)
    if (!completions) return []

    return completions.entries.map((entry) => ({
      name: entry.name,
      kind: entry.kind,
      kindModifiers: entry.kindModifiers || '',
      sortText: entry.sortText,
      insertText: entry.insertText,
      replacementSpan: entry.replacementSpan
        ? { start: entry.replacementSpan.start, length: entry.replacementSpan.length }
        : undefined
    }))
  }

  getSignatureHelpAtPosition(fileName: string, position: number): SignatureHelpItem[] {
    const signatureHelp = this.service.getSignatureHelpItems(fileName, position, undefined)
    if (!signatureHelp) return []

    return signatureHelp.items.map((item) => ({
      prefix: item.prefixDisplayParts.map((p) => p.text).join(''),
      suffix: item.suffixDisplayParts.map((p) => p.text).join(''),
      separator: item.separatorDisplayParts.map((p) => p.text).join(''),
      parameters: item.parameters.map((param) => ({
        name: param.name,
        documentation: param.documentation?.map((d) => ({ text: d.text, kind: d.kind })) || [],
        displayParts: param.displayParts.map((p) => ({ text: p.text, kind: p.kind }))
      })),
      documentation: item.documentation?.map((d) => ({ text: d.text, kind: d.kind })) || []
    }))
  }

  formatDocument(fileName: string): ts.TextChange[] {
    return this.service.getFormattingEditsForDocument(fileName, {
      indentSize: 2,
      tabSize: 2,
      convertTabsToSpaces: true,
      insertSpaceAfterCommaDelimiter: true,
      insertSpaceAfterSemicolonInForStatements: true,
      insertSpaceBeforeAndAfterBinaryOperators: true,
      insertSpaceAfterKeywordsInControlFlowStatements: true,
      insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true
    })
  }

  /**
   * 获取文件的诊断错误
   * 🔥 用于 Shadow Workspace 验证
   */
  getDiagnostics(fileName: string): Diagnostic[] {
    const syntacticDiagnostics = this.service.getSyntacticDiagnostics(fileName)
    const semanticDiagnostics = this.service.getSemanticDiagnostics(fileName)

    const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics]

    return allDiagnostics.map((diag) => {
      const file = diag.file
      const start = diag.start || 0
      const position = file?.getLineAndCharacterOfPosition(start) || { line: 0, character: 0 }

      return {
        line: position.line + 1,
        column: position.character + 1,
        length: diag.length || 0,
        message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
        category:
          diag.category === ts.DiagnosticCategory.Error
            ? 'error'
            : diag.category === ts.DiagnosticCategory.Warning
              ? 'warning'
              : 'suggestion',
        code: diag.code
      }
    })
  }

  /**
   * 获取文件内容（用于 Shadow Workspace 快照）
   */
  getFileContent(fileName: string): string | null {
    const file = this.files.get(fileName)
    if (file) {
      return file.content
    }

    try {
      const content = ts.sys.readFile(fileName)
      return content || null
    } catch {
      return null
    }
  }
}
