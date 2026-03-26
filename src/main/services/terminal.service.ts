import * as pty from 'node-pty'
import * as os from 'os'
import { sendToRenderer } from '../utils/ipc'

interface Terminal {
  id: string
  ptyProcess: pty.IPty
  cwd: string
  outputBuffer: string // 输出缓冲区，用于 AI 查询
  onData?: (data: string) => void
  onExit?: (exitCode: number, signal?: number) => void
}

export interface TerminalCallbacks {
  onData?: (data: string) => void
  onExit?: (exitCode: number, signal?: number) => void
}

export class TerminalService {
  private static terminals: Map<string, Terminal> = new Map()
  private static nextTerminalId = 1
  private static readonly MAX_OUTPUT_BUFFER = 50000 // 最大缓冲 50KB

  static createTerminal(cwd: string, callbacks?: TerminalCallbacks): string {
    const terminalId = `terminal-${this.nextTerminalId++}`

    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash')

    const resolvedCwd = cwd || os.homedir()

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: resolvedCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      } as any
    })

    ptyProcess.onData((data) => {
      // 发送到 terminal UI
      sendToRenderer('terminal:data', { terminalId, data })

      // 添加到输出缓冲区（用于 AI 查询）
      const terminal = this.terminals.get(terminalId)
      if (terminal) {
        terminal.outputBuffer += data
        // 限制缓冲区大小（保留最后的内容）
        if (terminal.outputBuffer.length > this.MAX_OUTPUT_BUFFER) {
          terminal.outputBuffer = terminal.outputBuffer.slice(-this.MAX_OUTPUT_BUFFER)
        }
        // 调用回调
        terminal.onData?.(data)
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      sendToRenderer('terminal:exit', { terminalId, exitCode, signal })

      // 调用回调（由调用者决定如何处理）
      const terminal = this.terminals.get(terminalId)
      terminal?.onExit?.(exitCode, signal)

      this.terminals.delete(terminalId)
    })

    this.terminals.set(terminalId, {
      id: terminalId,
      ptyProcess,
      cwd: resolvedCwd,
      outputBuffer: '', // 初始化输出缓冲区
      onData: callbacks?.onData,
      onExit: callbacks?.onExit
    })

    console.log(`✅ Terminal created: ${terminalId} at ${resolvedCwd}`)

    return terminalId
  }

  static write(terminalId: string, data: string): boolean {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      terminal.ptyProcess.write(data)
      return true
    } else {
      console.error(`Terminal not found: ${terminalId}`)
      return false
    }
  }

  static resize(terminalId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      try {
        terminal.ptyProcess.resize(cols, rows)
      } catch (error) {
        console.error(`Failed to resize terminal ${terminalId}:`, error)
      }
    } else {
      console.error(`Terminal not found: ${terminalId}`)
    }
  }

  static kill(terminalId: string): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      try {
        terminal.ptyProcess.kill()
        this.terminals.delete(terminalId)
        console.log(`✅ Terminal killed: ${terminalId}`)
      } catch (error) {
        console.error(`Failed to kill terminal ${terminalId}:`, error)
      }
    } else {
      console.error(`Terminal not found: ${terminalId}`)
    }
  }

  static killAll(): void {
    for (const [terminalId, terminal] of this.terminals.entries()) {
      try {
        terminal.ptyProcess.kill()
        console.log(`✅ Terminal killed: ${terminalId}`)
      } catch (error) {
        console.error(`Failed to kill terminal ${terminalId}:`, error)
      }
    }
    this.terminals.clear()
  }

  static getTerminalCwd(terminalId: string): string | null {
    const terminal = this.terminals.get(terminalId)
    return terminal ? terminal.cwd : null
  }

  static hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId)
  }

  static getTerminalCount(): number {
    return this.terminals.size
  }

  /**
   * 获取终端实例（用于检查是否存在）
   */
  static getTerminal(terminalId: string): Terminal | undefined {
    return this.terminals.get(terminalId)
  }

  /**
   * 获取终端的输出缓冲区
   */
  static getOutput(terminalId: string): string | undefined {
    const terminal = this.terminals.get(terminalId)
    return terminal?.outputBuffer
  }

  /**
   * 获取所有终端（用于 list_terminals 工具）
   */
  static getAllTerminals(): Terminal[] {
    return Array.from(this.terminals.values())
  }
}
