import { lint as markdownlintSync } from 'markdownlint/sync'
import { Diagnostic } from './diagnostics.service'

/**
 * Markdown 诊断服务
 * 使用 markdownlint 进行文档质量检查
 */
export class MarkdownDiagnosticsService {
  async getDiagnostics(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = []

    try {
      // 配置 markdownlint 规则
      const config = {
        default: true,

        // 禁用一些过于严格的规则
        'line-length': false, // MD013: 允许长行
        'no-inline-html': false, // MD033: 允许 HTML
        'no-bare-urls': false, // MD034: 允许裸 URL
        'first-line-heading': false, // MD041: 不强制第一行为标题

        // 启用重要规则
        'no-duplicate-heading': true, // MD024: 禁止重复标题
        'no-trailing-spaces': true, // MD009: 禁止行尾空格
        'no-multiple-blanks': true, // MD012: 禁止多个空行
        'blanks-around-headings': true, // MD022: 标题周围需要空行
        'blanks-around-fences': true, // MD031: 代码块周围需要空行
        'blanks-around-lists': true, // MD032: 列表周围需要空行

        // 代码块相关
        'fenced-code-language': {
          // MD040: 代码块需要语言标识
          language_only: false
        },

        // 列表相关
        'ul-style': { style: 'dash' }, // MD004: 无序列表使用 -
        'list-indent': true, // MD007: 列表缩进

        // 链接相关
        'no-empty-links': true, // MD042: 禁止空链接
        'link-fragments': true, // MD051: 检查链接片段

        // 其他
        'no-trailing-punctuation': {
          // MD026: 标题不应以标点结尾
          punctuation: '.,;:!'
        }
      }

      // 执行 lint
      const results = markdownlintSync({
        strings: {
          [filePath]: content
        },
        config: config as any
      })

      // 转换为诊断信息
      const issues = results[filePath] || []
      issues.forEach((issue) => {
        // 确定严重程度
        let severity: 'error' | 'warning' | 'info' = 'warning'

        // 一些规则应该是错误
        const errorRules = ['MD047', 'MD032', 'MD031'] // 文件结尾、列表空行等
        if (errorRules.includes(issue.ruleNames[0])) {
          severity = 'error'
        }

        // 一些规则只是提示
        const infoRules = ['MD013', 'MD041'] // 行长度、首行标题
        if (infoRules.includes(issue.ruleNames[0])) {
          severity = 'info'
        }

        diagnostics.push({
          filePath,
          line: issue.lineNumber,
          column: 1,
          severity,
          message: `${issue.ruleDescription}${issue.errorDetail ? ': ' + issue.errorDetail : ''}`,
          source: 'markdownlint',
          code: issue.ruleNames[0] // 例如 MD001
        })
      })
    } catch (error) {
      console.error('Markdown lint error:', error)
      // 如果 lint 失败，返回空数组，不影响用户使用
    }

    return diagnostics
  }

  /**
   * 检查 Markdown 链接有效性（基础版本）
   */
  async checkLinks(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = []
    const lines = content.split('\n')

    // 提取所有本地文件链接
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

    lines.forEach((line, index) => {
      let match
      while ((match = linkRegex.exec(line)) !== null) {
        const linkText = match[1]
        const linkUrl = match[2]

        // 检查空链接
        if (!linkUrl || linkUrl.trim() === '') {
          diagnostics.push({
            filePath,
            line: index + 1,
            column: match.index + 1,
            severity: 'error',
            message: `Empty link: [${linkText}]()`,
            source: 'markdown-links',
            code: 'empty-link'
          })
        }

        // 检查链接格式
        if (linkUrl.includes(' ') && !linkUrl.startsWith('http')) {
          diagnostics.push({
            filePath,
            line: index + 1,
            column: match.index + 1,
            severity: 'warning',
            message: `Link contains spaces: "${linkUrl}". Consider URL encoding or using quotes.`,
            source: 'markdown-links',
            code: 'link-spaces'
          })
        }
      }
    })

    return diagnostics
  }

  async analyze(filePath: string, content: string): Promise<Diagnostic[]> {
    const [lintDiagnostics, linkDiagnostics] = await Promise.all([
      this.getDiagnostics(filePath, content),
      this.checkLinks(filePath, content)
    ])

    return [...lintDiagnostics, ...linkDiagnostics]
  }
}
