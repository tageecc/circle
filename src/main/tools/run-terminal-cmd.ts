import { z } from 'zod'
import { spawn } from 'child_process'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import { ProjectService } from '../services/project.service'
import { getConfigService } from '../index'

/**
 * 终端命令执行工具
 * 基于 Cursor 和 Trae 的设计
 *
 * 核心特性：
 * 1. 使用 Sentinel 机制判断命令是否完成
 * 2. 维护 Bash Session 状态（环境变量、当前目录）
 * 3. 支持长时间运行的命令（后台执行）
 * 4. 实时捕获 stdout 和 stderr
 *
 * 🔒 安全特性：
 * - 所有命令默认在当前项目目录下执行
 * - 防止误操作其他目录的文件
 */

// Bash Session 管理（单例）
let bashProcess: ReturnType<typeof spawn> | null = null
let currentWorkingDir: string | null = null

/**
 * 危险命令模式列表
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\*/, // rm -rf *
  /rm\s+-rf\s+\.\s/, // rm -rf . (删除当前目录)
  /rm\s+-rf\s+\.$/, // rm -rf . (命令末尾)
  /rm\s+-rf\s+\.\./, // rm -rf ../
  /rm\s+-rf\s+~\//, // rm -rf ~/
  /rm\s+-rf\s+\//, // rm -rf /
  /sudo\s+rm/, // sudo rm
  /chmod\s+-R\s+777/, // chmod -R 777
  /sudo\s+chmod/, // sudo chmod
  />\s*\/dev\/sd/, // > /dev/sda
  /dd\s+if=/ // dd if=
]

/**
 * 检查命令是否危险
 */
function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        dangerous: true,
        reason: `Command matches dangerous pattern: ${pattern.source}`
      }
    }
  }

  return { dangerous: false }
}

/**
 * 获取当前项目目录
 */
function getCurrentProjectDir(): string {
  const configService = getConfigService()
  const projectPath = ProjectService.getCurrentProject(configService)

  if (!projectPath) {
    throw new Error('No project is currently open. Please open a project first.')
  }

  return projectPath
}

/**
 * 获取或创建 Bash Session
 * 🔒 重要：Session 会自动 cd 到当前项目目录
 */
