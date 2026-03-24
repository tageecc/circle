import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { minimatch } from 'minimatch'
import { resolveFilePath } from './utils'

/**
 * 列出目录工具
 * 基于 Cursor 的 list_dir 设计
 */
export const listDirTool = {
  description: `Lists files and directories in a given path.

Other details:
- The result does not display dot-files and dot-directories`,

  parameters: z.object({
    target_directory: z.string().describe('Path to directory to list contents of'),
    ignore_globs: z
      .array(z.string())
      .optional()
      .describe('Optional array of glob patterns to ignore')
  }),

  execute: async ({
    target_directory,
    ignore_globs
  }: {
    target_directory: string
    ignore_globs?: string[]
  }) => {
    try {
      const absolutePath = resolveFilePath(target_directory)

      // 读取目录
      const entries = await fs.readdir(absolutePath, { withFileTypes: true })

      // 过滤和格式化
      const items: Array<{ name: string; type: 'file' | 'directory'; size?: number }> = []

      for (const entry of entries) {
        // 跳过隐藏文件
        if (entry.name.startsWith('.')) continue

        // 检查是否匹配忽略模式
        if (ignore_globs && ignore_globs.length > 0) {
          const relativePath = entry.name
          const shouldIgnore = ignore_globs.some((pattern) => {
            const fullPattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
            return (
              minimatch(relativePath, fullPattern) || minimatch(`**/${relativePath}`, fullPattern)
            )
          })
          if (shouldIgnore) continue
        }

        const fullPath = path.join(absolutePath, entry.name)

        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            type: 'directory'
          })
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          items.push({
            name: entry.name,
            type: 'file',
            size: stats.size
          })
        }
      }

      // 排序：目录在前，文件在后
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return {
        success: true,
        directory: target_directory,
        items,
        totalCount: items.length
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${target_directory}`)
      }
      if (error.code === 'ENOTDIR') {
        throw new Error(`Not a directory: ${target_directory}`)
      }
      throw new Error(`Failed to list directory: ${error.message}`)
    }
  }
}
