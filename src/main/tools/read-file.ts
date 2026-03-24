import { z } from 'zod'
import { promises as fs } from 'fs'
import { resolveFilePath } from './utils'

/**
 * 读取文件工具
 * 基于 Cursor 的 read_file 设计
 */
export const readFileTool = {
  description: `Reads a file from the local filesystem. You can access any file directly by using this tool.

Usage:
- You can optionally specify a line offset and limit
- Lines in the output are numbered starting at 1
- Supported image formats: jpeg/jpg, png, gif, webp`,

  parameters: z.object({
    target_file: z.string().describe('The path of the file to read'),
    offset: z.number().optional().describe('The line number to start reading from'),
    limit: z.number().optional().describe('The number of lines to read')
  }),

  execute: async ({
    target_file,
    offset,
    limit
  }: {
    target_file: string
    offset?: number
    limit?: number
  }) => {
    try {
      const absolutePath = resolveFilePath(target_file)

      const content = await fs.readFile(absolutePath, 'utf-8')

      if (!content) {
        return {
          success: true,
          file: target_file,
          content: 'File is empty.'
        }
      }

      const lines = content.split('\n')

      // 如果指定了范围，返回指定行
      if (offset !== undefined) {
        const startLine = Math.max(0, offset - 1)
        const endLine = limit ? startLine + limit : lines.length
        const selectedLines = lines.slice(startLine, endLine)

        // 格式化输出（带行号）
        const formattedLines = selectedLines.map((line, idx) => {
          const lineNum = (startLine + idx + 1).toString().padStart(6, ' ')
          return `${lineNum}|${line}`
        })

        return {
          success: true,
          file: target_file,
          totalLines: lines.length,
          startLine: offset,
          endLine: Math.min(endLine, lines.length),
          content: formattedLines.join('\n')
        }
      }

      // 返回完整文件（带行号）
      const formattedLines = lines.map((line, idx) => {
        const lineNum = (idx + 1).toString().padStart(6, ' ')
        return `${lineNum}|${line}`
      })

      return {
        success: true,
        file: target_file,
        totalLines: lines.length,
        content: formattedLines.join('\n')
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${target_file}`)
      }
      throw new Error(`Failed to read file: ${error.message}`)
    }
  }
}
