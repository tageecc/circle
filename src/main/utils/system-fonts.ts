import { exec, execFile } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { promisify } from 'util'
import * as fontList from 'font-list'
import { preferAsarUnpackedPath } from './asar-path'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)
const MAX_BUFFER_BYTES = 1024 * 1024 * 10

function resolveFontListModuleDir(): string {
  return path.dirname(preferAsarUnpackedPath(require.resolve('font-list')))
}

function resolveDarwinFontListBinary(): string | null {
  const binaryPath = path.join(resolveFontListModuleDir(), 'libs', 'darwin', 'fontlist')
  return existsSync(binaryPath) ? binaryPath : null
}

async function getDarwinFontsFromBinary(): Promise<string[]> {
  const binaryPath = resolveDarwinFontListBinary()
  if (!binaryPath) {
    throw new Error('font-list binary not found')
  }

  const { stdout } = await execFileAsync(binaryPath, { maxBuffer: MAX_BUFFER_BYTES })
  return stdout
    .split('\n')
    .map((font) => font.trim())
    .filter(Boolean)
}

async function getDarwinFontsFromSystemProfiler(): Promise<string[]> {
  const command = `system_profiler SPFontsDataType | grep "Family:" | awk -F: '{print $2}' | sort | uniq`
  const { stdout } = await execAsync(command, { maxBuffer: MAX_BUFFER_BYTES })
  return stdout
    .split('\n')
    .map((font) => font.trim())
    .filter(Boolean)
}

export async function getSystemFonts(): Promise<string[]> {
  if (process.platform !== 'darwin') {
    return fontList.getFonts({ disableQuoting: true })
  }

  try {
    return await getDarwinFontsFromBinary()
  } catch (binaryError) {
    console.warn('[Fonts] Failed to execute bundled font-list binary, falling back:', binaryError)
  }

  try {
    return await getDarwinFontsFromSystemProfiler()
  } catch (systemProfilerError) {
    console.warn('[Fonts] Failed to query system_profiler, falling back:', systemProfilerError)
  }

  return fontList.getFonts({ disableQuoting: true })
}
