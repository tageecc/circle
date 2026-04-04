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
import { enterPlanModeTool } from '../tools/enter-plan-mode.tool'
import { exitPlanModeTool } from '../tools/exit-plan-mode.tool'
import { taskListTool } from '../tools/task-list.tool'
import { taskGetTool } from '../tools/task-get.tool'
import { taskStopTool } from '../tools/task-stop.tool'
import type { CircleToolSet } from '../types/circle-tool-set'

export function getCoreTools(): CircleToolSet {
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
    ask_user: askUserTool,
    enter_plan_mode: enterPlanModeTool,
    exit_plan_mode: exitPlanModeTool,
    task_list: taskListTool,
    task_get: taskGetTool,
    task_stop: taskStopTool
  }
}
