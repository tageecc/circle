import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { resolveFilePath } from './utils'

/**
 * 写入文件工具
 * 基于 Cursor 的 write 设计
 */
export const writeFileTool = {
  description: `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path
- If this is an existing file, you MUST use the read_file tool first
- ALWAYS prefer editing existing files in the codebase
- NEVER write new files unless explicitly required`,

  parameters: z.object({
    file_path: z.string().describe('The path to the file to modify'),
    contents: z.string().describe('The contents of the file to write')
  }),

  execute: async ({ file_path, contents }: { file_path: string; contents: string }) => {
    try {
      const absolutePath = resolveFilePath(file_path)

      let hadExistingFile = false
      let previousContent: string | undefined
      try {
        previousContent = await fs.readFile(absolutePath, 'utf-8')
        hadExistingFile = true
      } catch {
        previousContent = undefined
      }

      // 确保目录存在
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })

      // 写入文件
      await fs.writeFile(absolutePath, contents, 'utf-8')

      const lines = contents.split('\n').length

      return {
        success: true,
        message: `File written: ${file_path}`,
        file: file_path,
        lines,
        bytes: Buffer.byteLength(contents, 'utf-8'),
        hadExistingFile,
        previousContent: hadExistingFile ? previousContent : undefined
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
