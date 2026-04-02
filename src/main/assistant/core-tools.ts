/**
 * Core built-in tools (no MCP, no delegate_task) — shared for main agent & sub-agent composition.
 */

import { readFileTool } from '../tools/read-file.tool'
import { editFileTool } from '../tools/edit-file.tool'
import { listDirTool } from '../tools/list-dir.tool'
import { globFileSearchTool } from '../tools/glob-file-search.tool'
import { grepTool } from '../tools/grep.tool'
import { codebaseSearchTool } from '../tools/codebase-search.tool'
import { deleteFileTool } from '../tools/delete-file.tool'
import { readLintsTool } from '../tools/read-lints.tool'
import { runTerminalCmdTool } from '../tools/run-terminal-cmd.tool'
import { updateMemoryTool } from '../tools/update-memory.tool'
import { todoWriteTool } from '../tools/todo-write.tool'
import { getSkillDetailsTool } from '../tools/get-skill-details.tool'
import { askUserTool } from '../tools/ask-user.tool'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCoreTools(): Record<string, any> {
  return {
    read_file: readFileTool,
    edit_file: editFileTool,
    delete_file: deleteFileTool,
    list_dir: listDirTool,
    glob_file_search: globFileSearchTool,
    grep: grepTool,
    codebase_search: codebaseSearchTool,
    run_terminal_cmd: runTerminalCmdTool,
    read_lints: readLintsTool,
    update_memory: updateMemoryTool,
    todo_write: todoWriteTool,
    get_skill_details: getSkillDetailsTool,
    ask_user: askUserTool
  }
}
