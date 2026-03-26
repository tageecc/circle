import { parse as parseYAML, YAMLParseError } from 'yaml'
import { Diagnostic } from './diagnostics.service'

/**
 * YAML 诊断服务
 * 使用 yaml 库进行语法检查
 */
export class YAMLDiagnosticsService {
  async getDiagnostics(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = []

    try {
      // 尝试解析 YAML
      parseYAML(content, {
        strict: true,
        uniqueKeys: true,
        prettyErrors: true
      })
    } catch (error) {
      if (error instanceof YAMLParseError) {
        // 提取错误位置信息
        const linePos = error.linePos?.[0]
        const line = linePos?.line || 1
        const column = linePos?.col || 1

        diagnostics.push({
          filePath,
          line,
          column,
          severity: 'error',
          message: error.message,
          source: 'yaml',
          code: 'parse-error'
        })
      } else if (error instanceof Error) {
        // 其他错误
        diagnostics.push({
          filePath,
          line: 1,
          column: 1,
          severity: 'error',
          message: error.message,
          source: 'yaml',
          code: 'unknown-error'
        })
      }
    }

    return diagnostics
  }

  /**
   * 检查常见的 YAML 问题
   */
  async lintYAML(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      // 检查制表符（YAML 不允许使用 Tab）
      if (line.includes('\t')) {
        diagnostics.push({
          filePath,
          line: lineNumber,
          column: line.indexOf('\t') + 1,
          severity: 'error',
          message: 'YAML does not allow tabs for indentation. Use spaces instead.',
          source: 'yaml-lint',
          code: 'no-tabs'
        })
      }

      // 检查行尾空格
      if (line.endsWith(' ') && line.trim().length > 0) {
        diagnostics.push({
          filePath,
          line: lineNumber,
          column: line.length,
          severity: 'warning',
          message: 'Trailing whitespace',
          source: 'yaml-lint',
          code: 'trailing-spaces'
        })
      }

      // 检查重复的键（简单检查）
      const match = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)$/)
      if (match) {
        const key = match[2]
        const laterLines = lines.slice(index + 1)
        const indent = match[1]

        for (let i = 0; i < laterLines.length; i++) {
          const laterLine = laterLines[i]
          const laterMatch = laterLine.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)$/)

          if (laterMatch) {
            const laterIndent = laterMatch[1]
            const laterKey = laterMatch[2]

            // 如果缩进相同且键相同，可能是重复键
            if (laterIndent === indent && laterKey === key) {
              diagnostics.push({
                filePath,
                line: index + 1 + i + 1,
                column: laterIndent.length + 1,
                severity: 'warning',
                message: `Duplicate key "${key}" found`,
                source: 'yaml-lint',
                code: 'duplicate-key'
              })
              break
            }

            // 如果缩进更小，说明已经退出当前层级
            if (laterIndent.length < indent.length) {
              break
            }
          }
        }
      }
    })

    return diagnostics
  }

  async analyze(filePath: string, content: string): Promise<Diagnostic[]> {
    // 先进行语法检查
    const syntaxDiagnostics = await this.getDiagnostics(filePath, content)

    // 如果有语法错误，不继续 lint
    if (syntaxDiagnostics.length > 0) {
      return syntaxDiagnostics
    }

    // 进行 lint 检查
    const lintDiagnostics = await this.lintYAML(filePath, content)

    return [...syntaxDiagnostics, ...lintDiagnostics]
  }
}
