import * as path from 'path'
import * as fs from 'fs'
import { DiagnosticsService } from './diagnostics.service'
import type { Diagnostic } from './diagnostics.service'

const shadowByRoot = new Map<string, ShadowWorkspaceService>()

/**
 * 将补全文本「缝」入原文，用 DiagnosticsService 做 TS/JS 语义校验（轻量 Shadow）。
 */
export class ShadowWorkspaceService {
  private validating = false

  private constructor() {}

  static getInstance(projectRoot: string): ShadowWorkspaceService {
    let s = shadowByRoot.get(projectRoot)
    if (!s) {
      s = new ShadowWorkspaceService()
      shadowByRoot.set(projectRoot, s)
    }
    return s
  }

  /**
   * 合并补全后的全文，拉取诊断并筛到补全影响行范围。
   */
  async validateCompletion(params: {
    filePath: string
    originalContent: string
    cursorLine: number
    column: number
    completionText: string
  }): Promise<{ isValid: boolean; errors: Array<{ line: number; message: string }> }> {
    const { filePath, originalContent, cursorLine, column, completionText } = params

    if (this.validating) {
      return { isValid: true, errors: [] }
    }

    const ext = path.extname(filePath).toLowerCase()
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return { isValid: true, errors: [] }
    }

    this.validating = true
    try {
      const merged = applyCompletionToContent(originalContent, cursorLine, column, completionText)
      const completionLines = Math.max(1, completionText.split('\n').length)
      const lineStart = cursorLine
      const lineEnd = cursorLine + completionLines - 1

      const ds = DiagnosticsService.getInstance()
      const all = await ds.getDiagnostics(filePath, merged)
      const relevant = filterRelevantErrors(all, lineStart, lineEnd)
      const errors = relevant
        .filter((d) => d.severity === 'error')
        .map((d) => ({ line: d.line, message: d.message }))

      return {
        isValid: errors.length === 0,
        errors
      }
    } catch (e) {
      console.warn('[ShadowWorkspace] validateCompletion failed:', e)
      return { isValid: true, errors: [] }
    } finally {
      this.validating = false
    }
  }
}

export function getShadowWorkspace(projectRoot: string): ShadowWorkspaceService {
  return ShadowWorkspaceService.getInstance(projectRoot)
}

function applyCompletionToContent(
  content: string,
  line1Based: number,
  column1Based: number,
  completion: string
): string {
  const lines = content.split(/\r?\n/)
  const idx = line1Based - 1
  if (idx < 0 || idx >= lines.length) return content

  const line = lines[idx]
  const before = line.slice(0, column1Based - 1)
  const after = line.slice(column1Based - 1)
  const compLines = completion.split('\n')

  if (compLines.length === 1) {
    lines[idx] = before + compLines[0] + after
    return lines.join('\n')
  }

  const first = before + compLines[0]
  const last = compLines[compLines.length - 1] + after
  const middle = compLines.slice(1, -1)
  lines.splice(idx, 1, first, ...middle, last)
  return lines.join('\n')
}

function filterRelevantErrors(
  diags: Diagnostic[],
  lineStart: number,
  lineEnd: number
): Diagnostic[] {
  return diags.filter((d) => d.line >= lineStart && d.line <= lineEnd)
}

/**
 * 自文件路径向上查找项目根（package.json / tsconfig / jsconfig / .git）
 */
export function getProjectRootForFile(filePath: string): string | null {
  let dir = path.dirname(filePath)
  const markers = ['package.json', 'tsconfig.json', 'jsconfig.json', '.git']
  for (let i = 0; i < 12; i++) {
    for (const m of markers) {
      if (fs.existsSync(path.join(dir, m))) {
        return dir
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
