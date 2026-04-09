/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const forceRebuild = process.argv.includes('--force')
const platform = process.platform
const expectedArch = process.env.npm_config_arch || process.arch

/** @returns {void} */
function log(message) {
  console.log(`[native-deps] ${message}`)
}

/** @returns {string} */
function resolvePackageDir(packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`)
  return path.dirname(packageJsonPath)
}

/** @returns {string[]} */
function getArchitectureTokens(targetPlatform, arch) {
  if (targetPlatform === 'darwin') {
    return arch === 'arm64' ? ['arm64'] : arch === 'x64' ? ['x86_64'] : [arch]
  }

  if (targetPlatform === 'linux') {
    return arch === 'arm64' ? ['aarch64', 'arm64'] : arch === 'x64' ? ['x86-64', 'x86_64'] : [arch]
  }

  return [arch]
}

/** @returns {string} */
function describeBinary(filePath) {
  try {
    return execFileSync('file', ['-b', filePath], { encoding: 'utf8' }).trim()
  } catch (error) {
    throw new Error(
      `Unable to inspect binary ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/** @returns {boolean} */
function matchesExpectedArch(description) {
  const normalized = description.toLowerCase()
  return getArchitectureTokens(platform, expectedArch).some((token) =>
    normalized.includes(token.toLowerCase())
  )
}

/** @returns {string | null} */
function safeSqliteVecPath() {
  try {
    const sqliteVec = require('sqlite-vec')
    return sqliteVec.getLoadablePath()
  } catch {
    return null
  }
}

/** @returns {Array<{name: string, path: string}>} */
function getChecks() {
  const checks = [
    {
      name: 'better-sqlite3',
      path: path.join(
        resolvePackageDir('better-sqlite3'),
        'build',
        'Release',
        'better_sqlite3.node'
      )
    },
    {
      name: 'node-pty',
      path: path.join(resolvePackageDir('node-pty'), 'build', 'Release', 'pty.node')
    }
  ]

  const sqliteVecPath = safeSqliteVecPath()
  if (sqliteVecPath) {
    checks.push({
      name: 'sqlite-vec',
      path: sqliteVecPath
    })
  }

  return checks
}

/** @returns {string[]} */
function inspectNativeDeps() {
  const issues = []

  for (const check of getChecks()) {
    if (!fs.existsSync(check.path)) {
      issues.push(`${check.name} is missing (${check.path})`)
      continue
    }

    if (platform !== 'darwin' && platform !== 'linux') {
      continue
    }

    const description = describeBinary(check.path)
    if (!matchesExpectedArch(description)) {
      issues.push(`${check.name} has incompatible architecture: ${description}`)
    }
  }

  return issues
}

/** @returns {void} */
function rebuildNativeDeps() {
  log(`Rebuilding Electron native dependencies for ${platform}/${expectedArch}...`)

  const packageManagerEntrypoint = process.env.npm_execpath
  if (!packageManagerEntrypoint) {
    throw new Error(
      'npm_execpath is not set; run this script through pnpm so native deps can be rebuilt.'
    )
  }

  execFileSync(
    process.execPath,
    [packageManagerEntrypoint, 'exec', 'electron-builder', 'install-app-deps'],
    {
      stdio: 'inherit'
    }
  )
}

/** @returns {void} */
function main() {
  const issues = inspectNativeDeps()

  if (!forceRebuild && issues.length === 0) {
    log(`Native dependencies are ready for ${platform}/${expectedArch}.`)
    return
  }

  if (issues.length > 0) {
    log('Detected native dependency drift:')
    for (const issue of issues) {
      log(`- ${issue}`)
    }
  } else {
    log('Forced native dependency rebuild requested.')
  }

  rebuildNativeDeps()

  const remainingIssues = inspectNativeDeps()
  if (remainingIssues.length > 0) {
    throw new Error(
      `Native dependency rebuild did not fix all issues:\n${remainingIssues
        .map((issue) => `- ${issue}`)
        .join('\n')}`
    )
  }

  log('Native dependencies are now aligned with the current Electron runtime.')
}

main()
