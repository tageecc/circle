import { z } from 'zod'
import { DiagnosticsService } from '../services/diagnostics.service'
import * as path from 'path'
import * as fs from 'fs/promises'

/**
 * 读取 Linter 错误工具
 * 基于 Cursor 的 read_lints 设计，集成 Language Service
 */
export const readLintsTool = {
  description: `Read and display linter errors from the current workspace. You can provide paths to specific files or directories, or omit the argument to get diagnostics for all files.

- If a file path is provided, returns diagnostics for that file only
- If a directory path is provided, returns diagnostics for all files within that directory
- If no path is provided, returns diagnostics for all files in the workspace
- This tool can return linter errors that were already present before your edits, so avoid calling it with a very wide scope of files
- NEVER call this tool on a file unless you've edited it or are about to edit it`,

  parameters: z.object({
    paths: z
      .array(z.string())
      .optional()
      .describe('Optional array of paths to files or directories to read linter errors for')
  }),

  execute: async ({ paths }: { paths?: string[] }) => {
    try {
      const diagnosticsService = DiagnosticsService.getInstance()
      const allDiagnostics: any[] = []

      if (!paths || paths.length === 0) {
        console.warn(
          '[ReadLints] No paths provided - this operation can be slow for large projects'
        )
        return {
          success: true,
          message: 'Please provide specific file paths to check for linter errors',
          diagnostics: [],
          warning: 'Checking entire workspace is not recommended'
        }
      }

      // 处理每个路径
      for (const targetPath of paths) {
        const absolutePath = path.isAbsolute(targetPath)
          ? targetPath
          : path.resolve(process.cwd(), targetPath)

        try {
          const stat = await fs.stat(absolutePath)

          if (stat.isFile()) {
            // 单个文件
            const diagnostics = await diagnosticsService.getDiagnostics(absolutePath)
            allDiagnostics.push({
              filePath: targetPath,
              diagnostics: diagnostics.map((d) => ({
                line: d.line,
                column: d.column,
                severity: d.severity,
                message: d.message,
                source: d.source,
                code: d.code
              }))
            })
          } else if (stat.isDirectory()) {
            // 目录 - 递归扫描文件
            const files = await scanDirectory(absolutePath)
            for (const filePath of files) {
              const diagnostics = await diagnosticsService.getDiagnostics(filePath)
              if (diagnostics.length > 0) {
                allDiagnostics.push({
                  filePath: path.relative(process.cwd(), filePath),
                  diagnostics: diagnostics.map((d) => ({
                    line: d.line,
                    column: d.column,
                    severity: d.severity,
                    message: d.message,
                    source: d.source,
                    code: d.code
                  }))
                })
              }
            }
          }
        } catch (error: any) {
          console.error(`[ReadLints] Error processing ${targetPath}:`, error.message)
        }
      }

      // 统计错误和警告
      const totalErrors = allDiagnostics.reduce(
        (sum, f) => sum + f.diagnostics.filter((d: any) => d.severity === 'error').length,
        0
      )
      const totalWarnings = allDiagnostics.reduce(
        (sum, f) => sum + f.diagnostics.filter((d: any) => d.severity === 'warning').length,
        0
      )

      return {
        success: true,
        files: allDiagnostics,
        summary: {
          totalFiles: allDiagnostics.length,
          totalErrors,
          totalWarnings,
          totalIssues: totalErrors + totalWarnings
        }
      }
    } catch (error: any) {
      console.error('[ReadLints] Error:', error)
      return {
        success: false,
        error: error.message,
        diagnostics: []
      }
    }
  }
}

// 辅助函数：扫描目录
async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = []
  const supportedExts = ['.ts', '.tsx', '.js', '.jsx', '.yml', '.yaml', '.md', '.markdown']

  const walk = async (currentPath: string) => {
    const items = await fs.readdir(currentPath, { withFileTypes: true })

    for (const item of items) {
      // 跳过常见的忽略目录
      if (
        item.name.startsWith('.') ||
        item.name === 'node_modules' ||
        item.name === 'dist' ||
        item.name === 'build'
      ) {
        continue
      }

      const fullPath = path.join(currentPath, item.name)

      if (item.isDirectory()) {
        await walk(fullPath)
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (supportedExts.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  await walk(dir)
  return files
}
