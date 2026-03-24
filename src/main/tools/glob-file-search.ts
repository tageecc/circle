import { z } from 'zod'
import { glob } from 'glob'
import * as path from 'path'

/**
 * 文件名模式搜索工具
 * 基于 Cursor 的 glob_file_search 设计
 */
export const globFileSearchTool = {
  description: `Tool to search for files matching a glob pattern

- Works fast with codebases of any size
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns`,

  parameters: z.object({
    glob_pattern: z.string().describe('The glob pattern to match files against'),
    target_directory: z.string().optional().describe('Path to directory to search for files in')
  }),

  execute: async ({
    glob_pattern,
    target_directory
  }: {
    glob_pattern: string
    target_directory?: string
  }) => {
    try {
      // 如果模式不以 **/ 开头，自动添加
      const pattern = glob_pattern.startsWith('**/') ? glob_pattern : `**/${glob_pattern}`

      const cwd = target_directory
        ? path.isAbsolute(target_directory)
          ? target_directory
          : path.resolve(process.cwd(), target_directory)
        : process.cwd()

      // 执行 glob 搜索
      const files = await glob(pattern, {
        cwd,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        nodir: true,
        stat: true,
        withFileTypes: true
      })

      // 按修改时间排序
      const sortedFiles = files
        .map((file) => ({
          path: file.relative(),
          mtime: file.mtime?.getTime() || 0
        }))
        .sort((a, b) => b.mtime - a.mtime)

      return {
        success: true,
        pattern: glob_pattern,
        directory: target_directory || process.cwd(),
        files: sortedFiles.map((f) => f.path),
        count: sortedFiles.length
      }
    } catch (error: any) {
      throw new Error(`Glob search failed: ${error.message}`)
    }
  }
}
