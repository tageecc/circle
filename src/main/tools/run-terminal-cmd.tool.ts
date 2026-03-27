import { tool, type ToolCallOptions } from 'ai'
import { z } from 'zod'
import { spawn } from 'child_process'
import { getCurrentProjectDir } from './utils'
import { getToolContext } from '../services/tool-context'
import { getConfigService } from '../index'
import { sendToRenderer } from '../utils/ipc'
import { SessionService } from '../services/session.service'
import { mainI18n as i18n } from '../i18n'

// 常量
const DEFAULT_SHELL = '/bin/bash'

// 类型定义
type UserDecision = 'approve' | 'reject' | 'skip'

interface CommandResult {
  success: boolean
  command: string
  stdout?: string
  stderr?: string
  exitCode?: number
  message?: string
  terminalId?: string
  streaming?: boolean
  rejected?: boolean
  skipped?: boolean
}

// 审批管理
const pendingApprovals = new Map<
  string,
  {
    resolve: (decision: UserDecision) => void
  }
>()

function needsApproval(command: string): boolean {
  const preferences = getConfigService().getPreferences()
  const autoRunMode = preferences.autoRunMode || 'ask'
  const whitelist = preferences.commandWhitelist || []

  if (autoRunMode === 'auto-run') return false
  if (autoRunMode === 'ask') return true

  // 提取命令名（处理 sudo、环境变量等）
  const cmdName = command
    .trim()
    .replace(/^(sudo\s+)?(\w+=\w+\s+)*/, '')
    .split(/\s+/)[0]

  // 精确匹配或前缀匹配（带 * 后缀，如 "git*"）
  return !whitelist.some((w) => {
    if (w.endsWith('*')) {
      return cmdName.startsWith(w.slice(0, -1))
    }
    return cmdName === w
  })
}

async function requestApproval(
  assistantMessageId: number,
  toolCallId: string,
  command: string,
  is_background: boolean
): Promise<UserDecision> {
  console.log('[requestApproval] 📤 Preparing approval request:', {
    assistantMessageId,
    toolCallId,
    command: command.substring(0, 50),
    is_background
  })

  // ⚠️ 关键：延迟发送，确保前端已经收到 tool-call stream part 并创建了 tool part
  // AI SDK 会先发送 tool-call，然后工具才执行，但 IPC 可能比 WebSocket 更快
  await new Promise((resolve) => setTimeout(resolve, 100))

  // ✅ 持久化审批状态到数据库（直接使用 messageId，无需查询）
  // 关键：确保隐藏/刷新页面后，审批按钮不丢失
  const sessionService = new SessionService()
  await sessionService.updateToolApprovalStatus(assistantMessageId, toolCallId, {
    needsApproval: true,
    approvalStatus: 'pending',
    state: 'pending'
  })

  const sent = sendToRenderer('tool:approval-required', {
    toolCallId,
    command,
    is_background
  })

  console.log('[requestApproval] 📡 IPC sent:', sent)

  return new Promise((resolve) => {
    pendingApprovals.set(toolCallId, { resolve })
    console.log('[requestApproval] ⏳ Waiting for user decision...')
  })
}

export function handleApprovalDecision(toolCallId: string, decision: UserDecision): void {
  console.log('[handleApprovalDecision] 📥 Received decision:', { toolCallId, decision })

  const pending = pendingApprovals.get(toolCallId)

  if (pending) {
    console.log('[handleApprovalDecision] ✅ Resolving pending approval')
    pending.resolve(decision)
    pendingApprovals.delete(toolCallId)
  } else {
    console.warn(
      `[handleApprovalDecision] ❌ Decision received for unknown approval: ${toolCallId}`
    )
    console.warn(
      '[handleApprovalDecision] Current pending approvals:',
      Array.from(pendingApprovals.keys())
    )
  }
}

