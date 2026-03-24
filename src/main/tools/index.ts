import { codebaseSearchTool } from './codebase-search'
import { runTerminalCmdTool } from './run-terminal-cmd'
import { grepTool } from './grep'
import { deleteFileTool } from './delete-file'
import { readFileTool } from './read-file'
import { writeFileTool } from './write-file'
import { searchReplaceTool } from './search-replace'
import { editFileTool } from './edit-file'
import { listDirTool } from './list-dir'
import { globFileSearchTool } from './glob-file-search'
import { webSearchTool } from './web-search'
import { readLintsTool } from './read-lints'
import { editNotebookTool } from './edit-notebook'
import { updateMemoryTool } from './update-memory'
import { todoWriteTool } from './todo-write'

/**
 * 系统内置工具集合
 * 基于 Cursor Agent 的工具体系设计
 *
 * 工具分类：
 * - 语义搜索：codebase_search
 * - 文件操作：read_file, write, search_replace, delete_file, edit_notebook
 * - 搜索工具：grep, glob_file_search, list_dir, web_search
 * - 诊断工具：read_lints
 * - 终端工具：run_terminal_cmd
 * - 框架工具：update_memory, todo_write (Agent 元能力)
 */

export const SYSTEM_TOOLS = {
  // 语义搜索
  codebase_search: codebaseSearchTool,

  // 文件操作
  read_file: readFileTool,
  write: writeFileTool,
  search_replace: searchReplaceTool,
  edit_file: editFileTool,
  delete_file: deleteFileTool,
  edit_notebook: editNotebookTool,

  // 搜索工具
  grep: grepTool,
  list_dir: listDirTool,
  glob_file_search: globFileSearchTool,
  web_search: webSearchTool,

  // 诊断工具
  read_lints: readLintsTool,

  // 终端工具
  run_terminal_cmd: runTerminalCmdTool,

  // 框架工具（Agent 元能力）
  update_memory: updateMemoryTool,
  todo_write: todoWriteTool
} as const

export type SystemToolName = keyof typeof SYSTEM_TOOLS

/**
 * 获取指定的系统工具
 */
export function getSystemTools(toolNames: string[]): Record<string, any> {
  const tools: Record<string, any> = {}

  for (const name of toolNames) {
    if (name in SYSTEM_TOOLS) {
      tools[name] = SYSTEM_TOOLS[name as SystemToolName]
    }
  }

  return tools
}
