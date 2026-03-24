import { z } from 'zod'
import { promises as fs } from 'fs'
import { resolveFilePath } from './utils'

/**
 * 删除文件工具
 * 基于 Cursor 的 delete_file 设计
 */
export const deleteFileTool = {
  description: `Deletes a file at the specified path. The operation will fail gracefully if:
    - The file doesn't exist
    - The operation is rejected for security reasons
    - The file cannot be deleted`,

  parameters: z.object({
    target_file: z.string().describe('The path of the file to delete'),
    explanation: z
      .string()
      .optional()
      .describe('One sentence explanation as to why this tool is being used')
  }),

  execute: async ({ target_file, explanation }: { target_file: string; explanation?: string }) => {
    try {
      const absolutePath = resolveFilePath(target_file)

      // 记录删除原因
      if (explanation) {
        console.log(`Deleting file: ${explanation}`)
      }

      // 检查文件是否存在
      await fs.access(absolutePath)

      // 删除文件
      await fs.unlink(absolutePath)

      return {
        success: true,
        message: `File deleted: ${target_file}`,
        file: target_file
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          message: `File not found: ${target_file}`,
          file: target_file
        }
      }
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }
}
