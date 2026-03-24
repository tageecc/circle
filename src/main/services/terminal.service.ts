import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import { getConfigService } from '../index'

interface Terminal {
  id: string
  ptyProcess: pty.IPty
  cwd: string
}

export class TerminalService {
  private static terminals: Map<string, Terminal> = new Map()
  private static nextTerminalId = 1

  static createTerminal(cwd: string, window: BrowserWindow): string {
    const terminalId = `terminal-${this.nextTerminalId++}`

    const shell =
      getConfigService().getConfig().terminalSettings?.shell?.trim() ||
      (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash')

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
      window.webContents.send('terminal:data', { terminalId, data })
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      window.webContents.send('terminal:exit', { terminalId, exitCode, signal })
      this.terminals.delete(terminalId)
    })

    this.terminals.set(terminalId, {
      id: terminalId,
      ptyProcess,
      cwd: resolvedCwd
    })

    console.log(`✅ Terminal created: ${terminalId} at ${resolvedCwd}`)

    return terminalId
  }

  static write(terminalId: string, data: string): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      terminal.ptyProcess.write(data)
    } else {
      console.error(`Terminal not found: ${terminalId}`)
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
}
