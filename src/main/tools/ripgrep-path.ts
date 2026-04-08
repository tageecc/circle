import { existsSync } from 'fs'
import { rgPath } from '@vscode/ripgrep'
import { preferAsarUnpackedPath } from '../utils/asar-path'

/**
 * Path to the ripgrep binary shipped with @vscode/ripgrep, or a PATH fallback name.
 */
export function resolveRipgrepExecutable(): string {
  const preferredPath = preferAsarUnpackedPath(rgPath)
  if (existsSync(preferredPath)) {
    return preferredPath
  }
  if (existsSync(rgPath)) {
    return rgPath
  }
  return process.platform === 'win32' ? 'rg.exe' : 'rg'
}