// Tool schema
const inputSchema = z.object({
  command: z.string().describe('The terminal command to execute'),
  is_background: z.boolean()
    .describe(`Whether the command should be run in the background (creates a persistent terminal tab).

### Core Decision Criteria

Ask yourself: **"Will this command finish on its own, or does it run indefinitely until stopped?"**

- **Runs indefinitely** → TRUE (background)
- **Finishes on its own** → FALSE (inline)

### Set to TRUE for:

**Development Servers** (listen on ports indefinitely)
- npm run dev, npm start, yarn dev
- python -m http.server, flask run
- python manage.py runserver
- rails server, php artisan serve

**Watch Mode** (continuously monitor files)
- webpack --watch, tsc --watch
- nodemon, ts-node-dev
- npm run watch, jest --watch

**Long-Running Services** (background processes)
- pm2 start, forever start
- docker compose up
- tail -f logfile.log

**Interactive Processes** (require user input)
- npm init, yarn create
- python (REPL), node (REPL)
- Any command with interactive prompts

### Set to FALSE for:

**Package Management** (install then exit)
- npm install, yarn install, pnpm install
- pip install, gem install, cargo install
- npm ci, yarn --frozen-lockfile

**Build Commands** (compile then exit)
- npm run build, yarn build
- tsc, webpack
- cargo build, go build

**Git Operations** (quick actions)
- git status, git add, git commit, git push
- git log, git diff, git branch
- Any git command (all complete immediately)

**File Operations** (instant completion)
- ls, cat, mkdir, rm, cp, mv
- touch, echo, find
- chmod, chown

**Quick Utilities** (read-only or fast writes)
- grep, sed, awk
- curl, wget (unless --continue)
- ps, kill, top (unless continuous)

### Edge Cases

<example>
  Command: npm test
  Decision: FALSE
  <reasoning>
    Runs tests once and exits with pass/fail, even though it might take time
  </reasoning>
</example>

<example>
  Command: npm test -- --watch
  Decision: TRUE
  <reasoning>
    Watch flag makes it run continuously, monitoring for file changes
  </reasoning>
</example>

<example>
  Command: docker build -t myapp .
  Decision: FALSE
  <reasoning>
    Builds image then exits, even though it takes minutes
  </reasoning>
</example>

<example>
  Command: docker compose up
  Decision: TRUE
  <reasoning>
    Runs containers indefinitely until stopped, streams logs continuously
  </reasoning>
</example>

<example>
  Command: curl https://api.example.com
  Decision: FALSE
  <reasoning>
    Makes one request and exits immediately with response
  </reasoning>
</example>

### Key Indicators

**Background (TRUE) usually has**:
- Server/port listening (localhost:3000)
- File watching (--watch flag)
- Continuous output streams
- Requires Ctrl+C to stop
- Process name: nodemon, pm2, dev server

**Inline (FALSE) usually has**:
- Clear completion point
- Exits with status code
- One-time operations
- Progress bars that finish
- Commands with --version, --help flags

### When Uncertain

If unsure, prefer FALSE (inline) unless you see clear signs of:
- Port binding (server)
- Watch mode (file monitoring)
- Infinite loop (daemon process)

The system will show output either way, but background creates a persistent terminal tab while inline completes in the chat.`)
})

// Tool definition
export const runTerminalCmdTool = tool({
  description: `PROPOSE a command to run on behalf of the user.
Note that the user may have to approve the command before it is executed.
The user may reject it if it is not to their liking, or may modify the command before approving it.  If they do change it, take those changes into account.
In using these tools, adhere to the following guidelines:
1. Based on the contents of the conversation, you will be told if you are in the same shell as a previous step or a different shell.
2. If in a new shell, you should cd to the appropriate directory and do necessary setup in addition to running the command. By default, the shell will initialize in the project root.
3. If in the same shell, LOOK IN CHAT HISTORY for your current working directory. The environment also persists (e.g. exported env vars, venv/nvm activations).
4. For ANY commands that would require user interaction, ASSUME THE USER IS NOT AVAILABLE TO INTERACT and PASS THE NON-INTERACTIVE FLAGS (e.g. --yes for npx).
5. For commands that are long running/expected to run indefinitely until interruption, please run them in the background. To run jobs in the background, set is_background to true rather than changing the details of the command.`,
  inputSchema,
  execute: async ({ command, is_background }, options: ToolCallOptions) => {
    const context = getToolContext(options)
    const workspaceRoot = context.workspaceRoot || getCurrentProjectDir()
    const toolCallId = options.toolCallId || `run_terminal_cmd_${Date.now()}`

    if (needsApproval(command)) {
      console.log('[run_terminal_cmd] 🔍 Command needs approval:', command)

      const decision = await requestApproval(
        context.assistantMessageId,
        toolCallId,
        command,
        is_background
      )

      if (decision === 'reject') {
        return JSON.stringify({
          success: false,
          command,
          message: i18n.t('main.terminal.user_rejected_command'),
          exitCode: 1,
          rejected: true
        })
      }

      if (decision === 'skip') {
        return JSON.stringify({
          success: true,
          command,
          message: i18n.t('main.terminal.user_skipped_command'),
          skipped: true
        })
      }
    }

    return executeCommand(command, toolCallId, workspaceRoot, is_background, context.abortSignal)
  }
})

// 统一的命令执行（支持后台 terminal tab 和同步流式输出）
async function executeCommand(
  command: string,
  toolCallId: string,
  workspaceRoot: string,
  createTerminalTab: boolean,
  abortSignal?: AbortSignal
): Promise<string> {
  try {
    return createTerminalTab
      ? await executeInTerminal(command, toolCallId, workspaceRoot, abortSignal)
      : await executeInline(command, toolCallId, workspaceRoot, abortSignal)
  } catch (error) {
    return JSON.stringify({
      success: false,
      command,
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1
    })
  }
}

