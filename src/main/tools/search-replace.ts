import { z } from 'zod'
import { promises as fs } from 'fs'
import { resolveFilePath } from './utils'

/**
 * 搜索替换工具
 * 基于 Cursor 的 search_replace 设计
 */
export const searchReplaceTool = {
  description: `Performs exact string replacements in files.

Usage:
- When editing text, ensure you preserve the exact indentation
- ALWAYS prefer editing existing files in the codebase
- The edit will FAIL if old_string is not unique in the file
- Use replace_all for replacing and renaming strings across the file`,

  parameters: z.object({
    file_path: z.string().describe('The path to the file to modify'),
    old_string: z.string().describe('The text to replace'),
    new_string: z.string().describe('The text to replace it with'),
    replace_all: z.boolean().optional().describe('Replace all occurrences')
  }),

  execute: async ({
    file_path,
    old_string,
    new_string,
    replace_all
  }: {
    file_path: string
    old_string: string
    new_string: string
    replace_all?: boolean
  }) => {
    try {
      const absolutePath = resolveFilePath(file_path)

      // 读取文件
      const content = await fs.readFile(absolutePath, 'utf-8')

      // 检查 old_string 是否存在
      if (!content.includes(old_string)) {
        throw new Error(`String not found in file: "${old_string.substring(0, 50)}..."`)
      }

      // 执行替换
      let newContent: string
      let replaceCount: number

      if (replace_all) {
        // 替换所有
        const matches = content.split(old_string).length - 1
        newContent = content.split(old_string).join(new_string)
        replaceCount = matches
      } else {
        // 只替换第一个
        const matches = content.split(old_string).length - 1
        if (matches > 1) {
          throw new Error(
            `String appears ${matches} times in file. Either make it unique by providing more context, or use replace_all=true`
          )
        }
        newContent = content.replace(old_string, new_string)
        replaceCount = 1
      }

      // 写入文件
      await fs.writeFile(absolutePath, newContent, 'utf-8')

      return {
        success: true,
        message: `Replaced ${replaceCount} occurrence(s) in ${file_path}`,
        file: file_path,
        filePath: file_path,
        replaceCount,
        contentBefore: content
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Search and replace failed: ${errorMessage}`)
    }
  }
}
