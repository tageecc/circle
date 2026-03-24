import { z } from 'zod'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Grep 搜索工具
 * 基于 Cursor 的 grep 设计，使用 ripgrep
 */
export const grepTool = {
  description: `A powerful search tool built on ripgrep

Usage:
- Prefer grep for exact symbol/string searches
- Supports full regex syntax
- Results are capped for responsiveness`,

  parameters: z.object({
    pattern: z.string().describe('The regular expression pattern to search for'),
    path: z.string().optional().describe('File or directory to search in'),
    glob: z.string().optional().describe('Glob pattern to filter files'),
    output_mode: z
      .enum(['content', 'files_with_matches', 'count'])
      .optional()
      .describe('Output mode'),
    '-B': z.number().optional().describe('Number of lines to show before each match'),
    '-A': z.number().optional().describe('Number of lines to show after each match'),
    '-C': z.number().optional().describe('Number of lines to show before and after each match'),
    '-i': z.boolean().optional().describe('Case insensitive search'),
    type: z.string().optional().describe('File type to search'),
    head_limit: z.number().optional().describe('Limit output to first N lines/entries'),
    multiline: z.boolean().optional().describe('Enable multiline mode')
  }),

  execute: async (params: {
    pattern: string
    path?: string
    glob?: string
    output_mode?: 'content' | 'files_with_matches' | 'count'
    '-B'?: number
    '-A'?: number
    '-C'?: number
    '-i'?: boolean
    type?: string
    head_limit?: number
    multiline?: boolean
  }) => {
    try {
      const args: string[] = ['rg']

      // 添加模式
      args.push('--regexp', params.pattern)

      // 添加选项
      if (params['-i']) args.push('-i')
      if (params['-B']) args.push(`-B${params['-B']}`)
      if (params['-A']) args.push(`-A${params['-A']}`)
      if (params['-C']) args.push(`-C${params['-C']}`)
      if (params.multiline) args.push('-U', '--multiline-dotall')

      // 输出模式
      if (params.output_mode === 'files_with_matches') args.push('-l')
      else if (params.output_mode === 'count') args.push('-c')
      else args.push('-n') // 默认显示行号

      // 文件类型过滤
      if (params.type) args.push(`--type=${params.type}`)
      if (params.glob) args.push(`--glob=${params.glob}`)

      // 搜索路径
      if (params.path) {
        args.push('--', params.path)
      }

      const command = args.join(' ')
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      })

      let output = stdout.trim()

      // 限制输出行数
      if (params.head_limit) {
        const lines = output.split('\n')
        output = lines.slice(0, params.head_limit).join('\n')
        if (lines.length > params.head_limit) {
          output += `\n... (truncated ${lines.length - params.head_limit} more lines)`
        }
      }

      return {
        success: true,
        pattern: params.pattern,
        output,
        matchCount: output.split('\n').length
      }
    } catch (error: any) {
      if (error.code === 1) {
        // ripgrep 返回 1 表示没有匹配
        return {
          success: true,
          pattern: params.pattern,
          output: 'No matches found',
          matchCount: 0
        }
      }
      throw new Error(`Grep failed: ${error.message}`)
    }
  }
}
