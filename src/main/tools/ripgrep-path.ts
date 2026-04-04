import { existsSync } from 'fs'
import { rgPath } from '@vscode/ripgrep'

/**
 * Path to the ripgrep binary shipped with @vscode/ripgrep, or a PATH fallback name.
 */
export function resolveRipgrepExecutable(): string {
  if (existsSync(rgPath)) {
    return rgPath
  }
  return process.platform === 'win32' ? 'rg.exe' : 'rg'
}
