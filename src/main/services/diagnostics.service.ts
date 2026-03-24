import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as ts from 'typescript'
import { YAMLDiagnosticsService } from './yaml-diagnostics.service'
import { MarkdownDiagnosticsService } from './markdown-diagnostics.service'

export interface Diagnostic {
  filePath: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info'
  message: string
  source: string
  code?: string | number
}

interface FileCache {
  content: string
  diagnostics: Diagnostic[]
  timestamp: number
}

export class DiagnosticsService {
  private static instance: DiagnosticsService
  private fileCache: Map<string, FileCache> = new Map()
  private readonly CACHE_TTL = 5000
  private yamlService = new YAMLDiagnosticsService()
  private markdownService = new MarkdownDiagnosticsService()

  private constructor() {}

  static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService()
    }
    return DiagnosticsService.instance
  }

  async getDiagnostics(filePath: string, content?: string): Promise<Diagnostic[]> {
    const cached = this.fileCache.get(filePath)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_TTL && cached.content === content) {
      return cached.diagnostics
    }

    const diagnostics = await this.analyzeDiagnostics(filePath, content)

    this.fileCache.set(filePath, {
      content: content || '',
      diagnostics,
      timestamp: now
    })

    return diagnostics
  }

  private async analyzeDiagnostics(filePath: string, content?: string): Promise<Diagnostic[]> {
    const ext = path.extname(filePath).toLowerCase()

    // TypeScript/JavaScript
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const [typeScriptDiagnostics, eslintDiagnostics] = await Promise.all([
        this.getTypeScriptDiagnostics(filePath, content),
        this.getESLintDiagnostics(filePath, content)
      ])
      return this.deduplicateDiagnostics([...typeScriptDiagnostics, ...eslintDiagnostics])
    }

    // YAML
    if (['.yml', '.yaml'].includes(ext)) {
      const fileContent = content || (await fs.readFile(filePath, 'utf-8'))
      return this.yamlService.analyze(filePath, fileContent)
    }

    // Markdown
    if (['.md', '.markdown'].includes(ext)) {
      const fileContent = content || (await fs.readFile(filePath, 'utf-8'))
      return this.markdownService.analyze(filePath, fileContent)
    }

    return []
  }

  private async getTypeScriptDiagnostics(
    filePath: string,
    content?: string
  ): Promise<Diagnostic[]> {
    try {
      const projectRoot = await this.findProjectRoot(filePath)
      if (!projectRoot) {
        return []
      }

      const ext = path.extname(filePath).toLowerCase()

      const diagnostics: Diagnostic[] = []
      const fileContent = content || (await fs.readFile(filePath, 'utf-8'))

      // 判断是否包含 JSX
      const hasJSX = ['.tsx', '.jsx'].includes(ext)
      const isTypeScript = ['.ts', '.tsx'].includes(ext)

      // 使用 TypeScript 编译器 API 进行语法检查
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: hasJSX ? ts.JsxEmit.React : ts.JsxEmit.None,
        allowJs: true,
        checkJs: !isTypeScript,
        strict: isTypeScript,
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        lib: ['ES2020', 'DOM', 'DOM.Iterable']
      }

      // 尝试加载项目的 tsconfig.json 或 jsconfig.json
      const configFiles = ['tsconfig.json', 'jsconfig.json']

      for (const configFile of configFiles) {
        try {
          const configPath = path.join(projectRoot, configFile)
          const configContent = await fs.readFile(configPath, 'utf-8')
          const parseResult = ts.parseConfigFileTextToJson(configPath, configContent)
          if (parseResult.config && parseResult.config.compilerOptions) {
            Object.assign(compilerOptions, parseResult.config.compilerOptions)
            break
          }
        } catch {
          continue
        }
      }

      // 确保 JSX 配置正确
      if (hasJSX) {
        compilerOptions.jsx = compilerOptions.jsx || ts.JsxEmit.React
      }

      // 确定脚本类型
      let scriptKind: ts.ScriptKind
      if (ext === '.tsx') {
        scriptKind = ts.ScriptKind.TSX
      } else if (ext === '.jsx') {
        scriptKind = ts.ScriptKind.JSX
      } else if (ext === '.ts') {
        scriptKind = ts.ScriptKind.TS
      } else {
        scriptKind = ts.ScriptKind.JS
      }

      // 创建虚拟的 SourceFile
      const sourceFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      )

      // 创建编译器主机
      const host: ts.CompilerHost = {
        getSourceFile: (fileName) => {
          if (fileName === filePath) {
            return sourceFile
          }
          return undefined
        },
        writeFile: () => {},
        getCurrentDirectory: () => projectRoot,
        getDirectories: () => [],
        fileExists: (fileName) => fileName === filePath,
        readFile: (fileName) => (fileName === filePath ? fileContent : undefined),
        getCanonicalFileName: (fileName) => fileName,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options)
      }

      // 创建程序并获取诊断信息
      const program = ts.createProgram([filePath], compilerOptions, host)
      const tsDiagnostics = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile)
      ]

      // 转换 TypeScript 诊断为我们的格式
      tsDiagnostics.forEach((tsDiag) => {
        if (tsDiag.file && tsDiag.start !== undefined) {
          const { line, character } = tsDiag.file.getLineAndCharacterOfPosition(tsDiag.start)

          let severity: 'error' | 'warning' | 'info' = 'error'
          if (tsDiag.category === ts.DiagnosticCategory.Warning) {
            severity = 'warning'
          } else if (
            tsDiag.category === ts.DiagnosticCategory.Message ||
            tsDiag.category === ts.DiagnosticCategory.Suggestion
          ) {
            severity = 'info'
          }

          diagnostics.push({
            filePath,
            line: line + 1, // TypeScript 从 0 开始，Monaco 从 1 开始
            column: character + 1,
            severity,
            message: ts.flattenDiagnosticMessageText(tsDiag.messageText, '\n'),
            source: 'typescript',
            code: `TS${tsDiag.code}`
          })
        }
      })

      return diagnostics
    } catch (error) {
      console.error('TypeScript diagnostics error:', error)
      return []
    }
  }

  private async getESLintDiagnostics(filePath: string, _content?: string): Promise<Diagnostic[]> {
    try {
      const projectRoot = await this.findProjectRoot(filePath)
      if (!projectRoot) return []

      const eslintConfigs = [
        'eslint.config.mjs',
        'eslint.config.js',
        '.eslintrc.json',
        '.eslintrc.js',
        '.eslintrc'
      ]

      let hasESLintConfig = false
      for (const configFile of eslintConfigs) {
        const configPath = path.join(projectRoot, configFile)
        if (
          await fs
            .access(configPath)
            .then(() => true)
            .catch(() => false)
        ) {
          hasESLintConfig = true
          break
        }
      }

      if (!hasESLintConfig) return []

      return new Promise((resolve) => {
        const diagnostics: Diagnostic[] = []
        const eslintPath = path.join(projectRoot, 'node_modules', '.bin', 'eslint')

        fs.access(eslintPath)
          .then(() => {
            const eslint = spawn(eslintPath, [filePath, '--format', 'json', '--no-color'], {
              cwd: projectRoot,
              shell: process.platform === 'win32'
            })

            let output = ''
            eslint.stdout.on('data', (data) => {
              output += data.toString()
            })

            eslint.on('close', () => {
              try {
                if (output.trim()) {
                  const results = JSON.parse(output)
                  if (results && results.length > 0) {
                    const fileResult = results[0]
                    fileResult.messages?.forEach((msg: any) => {
                      diagnostics.push({
                        filePath,
                        line: msg.line,
                        column: msg.column,
                        severity:
                          msg.severity === 2 ? 'error' : msg.severity === 1 ? 'warning' : 'info',
                        message: msg.message,
                        source: 'eslint',
                        code: msg.ruleId
                      })
                    })
                  }
                }
              } catch (error) {
                console.error('ESLint parse error:', error)
              }
              resolve(diagnostics)
            })

            eslint.on('error', () => {
              resolve([])
            })
          })
          .catch(() => {
            resolve([])
          })
      })
    } catch (error) {
      console.error('ESLint diagnostics error:', error)
      return []
    }
  }

  private async findProjectRoot(filePath: string): Promise<string | null> {
    let currentDir = path.dirname(filePath)
    const root = path.parse(currentDir).root

    while (currentDir !== root) {
      const packageJsonPath = path.join(currentDir, 'package.json')
      const hasPackageJson = await fs
        .access(packageJsonPath)
        .then(() => true)
        .catch(() => false)

      if (hasPackageJson) {
        return currentDir
      }

      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) break
      currentDir = parentDir
    }

    return null
  }

  private deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    const seen = new Set<string>()
    return diagnostics.filter((d) => {
      const key = `${d.filePath}:${d.line}:${d.column}:${d.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  clearCache(filePath?: string): void {
    if (filePath) {
      this.fileCache.delete(filePath)
    } else {
      this.fileCache.clear()
    }
  }
}
