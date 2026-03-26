/**
 * Shadow Workspace Service - 轻量级代码验证
 *
 * 核心思路：
 * 1. 复用单个 LanguageService 实例（避免多实例内存开销）
 * 2. 快照 + 回滚机制（临时修改 → 验证 → 立即恢复）
 * 3. Main Process 同步调用（无 RPC 开销）
 * 4. 并发控制（最多 1 个验证任务，避免竞争）
 *
 * 与过度设计的方案对比：
 * ❌ 独立 Server 进程 + Unix Socket → ✅ Main Process 直接调用
 * ❌ 多个 LanguageService 实例 → ✅ 单例复用
 * ❌ Session 生命周期管理 → ✅ 无状态验证
 * ❌ 100ms RPC 开销 → ✅ <5ms 函数调用
 */

import { LanguageService, Diagnostic } from './language-service'

interface ValidationResult {
  isValid: boolean
  errors: Diagnostic[]
}

interface FileSnapshot {
  filePath: string
  originalContent: string
}

export class ShadowWorkspaceService {
  private languageService: LanguageService | null = null
  private isValidating = false
  private currentSnapshot: FileSnapshot | null = null

  /**
   * 初始化（延迟加载，只在需要时创建 LanguageService）
   */
  async initialize(projectRoot: string): Promise<void> {
    if (!this.languageService) {
      this.languageService = await LanguageService.getInstance(projectRoot)
    }
  }

  /**
   * 验证补全代码
   *
   * @param filePath 文件路径
   * @param originalContent 原始文件内容
   * @param completion 补全代码
   * @param cursorPosition 光标位置
   */
  async validateCompletion(
    filePath: string,
    originalContent: string,
    completion: string,
    cursorPosition: { line: number; column: number }
  ): Promise<ValidationResult> {
    // 🔥 并发控制：同时只能有一个验证任务
    if (this.isValidating) {
      console.warn('[ShadowWorkspace] Already validating, skipping')
      return { isValid: true, errors: [] } // 乐观返回
    }

    // 🔥 只验证 TS/JS 文件
    if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      return { isValid: true, errors: [] }
    }

    if (!this.languageService) {
      console.warn('[ShadowWorkspace] LanguageService not initialized')
      return { isValid: true, errors: [] }
    }

    this.isValidating = true

    try {
      // 1. 保存快照（用于回滚）
      this.currentSnapshot = {
        filePath,
        originalContent: this.languageService.getFileContent(filePath) || originalContent
      }

      // 2. 应用补全到内存文件
      const newContent = this.applyCompletion(originalContent, completion, cursorPosition)
      this.languageService.updateFile(filePath, newContent)

      // 3. 获取诊断错误
      const diagnostics = this.languageService.getDiagnostics(filePath)

      // 4. 立即回滚
      this.rollback()

      // 5. 过滤相关错误（只关注补全区域的错误）
      const relevantErrors = this.filterRelevantErrors(diagnostics, cursorPosition, completion)

      // 6. 只关注 Error 级别（忽略 Warning）
      const errors = relevantErrors.filter((d) => d.category === 'error')

      return {
        isValid: errors.length === 0,
        errors
      }
    } catch (error) {
      console.error('[ShadowWorkspace] Validation failed:', error)
      this.rollback() // 确保回滚
      return { isValid: true, errors: [] } // 验证失败 → 乐观返回
    } finally {
      this.isValidating = false
    }
  }

  /**
   * 应用补全到原始内容
   */
  private applyCompletion(
    originalContent: string,
    completion: string,
    cursorPosition: { line: number; column: number }
  ): string {
    const lines = originalContent.split('\n')
    const lineIndex = cursorPosition.line - 1
    const currentLine = lines[lineIndex] || ''

    const before = currentLine.substring(0, cursorPosition.column - 1)
    const after = currentLine.substring(cursorPosition.column - 1)

    const completionLines = completion.split('\n')
    if (completionLines.length === 1) {
      // 单行补全
      lines[lineIndex] = before + completion + after
    } else {
      // 多行补全
      lines[lineIndex] = before + completionLines[0]
      const middleLines = completionLines.slice(1, -1)
      const lastLine = completionLines[completionLines.length - 1] + after
      lines.splice(lineIndex + 1, 0, ...middleLines, lastLine)
    }

    return lines.join('\n')
  }

  /**
   * 过滤相关错误（只关注补全区域）
   */
  private filterRelevantErrors(
    errors: Diagnostic[],
    cursorPosition: { line: number; column: number },
    completion: string
  ): Diagnostic[] {
    const completionLines = completion.split('\n').length
    const startLine = cursorPosition.line
    const endLine = startLine + completionLines - 1

    return errors.filter((e) => e.line >= startLine && e.line <= endLine)
  }

  /**
   * 回滚到快照状态
   */
  private rollback(): void {
    if (this.currentSnapshot && this.languageService) {
      this.languageService.updateFile(
        this.currentSnapshot.filePath,
        this.currentSnapshot.originalContent
      )
      this.currentSnapshot = null
    }
  }
}

// 按项目根目录缓存实例
const shadowWorkspaceInstances = new Map<string, ShadowWorkspaceService>()

export async function getShadowWorkspace(projectRoot: string): Promise<ShadowWorkspaceService> {
  let instance = shadowWorkspaceInstances.get(projectRoot)

  if (!instance) {
    instance = new ShadowWorkspaceService()
    await instance.initialize(projectRoot)
    shadowWorkspaceInstances.set(projectRoot, instance)
  }

  return instance
}
