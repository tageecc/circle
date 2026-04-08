import test from 'node:test'
import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as nodePath from 'node:path'
import * as fs from 'node:fs/promises'
import {
  matchesProjectFilePattern,
  scoreQuickOpenCandidate,
  walkProjectFiles
} from './project-files'

async function createTempProject(): Promise<string> {
  return fs.mkdtemp(nodePath.join(os.tmpdir(), 'circle-project-files-'))
}

async function collectRelativePaths(
  projectPath: string,
  options?: Parameters<typeof walkProjectFiles>[1]
): Promise<string[]> {
  const files: string[] = []
  for await (const entry of walkProjectFiles(projectPath, options)) {
    files.push(entry.relativePath)
  }
  return files
}

test('walkProjectFiles includes dotfiles unless explicitly ignored', async (t) => {
  const projectPath = await createTempProject()

  await fs.mkdir(nodePath.join(projectPath, '.github', 'workflows'), { recursive: true })
  await fs.mkdir(nodePath.join(projectPath, '.git'), { recursive: true })
  await fs.mkdir(nodePath.join(projectPath, 'src'), { recursive: true })
  await fs.writeFile(nodePath.join(projectPath, '.env'), 'FOO=bar')
  await fs.writeFile(nodePath.join(projectPath, '.github', 'workflows', 'ci.yml'), 'name: ci')
  await fs.writeFile(nodePath.join(projectPath, '.git', 'config'), '[core]')
  await fs.writeFile(nodePath.join(projectPath, 'src', 'index.ts'), 'export {}')

  t.after(async () => {
    await fs.rm(projectPath, { recursive: true, force: true })
  })

  const files = await collectRelativePaths(projectPath, {
    ignoreDirs: ['.git']
  })

  assert.deepEqual(files, ['.env', '.github/workflows/ci.yml', 'src/index.ts'])
})

test('walkProjectFiles honors glob include/exclude rules for hidden paths', async (t) => {
  const projectPath = await createTempProject()

  await fs.mkdir(nodePath.join(projectPath, '.github', 'workflows'), { recursive: true })
  await fs.mkdir(nodePath.join(projectPath, 'src'), { recursive: true })
  await fs.writeFile(nodePath.join(projectPath, 'src', 'app.ts'), 'export const app = true')
  await fs.writeFile(nodePath.join(projectPath, 'src', 'app.test.ts'), 'export const test = true')
  await fs.writeFile(nodePath.join(projectPath, '.github', 'workflows', 'ci.yml'), 'name: ci')
  await fs.writeFile(nodePath.join(projectPath, '.env'), 'FOO=bar')

  t.after(async () => {
    await fs.rm(projectPath, { recursive: true, force: true })
  })

  const files = await collectRelativePaths(projectPath, {
    includePatterns: ['*.ts', '.github/**'],
    excludePatterns: ['**/*.test.ts']
  })

  assert.deepEqual(files, ['.github/workflows/ci.yml', 'src/app.ts'])
})

test('pattern matching supports hidden paths and legacy plain-text filters', () => {
  assert.equal(matchesProjectFilePattern('.github/workflows/ci.yml', '.github/**'), true)
  assert.equal(matchesProjectFilePattern('src/config/app.ts', 'config'), true)
  assert.equal(matchesProjectFilePattern('.env', '*.ts'), false)
})

test('quick open scoring prefers exact basename matches', () => {
  const exact = scoreQuickOpenCandidate('.env', '.env')
  const partial = scoreQuickOpenCandidate('config/.env.example', '.env')

  assert.ok(exact !== null)
  assert.ok(partial !== null)
  assert.ok(exact! > partial!)
})
