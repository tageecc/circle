import * as fs from 'fs/promises'
import type { Dirent } from 'fs'
import * as nodePath from 'path'
import { minimatch } from 'minimatch'

export interface ProjectFileEntry {
  fullPath: string
  relativePath: string
  name: string
  extension: string
}

export interface ProjectFileWalkOptions {
  ignoreDirs?: Iterable<string>
  ignoreExtensions?: Iterable<string>
  includePatterns?: string[]
  excludePatterns?: string[]
  supportedExtensions?: Iterable<string>
  supportedFileNames?: Iterable<string>
  maxFileSizeBytes?: number
}

const GLOB_MAGIC_RE = /[*?[\]{}()!+@]/

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(nodePath.sep).join('/')
}

export function parsePatternList(input?: string): string[] {
  return (
    input
      ?.split(',')
      .map((pattern) => pattern.trim())
      .filter(Boolean) ?? []
  )
}

export function matchesProjectFilePattern(relativePath: string, pattern: string): boolean {
  const normalizedPath = normalizeRelativePath(relativePath)
  const normalizedPattern = normalizeRelativePath(pattern.trim().replace(/^\.\//, ''))

  if (!normalizedPattern) return true

  if (
    minimatch(normalizedPath, normalizedPattern, {
      dot: true,
      nocase: process.platform === 'win32',
      matchBase: !normalizedPattern.includes('/')
    })
  ) {
    return true
  }

  // Keep compatibility with simple plain-text filters such as "src" or "config".
  if (!GLOB_MAGIC_RE.test(normalizedPattern)) {
    const haystack = process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
    const needle =
      process.platform === 'win32' ? normalizedPattern.toLowerCase() : normalizedPattern
    return haystack.includes(needle)
  }

  return false
}

export function matchesAnyProjectFilePattern(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesProjectFilePattern(relativePath, pattern))
}

export async function* walkProjectFiles(
  projectPath: string,
  options: ProjectFileWalkOptions = {}
): AsyncGenerator<ProjectFileEntry> {
  const ignoreDirs = new Set(Array.from(options.ignoreDirs ?? []))
  const ignoreExtensions = new Set(
    Array.from(options.ignoreExtensions ?? [], (ext) => ext.toLowerCase())
  )
  const includePatterns = options.includePatterns ?? []
  const excludePatterns = options.excludePatterns ?? []
  const supportedExtensions = options.supportedExtensions
    ? new Set(Array.from(options.supportedExtensions, (ext) => ext.toLowerCase()))
    : null
  const supportedFileNames = options.supportedFileNames
    ? new Set(
        Array.from(options.supportedFileNames, (fileName) =>
          process.platform === 'win32' ? fileName.toLowerCase() : fileName
        )
      )
    : null

  async function* walk(currentPath: string): AsyncGenerator<ProjectFileEntry> {
    let entries: Dirent[]

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const fullPath = nodePath.join(currentPath, entry.name)
      const relativePath = normalizeRelativePath(nodePath.relative(projectPath, fullPath))

      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) {
          continue
        }
        yield* walk(fullPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const extension = nodePath.extname(entry.name).toLowerCase()
      if (ignoreExtensions.has(extension)) {
        continue
      }

      if (supportedExtensions && !supportedExtensions.has(extension)) {
        const normalizedName = process.platform === 'win32' ? entry.name.toLowerCase() : entry.name
        if (!supportedFileNames?.has(normalizedName)) {
          continue
        }
      }

      if (typeof options.maxFileSizeBytes === 'number') {
        try {
          const stats = await fs.stat(fullPath)
          if (stats.size > options.maxFileSizeBytes) {
            continue
          }
        } catch {
          continue
        }
      }

      if (
        includePatterns.length > 0 &&
        !matchesAnyProjectFilePattern(relativePath, includePatterns)
      ) {
        continue
      }

      if (
        excludePatterns.length > 0 &&
        matchesAnyProjectFilePattern(relativePath, excludePatterns)
      ) {
        continue
      }

      yield {
        fullPath,
        relativePath,
        name: entry.name,
        extension
      }
    }
  }

  yield* walk(projectPath)
}

function scoreSubsequence(target: string, query: string): number {
  let score = 0
  let searchFrom = 0
  let previousIndex = -1

  for (const char of query) {
    const index = target.indexOf(char, searchFrom)
    if (index === -1) {
      return -1
    }

    score += 5

    if (index === 0 || '/._-'.includes(target[index - 1] || '')) {
      score += 8
    }

    if (index === previousIndex + 1) {
      score += 6
    }

    score -= Math.max(0, index - searchFrom)
    previousIndex = index
    searchFrom = index + 1
  }

  score -= Math.max(0, target.length - query.length) * 0.05
  return score
}

export function scoreQuickOpenCandidate(relativePath: string, query: string): number | null {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return null
  }

  const normalizedPath = normalizeRelativePath(relativePath).toLowerCase()
  const fileName = normalizedPath.split('/').pop() || normalizedPath

  const fileNameIndex = fileName.indexOf(normalizedQuery)
  const pathIndex = normalizedPath.indexOf(normalizedQuery)
  const fuzzyFileName = scoreSubsequence(fileName, normalizedQuery)
  const fuzzyPath = scoreSubsequence(normalizedPath, normalizedQuery)

  if (fileNameIndex === -1 && pathIndex === -1 && fuzzyFileName < 0 && fuzzyPath < 0) {
    return null
  }

  let score = 0

  if (fileName === normalizedQuery) score += 1000
  if (normalizedPath === normalizedQuery) score += 900
  if (fileName.startsWith(normalizedQuery)) score += 700
  if (pathIndex === 0) score += 400

  if (fileNameIndex !== -1) {
    score += 300 - fileNameIndex * 12
  }

  if (pathIndex !== -1) {
    score += 140 - pathIndex * 2
  }

  if (fuzzyFileName > 0) {
    score += fuzzyFileName * 2
  }

  if (fuzzyPath > 0) {
    score += fuzzyPath
  }

  score -= normalizedPath.length * 0.1
  return score
}
