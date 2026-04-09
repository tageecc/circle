import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const forceRebuild = process.argv.includes('--force')
const platform = process.platform
const expectedArch = process.env.npm_config_arch || process.arch
const packageManagerCommand = platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function log(message) {
  console.log(`[native-deps] ${message}`)
}

function resolvePackageDir(packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`)
  return path.dirname(packageJsonPath)
}

function getArchitectureTokens(targetPlatform, arch) {
  if (targetPlatform === 'darwin') {
    return arch === 'arm64' ? ['arm64'] : arch === 'x64' ? ['x86_64'] : [arch]
  }

  if (targetPlatform === 'linux') {
    return arch === 'arm64' ? ['aarch64', 'arm64'] : arch === 'x64' ? ['x86-64', 'x86_64'] : [arch]
  }

  return [arch]
}

function describeBinary(filePath) {
  try {
    return execFileSync('file', ['-b', filePath], { encoding: 'utf8' }).trim()
  } catch (error) {
    throw new Error(
      `Unable to inspect binary ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function matchesExpectedArch(description) {
  const normalized = description.toLowerCase()
  return getArchitectureTokens(platform, expectedArch).some((token) =>
    normalized.includes(token.toLowerCase())
  )
}

function safeSqliteVecPath() {
  try {
    const sqliteVec = require('sqlite-vec')
    return sqliteVec.getLoadablePath()
  } catch {
    return null
  }
}

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

function rebuildNativeDeps() {
  log(`Rebuilding Electron native dependencies for ${platform}/${expectedArch}...`)
  execFileSync(packageManagerCommand, ['exec', 'electron-builder', 'install-app-deps'], {
    stdio: 'inherit'
  })
}

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
