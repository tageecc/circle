import { existsSync } from 'fs'

const ASAR_SEGMENT_RE = /([/\\])app\.asar([/\\]|$)/

export function toAsarUnpackedPath(targetPath: string): string {
  return targetPath.replace(ASAR_SEGMENT_RE, '$1app.asar.unpacked$2')
}

export function preferAsarUnpackedPath(targetPath: string): string {
  const unpackedPath = toAsarUnpackedPath(targetPath)
  if (unpackedPath !== targetPath && existsSync(unpackedPath)) {
    return unpackedPath
  }
  return targetPath
}