function getBashSession() {
  const projectDir = getCurrentProjectDir()

  // 如果工作目录改变，重启 Session
  if (bashProcess && currentWorkingDir !== projectDir) {
    console.log(
      `🔄 [Bash Session] Working directory changed: ${currentWorkingDir} -> ${projectDir}`
    )
    bashProcess.kill()
    bashProcess = null
  }

  if (!bashProcess || bashProcess.killed) {
    console.log(`🚀 [Bash Session] Creating new session in: ${projectDir}`)

    bashProcess = spawn('/bin/bash', [], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: projectDir // 🔒 关键：设置工作目录
    })

    currentWorkingDir = projectDir

    // 确保进程退出时清理
    bashProcess.on('exit', () => {
      console.log('🛑 [Bash Session] Session terminated')
      bashProcess = null
      currentWorkingDir = null
    })
  }

  return bashProcess
}
export const runTerminalCmdTool = {
  description: `PROPOSE a command to run on behalf of the user.
Note that the user may have to approve the command before it is executed.
The user may reject it if it is not to their liking, or may modify the command before approving it.  If they do change it, take those changes into account.
In using these tools, adhere to the following guidelines:
1. Based on the contents of the conversation, you will be told if you are in the same shell as a previous step or a different shell.
2. If in a new shell, you should cd to the appropriate directory and do necessary setup in addition to running the command. By default, the shell will initialize in the project root.
3. If in the same shell, LOOK IN CHAT HISTORY for your current working directory. The environment also persists (e.g. exported env vars, venv/nvm activations).
4. For ANY commands that would require user interaction, ASSUME THE USER IS NOT AVAILABLE TO INTERACT and PASS THE NON-INTERACTIVE FLAGS (e.g. --yes for npx).
5. For commands that are long running/expected to run indefinitely until interruption, please run them in the background. To run jobs in the background, set is_background to true rather than changing the details of the command.

By default, your commands will run in a sandbox. The sandbox allows most writes to the workspace and reads to the rest of the filesystem. Network access, modifications to git state and modifications to ignored files are disallowed. Reads to git state are allowed. Some other syscalls are also disallowed like access to USB devices. Syscalls that attempt forbidden operations will fail and not all programs will surface these errors in a useful way.
Files that are ignored by .gitignore or .cursorignore are not accessible to the command. If you need to access a file that is ignored, you will need to request "all" permissions to disable sandboxing.
The required_permissions argument is used to request additional permissions. If you know you will need a permission, request it. Requesting permissions will slow down the command execution as it will ask the user for approval. Do not hesitate to request permissions if you are certain you need them.
The following permissions are supported:
- network: Grants broad network access to run a server or contact the internet. Needed for package installs, API calls, hosting servers and fetching dependencies.
- git_write: Allows write access to .git directories. Required if you want to make commits, checkout a branch or otherwise modify any git state. Not required for read-only commands like git status or git log.
- all: Disables the sandbox entirely. If all is requested the command will not run in a sandbox and the sandbox cannot impact the result of the command.
Only request permissions when they are actually needed for the command to succeed. Most file operations, reading, and local builds work fine in the default sandbox.
Make sure to request git_write permissions if you need to make changes to the git repository, including staging, unstaging or committing.
If you think a command failed due to sandbox restrictions, run the command again with the required_permissions argument to request what you need. Don't change the code, just request the permissions.`,

  parameters: z.object({
    command: z.string().describe('The terminal command to execute'),
    is_background: z.boolean().describe('Whether the command should be run in the background'),
    explanation: z
      .string()
      .optional()
      .describe('One sentence explanation as to why this command needs to be run'),
    required_permissions: z
      .array(z.enum(['git_write', 'network', 'all']))
      .optional()
      .describe('Optional list of permissions to request')
  }),

  execute: async ({
    command,
    is_background
  }: {
    command: string
    is_background: boolean
    explanation?: string
    required_permissions?: string[]
  }) => {
    try {
      console.log(`\n🔧 [run_terminal_cmd] Executing: ${command}`)
      console.log(`   Background: ${is_background}`)

      // 🔒 危险命令检测
      const dangerCheck = isDangerousCommand(command)
      if (dangerCheck.dangerous) {
        console.warn(`⚠️  [run_terminal_cmd] DANGEROUS COMMAND DETECTED!`)
        console.warn(`   Reason: ${dangerCheck.reason}`)
        console.warn(`   Command: ${command}`)

        // 返回警告，让 Agent 重新考虑
        return {
          success: false,
          isError: true,
          message: `⚠️ DANGEROUS COMMAND BLOCKED: ${command}\n\nReason: ${dangerCheck.reason}\n\nThis command could cause data loss or system damage. Please:\n1. Verify this is absolutely necessary\n2. Use more specific file paths instead of wildcards\n3. Consider safer alternatives\n\nIf you must proceed, please ask the user for explicit confirmation.`,
          command,
          blocked: true
        }
      }

      // 发送到终端显示（用户可见）
      const window = BrowserWindow.getFocusedWindow()
      if (window) {
        window.webContents.send('terminal:run-command', command)
      }

      // 🔒 获取当前项目目录（安全检查）
      const projectDir = getCurrentProjectDir()
      console.log(`   Working directory: ${projectDir}`)

      if (is_background) {
        // 后台执行（长时间运行的服务，如 dev server）
        const child = spawn(command, {
          shell: true,
          detached: true,
          stdio: 'ignore',
          cwd: projectDir // 🔒 关键：设置工作目录
        })

        child.unref()

        console.log(`✅ [run_terminal_cmd] Background process started (PID: ${child.pid})`)

        return {
          success: true,
          message: `Command started in background: ${command}`,
          pid: child.pid,
          command,
          background: true
        }
      } else {
        // 前台执行 - 使用 Sentinel 机制等待命令完成
        const result = await runBashCommand(command)

        console.log(`✅ [run_terminal_cmd] Command completed (exit code: ${result.exitCode})`)
        console.log(`   Output lines: ${result.stdout.split('\n').length}`)

        return {
          success: result.exitCode === 0,
          message:
            result.exitCode === 0
              ? `Command completed: ${command}`
              : `Command failed with exit code ${result.exitCode}`,
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          background: false,
          exitCode: result.exitCode
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ [run_terminal_cmd] Error: ${errorMessage}`)
      throw new Error(`Command execution failed: ${errorMessage}\nCommand: ${command}`)
    }
  }
}

/**
 * 使用 Sentinel 机制执行 Bash 命令（参考 Trae 的实现）
 */
async function runBashCommand(command: string): Promise<{
  stdout: string
  stderr: string
  exitCode: number
}> {
  const TIMEOUT = 120000 // 120 秒超时
  const CHECK_INTERVAL = 200 // 200ms 检查间隔
  const SENTINEL = ',,,,bash-command-exit-__ERROR_CODE__-banner,,,,'

  // 解析 Sentinel
  const [sentinelBefore] = SENTINEL.split('__ERROR_CODE__')
  const errCodeRetriever = os.platform() === 'win32' ? '!errorlevel!' : '$?'
  const commandSep = os.platform() === 'win32' ? '&' : ';'

  // 获取 Bash Session
  const process = getBashSession()

  if (!process.stdin || !process.stdout || !process.stderr) {
    throw new Error('Bash process stdin/stdout/stderr not available')
  }

  // 构造带 Sentinel 的命令
  const fullCommand = `${command}${commandSep} echo ${SENTINEL.replace('__ERROR_CODE__', errCodeRetriever)}\n`

  // 写入命令
  process.stdin.write(fullCommand)

  // 等待输出并检测 Sentinel
  const startTime = Date.now()
  let stdout = ''
  let stderr = ''
  let exitCode = 0

  // 监听输出
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  const stdoutListener = (data: Buffer) => stdoutChunks.push(data)
  const stderrListener = (data: Buffer) => stderrChunks.push(data)

  process.stdout.on('data', stdoutListener)
  process.stderr.on('data', stderrListener)

  try {
    // 轮询检查输出
    while (true) {
      // 检查超时
      if (Date.now() - startTime > TIMEOUT) {
        throw new Error(`Command timed out after ${TIMEOUT / 1000} seconds`)
      }

      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL))

      // 读取当前输出
      stdout = Buffer.concat(stdoutChunks).toString('utf-8')

      // 检查是否包含 Sentinel
      if (stdout.includes(sentinelBefore)) {
        // 分离实际输出和 Sentinel
        const parts = stdout.split(sentinelBefore)
        stdout = parts[0]

        // 提取退出码
        const exitBanner = parts[1]
        const exitCodeMatch = exitBanner.match(/^(\d+)/)
        if (exitCodeMatch) {
          exitCode = parseInt(exitCodeMatch[1], 10)
          break
        }
      }
    }

    // 读取 stderr
    stderr = Buffer.concat(stderrChunks).toString('utf-8')

    // 移除末尾换行符
    if (stdout.endsWith('\n')) stdout = stdout.slice(0, -1)
    if (stderr.endsWith('\n')) stderr = stderr.slice(0, -1)

    return { stdout, stderr, exitCode }
  } finally {
    // 清理监听器
    process.stdout.removeListener('data', stdoutListener)
    process.stderr.removeListener('data', stderrListener)
  }
}