// 在 terminal tab 中执行命令（后台任务）
async function executeInTerminal(
  command: string,
  toolCallId: string,
  workspaceRoot: string,
  abortSignal?: AbortSignal
): Promise<string> {
  const terminalId = `terminal-${Date.now()}`

  sendToRenderer('tool:terminal-created', { toolCallId, terminalId, command })
  sendToRenderer('tool:streaming-started', { toolCallId, command })

  return spawnCommand({
    command,
    toolCallId,
    workspaceRoot,
    onOutput: (output, isError) => {
      // 发送给 Terminal Tab（xterm.js 需要 \r\n）
      sendToRenderer('terminal:data', { terminalId, data: output.replace(/\n/g, '\r\n') })
      // 发送给对话流
      sendToRenderer('tool:output-stream', { toolCallId, terminalId, output, isError })
    },
    onComplete: (exitCode) => {
      sendToRenderer('terminal:exit', { terminalId, exitCode, signal: null })
    },
    buildResult: (stdout, stderr, exitCode) => ({
      success: exitCode === 0,
      command,
      terminalId,
      stdout,
      stderr,
      exitCode,
      streaming: true,
      message: stdout.substring(0, 2000).trim()
        ? i18n.t('main.terminal.ran_in_terminal_with_output', {
            terminalId,
            output: stdout.substring(0, 2000).trim()
          })
        : i18n.t('main.terminal.ran_in_terminal_background', { terminalId })
    }),
    abortSignal
  })
}

// 内联执行命令（同步任务）
async function executeInline(
  command: string,
  toolCallId: string,
  workspaceRoot: string,
  abortSignal?: AbortSignal
): Promise<string> {
  sendToRenderer('tool:streaming-started', { toolCallId, command })

  return spawnCommand({
    command,
    toolCallId,
    workspaceRoot,
    onOutput: (output, isError) => {
      sendToRenderer('tool:output-stream', { toolCallId, output, isError })
    },
    buildResult: (stdout, stderr, exitCode) => ({
      success: exitCode === 0,
      command,
      stdout,
      stderr,
      exitCode,
      streaming: true
    }),
    abortSignal
  })
}

// 统一的 spawn 执行逻辑
interface SpawnOptions {
  command: string
  toolCallId: string
  workspaceRoot: string
  onOutput: (output: string, isError: boolean) => void
  onComplete?: (exitCode: number) => void
  buildResult: (stdout: string, stderr: string, exitCode: number) => CommandResult
  abortSignal?: AbortSignal
}

async function spawnCommand(options: SpawnOptions): Promise<string> {
  const { command, toolCallId, workspaceRoot, onOutput, onComplete, buildResult, abortSignal } = options

  return new Promise((resolve) => {
    const shell = process.env.SHELL || DEFAULT_SHELL
    const proc = spawn(shell, ['-c', command], {
      cwd: workspaceRoot,
      env: process.env
    })

    let stdout = ''
    let stderr = ''
    let resolved = false
    let killTimeout: NodeJS.Timeout | null = null

    const handleOutput = (data: Buffer, isError: boolean) => {
      const output = data.toString()
      isError ? (stderr += output) : (stdout += output)
      onOutput(output, isError)
    }

    const resolveOnce = (result: CommandResult) => {
      if (resolved) return
      resolved = true
      
      if (killTimeout) {
        clearTimeout(killTimeout)
        killTimeout = null
      }
      
      sendToRenderer('tool:output-complete', { toolCallId, exitCode: result.exitCode || 0 })
      resolve(JSON.stringify(result))
    }

    // 监听 abort 信号
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        if (!resolved) {
          console.log(`[run_terminal_cmd] ⏹️  Killing process for: ${command}`)
          proc.kill('SIGTERM') // 先尝试优雅停止
          
          killTimeout = setTimeout(() => {
            if (!resolved) {
              proc.kill('SIGKILL') // 500ms 后强制停止
            }
          }, 500)
          
          resolveOnce({
            success: false,
            command,
            stderr: i18n.t('main.terminal.command_aborted_by_user'),
            exitCode: 130 // SIGTERM 的标准退出码
          })
        }
      })
    }

    proc.stdout?.on('data', (data) => handleOutput(data, false))
    proc.stderr?.on('data', (data) => handleOutput(data, true))

    proc.on('error', (error) => {
      resolveOnce({
        success: false,
        command,
        stderr: error.message,
        exitCode: 1
      })
    })

    proc.on('close', (exitCode) => {
      onComplete?.(exitCode || 0)
      resolveOnce(buildResult(stdout, stderr, exitCode || 0))
    })
  })
}
