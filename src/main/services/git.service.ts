import * as path from 'path'
import * as fs from 'fs'
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git'

const gitOptions: Partial<SimpleGitOptions> = {
  binary: 'git',
  maxConcurrentProcesses: 6,
  trimmed: true
}

function getGit(projectPath: string): SimpleGit {
  return simpleGit({ ...gitOptions, baseDir: projectPath })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatGitError(error: unknown, operation: string): Error {
  const message = getErrorMessage(error)
  if (message.includes('index.lock'))
    return new Error(`Git 操作冲突：有其他 Git 操作正在进行中，请稍后再试`)
  if (message.includes('not a git repository')) return new Error('当前目录不是 Git 仓库')
  if (message.includes('nothing to commit')) return new Error('没有可提交的更改')
  if (message.includes('No local changes to save')) return new Error('没有可暂存的更改')
  return new Error(`${operation}失败: ${message}`)
}

async function execGit<T>(
  projectPath: string,
  operation: string,
  fn: (git: SimpleGit) => Promise<T>
): Promise<T> {
  try {
    return await fn(getGit(projectPath))
  } catch (error) {
    throw formatGitError(error, operation)
  }
}

export interface GitBranch {
  name: string
  current: boolean
  remote: boolean
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  deleted: string[]
  untracked: string[]
  conflicted: string[]
}

export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
  parents: string[]
  refs?: string[] // 分支/tag 引用，如 "HEAD -> main, origin/main"
}

export interface GitCommitFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

export interface GitCommitDetail extends GitCommit {
  body: string
  files: GitCommitFile[]
  stats: {
    additions: number
    deletions: number
    filesChanged: number
  }
}

export interface GitBlameLine {
  line: number
  commit: string
  author: string
  authorMail: string
  authorTime: number
  authorTz: string
  committer: string
  committerMail: string
  committerTime: number
  committerTz: string
  summary: string
  previous?: string
  filename: string
}

export interface GitBlameInfo {
  lines: GitBlameLine[]
}

export interface GitStashEntry {
  index: number
  branch: string
  message: string
  date: string
  hash: string
}

export class GitService {
  /**
   * 克隆 Git 仓库
   */
  static async cloneRepository(
    repoUrl: string,
    targetPath: string,
    onProgress?: (message: string) => void
  ): Promise<string> {
    if (fs.existsSync(targetPath)) throw new Error(`Target directory already exists: ${targetPath}`)
    onProgress?.('正在克隆仓库...')
    await execGit('', '克隆仓库', () => simpleGit().clone(repoUrl, targetPath))
    onProgress?.('克隆完成！')
    return targetPath
  }

  /**
   * 检查目录是否是 Git 仓库
   */
  static async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      await getGit(projectPath).revparse(['--is-inside-work-tree'])
      return true
    } catch {
      return false
    }
  }

  /**
   * Resolves the current branch name, or null if detached or unknown.
   */
  static async getCurrentBranch(projectPath: string): Promise<string | null> {
    const headPath = path.join(projectPath, '.git', 'HEAD')

    try {
      if (fs.existsSync(headPath)) {
        const headContent = fs.readFileSync(headPath, 'utf-8').trim()
        const match = headContent.match(/ref: refs\/heads\/(.+)/)
        if (match) {
          return match[1]
        }
      }
    } catch {
      try {
        const branch = await getGit(projectPath).revparse(['--abbrev-ref', 'HEAD'])
        if (branch && branch !== 'HEAD') {
          return branch
        }
      } catch {
        // revparse failed; return null below
      }
    }

    return null
  }

  /**
   * 获取所有分支（本地和远程）
   */
  static async getAllBranches(projectPath: string): Promise<GitBranch[]> {
    try {
      const git = getGit(projectPath)
      const branchSummary = await git.branch(['-a'])

      const branches: GitBranch[] = []
      const currentBranch = branchSummary.current

      // 处理所有分支
      for (const branchName in branchSummary.branches) {
        branches.push({
          name: branchName,
          current: branchName === currentBranch,
          remote: branchName.includes('remotes/')
        })
      }

      return branches
    } catch (error) {
      console.error('Failed to get branches:', error)
      return []
    }
  }

  /**
   * 切换分支
   */
  static async checkoutBranch(projectPath: string, branchName: string): Promise<void> {
    await execGit(projectPath, '切换分支', (git) => git.checkout(branchName))
  }

  /**
   * 创建新分支
   * @param startPoint 可选的起始点（commit hash 或分支名）
   */
  static async createBranch(
    projectPath: string,
    branchName: string,
    checkout: boolean = true,
    startPoint?: string
  ): Promise<void> {
    try {
      const git = getGit(projectPath)
      if (checkout) {
        const options = startPoint ? ['-b', branchName, startPoint] : ['-b', branchName]
        await git.checkout(options)
      } else {
        const options = startPoint ? [branchName, startPoint] : [branchName]
        await git.branch(options)
      }
    } catch (error) {
      throw formatGitError(error, '创建分支')
    }
  }

  /**
   * 获取分支的 commit hash
   */
  static async getBranchCommit(projectPath: string, branchName: string): Promise<string> {
    try {
      return await getGit(projectPath).revparse([branchName])
    } catch {
      return ''
    }
  }

  /**
   * 删除本地分支
   */
  static async deleteBranch(
    projectPath: string,
    branchName: string,
    force: boolean = false
  ): Promise<void> {
    await execGit(projectPath, '删除分支', (git) => git.branch([force ? '-D' : '-d', branchName]))
  }

  /**
   * 删除远程分支
   */
  static async deleteRemoteBranch(
    projectPath: string,
    remoteName: string,
    branchName: string
  ): Promise<void> {
    await execGit(projectPath, '删除远程分支', (git) =>
      git.push([remoteName, '--delete', branchName])
    )
  }

  /**
   * 获取本地分支对应的远程追踪分支信息
   */
  static async getTrackingBranch(
    projectPath: string,
    branchName: string
  ): Promise<{ remote: string; branch: string } | null> {
    try {
      const git = getGit(projectPath)
      const remote = await git.raw(['config', '--get', `branch.${branchName}.remote`])
      const merge = await git.raw(['config', '--get', `branch.${branchName}.merge`])

      if (remote.trim() && merge.trim()) {
        const remoteBranch = merge.trim().replace('refs/heads/', '')
        return { remote: remote.trim(), branch: remoteBranch }
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 取消分支的上游追踪
   */
  static async unsetUpstream(projectPath: string, branchName: string): Promise<void> {
    await execGit(projectPath, '取消上游分支', (git) =>
      git.branch(['--unset-upstream', branchName])
    )
  }

  /**
   * 重命名分支
   */
  static async renameBranch(projectPath: string, oldName: string, newName: string): Promise<void> {
    await execGit(projectPath, '重命名分支', (git) => git.branch(['-m', oldName, newName]))
  }

  /**
   * 合并分支到当前分支
   */
  static async mergeBranch(
    projectPath: string,
    branchName: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const git = getGit(projectPath)
      await git.merge([branchName])
      return { success: true, message: '合并成功' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('CONFLICT') || message.includes('Automatic merge failed')) {
        return { success: false, message: '合并冲突，请手动解决冲突后提交' }
      }
      throw formatGitError(error, '合并分支')
    }
  }

  /**
   * 比较两个分支的差异
   */
  static async compareBranches(
    projectPath: string,
    baseBranch: string,
    compareBranch: string
  ): Promise<{
    files: Array<{
      path: string
      status: 'added' | 'modified' | 'deleted' | 'renamed'
      additions: number
      deletions: number
    }>
    stats: { additions: number; deletions: number; filesChanged: number }
  }> {
    try {
      const git = getGit(projectPath)

      // 获取差异文件列表和统计
      const numstatResult = await git.raw(['diff', '--numstat', baseBranch, compareBranch])
      const statusResult = await git.raw(['diff', '--name-status', baseBranch, compareBranch])

      const statusMap = new Map<string, string>()
      statusResult
        .trim()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => {
          const [status, ...pathParts] = line.split('\t')
          const filePath = pathParts[pathParts.length - 1]
          statusMap.set(filePath, status.charAt(0))
        })

      const files: Array<{
        path: string
        status: 'added' | 'modified' | 'deleted' | 'renamed'
        additions: number
        deletions: number
      }> = []

      let totalAdditions = 0
      let totalDeletions = 0

      numstatResult
        .trim()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => {
          const [add, del, ...pathParts] = line.split('\t')
          const filePath = pathParts.join('\t')
          const additions = add === '-' ? 0 : parseInt(add, 10)
          const deletions = del === '-' ? 0 : parseInt(del, 10)

          const statusChar = statusMap.get(filePath) || 'M'
          let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
          if (statusChar === 'A') status = 'added'
          else if (statusChar === 'D') status = 'deleted'
          else if (statusChar === 'R') status = 'renamed'

          files.push({ path: filePath, status, additions, deletions })
          totalAdditions += additions
          totalDeletions += deletions
        })

      return {
        files,
        stats: {
          additions: totalAdditions,
          deletions: totalDeletions,
          filesChanged: files.length
        }
      }
    } catch (error) {
      throw formatGitError(error, '比较分支')
    }
  }

  /**
   * 获取两个分支之间某个文件的差异内容
   */
  static async getBranchFileDiff(
    projectPath: string,
    baseBranch: string,
    compareBranch: string,
    filePath: string
  ): Promise<{ baseContent: string; compareContent: string }> {
    try {
      const git = getGit(projectPath)
      let baseContent = ''
      let compareContent = ''

      try {
        baseContent = await git.show([`${baseBranch}:${filePath}`])
      } catch {
        baseContent = ''
      }

      try {
        compareContent = await git.show([`${compareBranch}:${filePath}`])
      } catch {
        compareContent = ''
      }

      return { baseContent, compareContent }
    } catch (error) {
      throw formatGitError(error, '获取文件差异')
    }
  }

  /**
   * 获取 Git 状态
   */
  static async getStatus(projectPath: string): Promise<GitStatus> {
    try {
      const git = getGit(projectPath)
      const status = await git.status()

      const staged: string[] = []
      const modified: string[] = []
      const deleted: string[] = []
      const untracked: string[] = []
      const conflicted: string[] = []

      // 处理 simple-git 的状态文件
      status.files.forEach((file) => {
        const path = file.path
        if (file.working_dir === '?') {
          untracked.push(path)
        } else if (file.index === 'U' || file.working_dir === 'U') {
          conflicted.push(path)
        } else if (file.index !== ' ' && file.index !== '?') {
          staged.push(path)
        } else if (file.working_dir === 'D') {
          deleted.push(path)
        } else if (file.working_dir !== ' ' && file.working_dir !== '?') {
          modified.push(path)
        }
      })

      return {
        branch: status.current || 'unknown',
        ahead: status.ahead,
        behind: status.behind,
        staged,
        modified,
        deleted,
        untracked,
        conflicted
      }
    } catch (error) {
      throw formatGitError(error, '获取状态')
    }
  }

  /**
   * 暂存文件
   */
  static async stageFiles(projectPath: string, files: string[]): Promise<void> {
    await execGit(projectPath, '暂存文件', (git) => git.add(files.length === 0 ? ['-A'] : files))
  }

  /**
   * 提交更改
   */
  static async commit(projectPath: string, message: string): Promise<void> {
    await execGit(projectPath, '提交', (git) => git.commit(message))
  }

  /**
   * 推送到远程
   */
  static async push(
    projectPath: string,
    remote: string = 'origin',
    branch?: string,
    setUpstream: boolean = false
  ): Promise<void> {
    try {
      const git = getGit(projectPath)
      const options: string[] = []
      if (setUpstream) {
        options.push('--set-upstream')
      }
      if (branch) {
        options.push(remote, branch)
      } else {
        options.push(remote)
      }
      await git.push(options)
    } catch (error) {
      throw formatGitError(error, '推送')
    }
  }

  /**
   * 推送到指定 ref（用于处理分支名不匹配的情况）
   * @param refspec 例如 "HEAD:branch-name" 或 "HEAD"
   * @param setUpstream 是否设置上游
   */
  static async pushToRef(
    projectPath: string,
    remote: string,
    refspec: string,
    setUpstream: boolean = false
  ): Promise<void> {
    try {
      const git = getGit(projectPath)
      const options = [remote, refspec]
      if (setUpstream) {
        options.push('--set-upstream')
      }
      await git.push(options)
    } catch (error) {
      throw formatGitError(error, '推送')
    }
  }

  /**
   * 从远程拉取
   */
  static async pull(
    projectPath: string,
    remote: string = 'origin',
    branch?: string
  ): Promise<{ commits: number; files: number; insertions: number; deletions: number }> {
    try {
      const git = getGit(projectPath)

      // 记录 pull 前的 HEAD
      const beforeCommit = await git.revparse(['HEAD'])

      // 执行 pull
      const pullOptions = branch ? [remote, branch] : []
      await git.pull(pullOptions)

      // 记录 pull 后的 HEAD
      const afterCommit = await git.revparse(['HEAD'])

      // 如果没有更新
      if (beforeCommit === afterCommit) {
        return { commits: 0, files: 0, insertions: 0, deletions: 0 }
      }

      // 统计新增的 commits 数量
      const commitCountResult = await git.raw([
        'rev-list',
        '--count',
        `${beforeCommit}..${afterCommit}`
      ])
      const commits = parseInt(commitCountResult.trim()) || 0

      // 统计文件变化
      const diffStat = await git.raw(['diff', '--shortstat', `${beforeCommit}..${afterCommit}`])

      let files = 0,
        insertions = 0,
        deletions = 0
      const filesMatch = diffStat.match(/(\d+) files? changed/)
      const insertMatch = diffStat.match(/(\d+) insertions?/)
      const deleteMatch = diffStat.match(/(\d+) deletions?/)
      if (filesMatch) files = parseInt(filesMatch[1])
      if (insertMatch) insertions = parseInt(insertMatch[1])
      if (deleteMatch) deletions = parseInt(deleteMatch[1])

      return { commits, files, insertions, deletions }
    } catch (error) {
      throw formatGitError(error, '拉取')
    }
  }

  /**
   * 获取远程更新
   */
  static async fetch(projectPath: string, remote: string = 'origin'): Promise<void> {
    await execGit(projectPath, '获取远程更新', (git) => git.fetch([remote]))
  }

  /**
   * 获取远程仓库列表
   */
  static async getRemotes(projectPath: string): Promise<Array<{ name: string; url: string }>> {
    try {
      const git = getGit(projectPath)
      const remotes = await git.getRemotes(true)
      return remotes.map((remote) => ({
        name: remote.name,
        url: remote.refs.fetch || ''
      }))
    } catch {
      return []
    }
  }

  /**
   * 获取 Git 远程 URL(优先返回 origin)
   */
  static async getRemoteUrl(projectPath: string): Promise<string | null> {
    try {
      const remotes = await this.getRemotes(projectPath)
      const origin = remotes.find((r) => r.name === 'origin')
      return origin?.url || remotes[0]?.url || null
    } catch {
      return null
    }
  }

  /**
   * 获取文件差异
   */
  static async getDiff(projectPath: string, filePath: string): Promise<string> {
    try {
      return await getGit(projectPath).diff(['HEAD', '--', filePath])
    } catch (error) {
      console.error('Failed to get diff:', error)
      return ''
    }
  }

  /**
   * 取消暂存文件
   */
  static async unstageFiles(projectPath: string, files: string[]): Promise<void> {
    await execGit(projectPath, '取消暂存', (git) => git.reset(['HEAD', '--', ...files]))
  }

  /**
   * 获取文件的 Git blame 信息
   */
  static async getBlame(projectPath: string, filePath: string): Promise<GitBlameInfo> {
    try {
      const git = getGit(projectPath)
      const relativePath = path.relative(projectPath, filePath)
      const blameOutput = await git.raw(['blame', '--line-porcelain', relativePath])

      const lines: GitBlameLine[] = []
      const blameLines = blameOutput.split('\n')
      let currentLine: Partial<GitBlameLine> = {}

      for (const line of blameLines) {
        if (!line) continue

        if (line.match(/^[0-9a-f]{40}/)) {
          if (currentLine.commit) {
            lines.push(currentLine as GitBlameLine)
          }
          const parts = line.split(' ')
          currentLine = {
            commit: parts[0],
            line: parseInt(parts[2]),
            filename: ''
          }
        } else if (line.startsWith('author ')) {
          currentLine.author = line.substring(7)
        } else if (line.startsWith('author-mail ')) {
          currentLine.authorMail = line.substring(12).replace(/[<>]/g, '')
        } else if (line.startsWith('author-time ')) {
          currentLine.authorTime = parseInt(line.substring(12))
        } else if (line.startsWith('author-tz ')) {
          currentLine.authorTz = line.substring(10)
        } else if (line.startsWith('committer ')) {
          currentLine.committer = line.substring(10)
        } else if (line.startsWith('committer-mail ')) {
          currentLine.committerMail = line.substring(15).replace(/[<>]/g, '')
        } else if (line.startsWith('committer-time ')) {
          currentLine.committerTime = parseInt(line.substring(15))
        } else if (line.startsWith('committer-tz ')) {
          currentLine.committerTz = line.substring(13)
        } else if (line.startsWith('summary ')) {
          currentLine.summary = line.substring(8)
        } else if (line.startsWith('previous ')) {
          currentLine.previous = line.substring(9)
        } else if (line.startsWith('filename ')) {
          currentLine.filename = line.substring(9)
        }
      }

      if (currentLine.commit) {
        lines.push(currentLine as GitBlameLine)
      }

      return { lines }
    } catch {
      return { lines: [] }
    }
  }

  /**
   * 放弃文件更改（处理所有状态：staged、modified、deleted、untracked、新增）
   * 遵循 VS Code/WebStorm 的最佳实践：
   * - 已跟踪文件：git checkout HEAD -- file
   * - Untracked 文件：直接删除
   * - 新增并暂存的文件：先 unstage，再删除
   */
  static async discardFileChanges(projectPath: string, filePath: string): Promise<void> {
    try {
      const git = getGit(projectPath)
      const relativePath = path.isAbsolute(filePath)
        ? path.relative(projectPath, filePath)
        : filePath
      const fullPath = path.join(projectPath, relativePath)

      // 检查文件在 HEAD 中是否存在
      try {
        await git.raw(['ls-tree', 'HEAD', '--', relativePath])
        // 文件在 HEAD 中存在，恢复
        await git.checkout(['HEAD', '--', relativePath])
      } catch {
        // 文件在 HEAD 中不存在（新增的文件）
        await git.reset(['HEAD', '--', relativePath]).catch(() => {})
        const stat = await fs.promises.stat(fullPath).catch(() => null)
        if (stat) {
          if (stat.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true })
          } else {
            await fs.promises.unlink(fullPath)
          }
        }
      }
    } catch (error) {
      throw formatGitError(error, '放弃更改')
    }
  }

  /**
   * 获取文件的提交历史
   */
  static async getFileHistory(
    projectPath: string,
    filePath: string,
    limit: number = 50
  ): Promise<
    Array<{
      hash: string
      author: string
      date: string
      message: string
    }>
  > {
    try {
      const git = getGit(projectPath)
      const relativePath = path.relative(projectPath, filePath)
      const log = await git.log({
        file: relativePath,
        maxCount: limit
      })

      return log.all.map((commit) => ({
        hash: commit.hash,
        author: commit.author_name,
        date: commit.date,
        message: commit.message
      }))
    } catch (error) {
      console.error('Failed to get file history:', error)
      return []
    }
  }

  /**
   * 获取文件与指定分支的差异
   */
  static async compareWithBranch(
    projectPath: string,
    filePath: string,
    branch: string
  ): Promise<string> {
    try {
      return await getGit(projectPath).diff([branch, '--', path.relative(projectPath, filePath)])
    } catch (error) {
      console.error('Failed to compare with branch:', error)
      return ''
    }
  }

  /**
   * 获取文件在工作区的差异（与HEAD比较）
   */
  static async getWorkingDiff(projectPath: string, filePath: string): Promise<string> {
    try {
      return await getGit(projectPath).diff(['HEAD', '--', path.relative(projectPath, filePath)])
    } catch (error) {
      console.error('Failed to get working diff:', error)
      return ''
    }
  }

  /**
   * 从 Git HEAD 获取文件内容（用于读取已删除的文件）
   */
  static async getFileFromHead(projectPath: string, filePath: string): Promise<string> {
    return await execGit(projectPath, '获取 HEAD 文件内容', (git) =>
      git.show([`HEAD:${path.relative(projectPath, filePath)}`])
    )
  }

  // ============ Stash Operations ============

  /**
   * 创建 stash
   */
  static async stash(
    projectPath: string,
    message?: string,
    includeUntracked: boolean = true
  ): Promise<void> {
    const options = ['push']
    if (includeUntracked) options.push('--include-untracked')
    if (message) options.push('-m', message)
    await execGit(projectPath, '暂存更改', (git) => git.stash(options))
  }

  /**
   * 获取 stash 列表
   */
  static async stashList(projectPath: string): Promise<GitStashEntry[]> {
    try {
      const git = getGit(projectPath)
      const stashList = await git.stashList()

      return stashList.all.map((stash, index) => {
        const fullMessage = stash.message
        const messageMatch = fullMessage.match(/^(?:WIP on|On) ([^:]+): (.*)$/)
        const branch = messageMatch ? messageMatch[1] : 'unknown'
        const message = messageMatch ? messageMatch[2] : fullMessage

        return {
          index,
          branch,
          message,
          date: stash.date,
          hash: stash.hash
        }
      })
    } catch (error) {
      console.error('Failed to list stashes:', error)
      return []
    }
  }

  /**
   * 应用 stash（保留 stash）
   */
  static async stashApply(projectPath: string, index: number = 0): Promise<void> {
    await execGit(projectPath, '恢复暂存', (git) => git.stash(['apply', `stash@{${index}}`]))
  }

  /**
   * 弹出 stash（应用并删除）
   */
  static async stashPop(projectPath: string, index: number = 0): Promise<void> {
    await execGit(projectPath, '恢复并移除暂存', (git) => git.stash(['pop', `stash@{${index}}`]))
  }

  /**
   * 删除 stash
   */
  static async stashDrop(projectPath: string, index: number): Promise<void> {
    await execGit(projectPath, '删除暂存', (git) => git.stash(['drop', `stash@{${index}}`]))
  }

  /**
   * 清空所有 stash
   */
  static async stashClear(projectPath: string): Promise<void> {
    await execGit(projectPath, '清空暂存', (git) => git.stash(['clear']))
  }

  /**
   * 获取 stash 包含的文件列表
   */
  static async stashShowFiles(projectPath: string, index: number = 0): Promise<string[]> {
    try {
      const result = await getGit(projectPath).stash(['show', `stash@{${index}}`, '--name-only'])
      return result.trim().split('\n').filter(Boolean)
    } catch (error) {
      console.error('Failed to show stash files:', error)
      return []
    }
  }

  /**
   * 获取 stash 的 diff
   */
  static async stashShowDiff(projectPath: string, index: number = 0): Promise<string> {
    try {
      return await getGit(projectPath).stash(['show', `stash@{${index}}`, '-p'])
    } catch (error) {
      console.error('Failed to show stash diff:', error)
      return ''
    }
  }

  /**
   * 获取 stash 中特定文件的内容
   */
  static async stashGetFileContent(
    projectPath: string,
    index: number,
    filePath: string
  ): Promise<string> {
    try {
      return await getGit(projectPath).show([`stash@{${index}}:${filePath}`])
    } catch (error) {
      console.error('Failed to get stash file content:', error)
      return ''
    }
  }

  // ============ Git History APIs ============

  /**
   * 获取提交历史
   */
  static async getCommitHistory(
    projectPath: string,
    options: {
      limit?: number
      skip?: number
      branch?: string
      author?: string
      search?: string
    } = {}
  ): Promise<{
    commits: GitCommit[]
    hasMore: boolean
  }> {
    const { limit = 50, skip = 0, branch, author, search } = options

    try {
      const git = getGit(projectPath)

      // 构建 git log 命令参数
      const args: string[] = [
        'log',
        `--max-count=${limit + 1}`,
        `--skip=${skip}`,
        '--pretty=format:%H|%h|%an|%ae|%ad|%s|%P|%D',
        '--date=iso'
      ]

      if (branch === 'all') {
        args.push('--all')
      } else if (branch) {
        args.push(branch)
      }

      if (author) {
        args.push(`--author=${author}`)
      }

      if (search) {
        args.push(`--grep=${search}`)
      }

      const logOutput = await git.raw(args)

      if (!logOutput.trim()) {
        return { commits: [], hasMore: false }
      }

      const lines = logOutput.trim().split('\n')
      const hasMore = lines.length > limit

      const commits: GitCommit[] = lines.slice(0, limit).map((line) => {
        const parts = line.split('|')
        const [hash, shortHash, authorName, email, date, message, parentsStr, refs] = parts
        const parents = parentsStr ? parentsStr.split(' ').filter(Boolean) : []

        return {
          hash,
          shortHash,
          author: authorName,
          email,
          date,
          message,
          parents,
          refs: refs ? refs.split(', ').filter(Boolean) : []
        }
      })

      return { commits, hasMore }
    } catch (error) {
      // 刚初始化的仓库还没有提交，这是正常情况
      const errorMessage = getErrorMessage(error)
      if (
        errorMessage.includes('ambiguous argument') ||
        errorMessage.includes('does not have any commits yet')
      ) {
        return { commits: [], hasMore: false } // 静默处理：刚初始化的Git仓库
      }
      console.error('Failed to get commit history:', error)
      return { commits: [], hasMore: false }
    }
  }

  /**
   * 获取所有提交作者列表
   */
  static async getAuthors(projectPath: string): Promise<string[]> {
    try {
      const git = getGit(projectPath)
      const log = await git.log()
      const authors = [...new Set(log.all.map((commit) => commit.author_name).filter(Boolean))]
      return authors.sort((a, b) => a.localeCompare(b))
    } catch (error) {
      // 刚初始化的仓库还没有提交，这是正常情况
      const errorMessage = getErrorMessage(error)
      if (errorMessage.includes('does not have any commits yet')) {
        return [] // 静默处理：刚初始化的Git仓库
      }
      console.error('Failed to get authors:', error)
      return []
    }
  }

  /**
   * 获取提交详情（包含变更的文件列表）
   */
  static async getCommitDetail(
    projectPath: string,
    commitHash: string
  ): Promise<GitCommitDetail | null> {
    try {
      const git = getGit(projectPath)

      // 获取提交基本信息
      const commit = await git.show([
        commitHash,
        '--no-patch',
        '--format=%H|%h|%an|%ae|%ad|%P|%B',
        '--date=iso'
      ])
      const [hash, shortHash, author, email, date, parentsStr, ...bodyParts] = commit.split('|')
      const body = bodyParts.join('|').trim()
      const parents = parentsStr ? parentsStr.trim().split(' ').filter(Boolean) : []

      // 获取变更的文件列表
      const filesOutput = await git.raw([
        'diff-tree',
        '--no-commit-id',
        '--name-status',
        '-r',
        commitHash
      ])
      const files: GitCommitFile[] = filesOutput
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [statusCode, ...pathParts] = line.split('\t')
          const filePath = pathParts.join('\t')
          let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'

          if (statusCode.startsWith('A')) status = 'added'
          else if (statusCode.startsWith('D')) status = 'deleted'
          else if (statusCode.startsWith('R')) status = 'renamed'
          else if (statusCode.startsWith('M')) status = 'modified'

          return { path: filePath, status }
        })

      // 获取统计信息
      const statsOutput = await git.raw([
        'diff-tree',
        '--no-commit-id',
        '--numstat',
        '-r',
        commitHash
      ])
      let additions = 0
      let deletions = 0
      statsOutput
        .trim()
        .split('\n')
        .filter(Boolean)
        .forEach((line) => {
          const [add, del] = line.split('\t')
          if (add !== '-') additions += parseInt(add, 10) || 0
          if (del !== '-') deletions += parseInt(del, 10) || 0
        })

      return {
        hash,
        shortHash,
        author,
        email,
        date,
        message: body.split('\n')[0] || '',
        parents,
        body,
        files,
        stats: { additions, deletions, filesChanged: files.length }
      }
    } catch (error) {
      console.error('Failed to get commit detail:', error)
      return null
    }
  }

  /**
   * 获取两个提交之间某个文件的 diff
   */
  static async getCommitFileDiff(
    projectPath: string,
    commitHash: string,
    filePath: string
  ): Promise<{ before: string; after: string }> {
    try {
      const git = getGit(projectPath)
      let after = ''
      let before = ''

      try {
        after = await git.show([`${commitHash}:${filePath}`])
      } catch {
        // 文件可能是新增的
      }

      try {
        before = await git.show([`${commitHash}^:${filePath}`])
      } catch {
        // 文件可能在父提交中不存在
      }

      return { before, after }
    } catch (error) {
      console.error('Failed to get commit file diff:', error)
      return { before: '', after: '' }
    }
  }

  /**
   * Amend 最后一次提交
   */
  static async amendCommit(projectPath: string, message?: string): Promise<void> {
    try {
      const git = getGit(projectPath)
      if (message) {
        await git.commit(message, undefined, { '--amend': null })
      } else {
        await git.raw(['commit', '--amend', '--no-edit'])
      }
    } catch (error) {
      throw formatGitError(error, 'Amend 提交')
    }
  }

  /**
   * 重置到指定提交
   */
  static async resetToCommit(
    projectPath: string,
    commitHash: string,
    mode: 'soft' | 'mixed' | 'hard' = 'mixed'
  ): Promise<void> {
    await execGit(projectPath, 'Reset', (git) => git.reset([`--${mode}`, commitHash]))
  }

  /**
   * 回退指定提交（创建新的回退提交）
   */
  static async revertCommit(projectPath: string, commitHash: string): Promise<void> {
    try {
      const git = getGit(projectPath)
      await git.revert(commitHash)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('conflict') || message.includes('CONFLICT')) {
        throw new Error('回退过程中发生冲突，请手动解决冲突后提交')
      }
      throw formatGitError(error, 'Revert')
    }
  }

  /**
   * 检测 HEAD 提交是否已推送到远程（内部方法）
   * 用于 Amend 前的安全检查
   */
  static async isHeadPushed(projectPath: string): Promise<boolean> {
    try {
      const git = getGit(projectPath)

      // 获取当前分支的跟踪远程分支
      try {
        await git.revparse(['--abbrev-ref', '@{upstream}'])
      } catch {
        return false
      }

      // 检查 HEAD 是否是远程分支的祖先
      try {
        await git.raw(['merge-base', '--is-ancestor', 'HEAD', '@{upstream}'])
        return true
      } catch {
        return false
      }
    } catch {
      return false
    }
  }

  /**
   * 获取最后一次提交的详情（用于 Amend 预览）
   */
  static async getLastCommitInfo(projectPath: string): Promise<{
    hash: string
    shortHash: string
    message: string
    author: string
    date: string
    files: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }>
    isPushed: boolean
  } | null> {
    try {
      const git = getGit(projectPath)

      // 获取最后一次提交
      const log = await git.log({ maxCount: 1 })
      if (!log.latest) return null

      const commit = log.latest
      const hash = commit.hash
      const shortHash = commit.hash.substring(0, 7)
      const author = commit.author_name
      const date = commit.date
      const message = commit.message

      // 获取变更的文件
      const filesOutput = await git.raw([
        'diff-tree',
        '--no-commit-id',
        '--name-status',
        '-r',
        'HEAD'
      ])
      const files = filesOutput
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [statusChar, ...pathParts] = line.split('\t')
          const path = pathParts.join('\t')
          let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
          if (statusChar === 'A') status = 'added'
          else if (statusChar === 'D') status = 'deleted'
          else if (statusChar.startsWith('R')) status = 'renamed'
          return { path, status }
        })

      const isPushed = await this.isHeadPushed(projectPath)

      return { hash, shortHash, message, author, date, files, isPushed }
    } catch (error) {
      console.error('Failed to get last commit info:', error)
      return null
    }
  }

  /**
   * 获取冲突文件的三个版本（三方合并所需）
   * @returns { ours, theirs, base, current } - 分别是当前分支版本、合并分支版本、共同祖先版本、当前工作区内容
   */
  static async getConflictVersions(
    projectPath: string,
    filePath: string
  ): Promise<{
    ours: string
    theirs: string
    base: string
    current: string
    oursBranch: string
    theirsBranch: string
  }> {
    try {
      const git = getGit(projectPath)
      const relativePath = path.isAbsolute(filePath)
        ? path.relative(projectPath, filePath)
        : filePath

      // 获取三个版本
      const [base, ours, theirs] = await Promise.all([
        git.show([`:1:${relativePath}`]).catch(() => ''),
        git.show([`:2:${relativePath}`]).catch(() => ''),
        git.show([`:3:${relativePath}`]).catch(() => '')
      ])

      // 获取当前工作区内容
      const fullPath = path.join(projectPath, relativePath)
      const current = await fs.promises.readFile(fullPath, 'utf-8').catch(() => '')

      // 获取当前分支名
      const branchSummary = await git.branch()
      const oursBranch = branchSummary.current || 'HEAD'

      // 尝试从 MERGE_MSG 获取合并分支名
      let theirsBranch = 'incoming'
      try {
        const mergeMsgPath = path.join(projectPath, '.git', 'MERGE_MSG')
        const mergeMsg = await fs.promises.readFile(mergeMsgPath, 'utf-8')
        const match = mergeMsg.match(/Merge (?:remote-tracking )?branch '([^']+)'/)
        if (match) {
          theirsBranch = match[1]
        }
      } catch {
        // MERGE_MSG 不存在
      }

      return { ours, theirs, base, current, oursBranch, theirsBranch }
    } catch (error) {
      throw formatGitError(error, '获取冲突版本')
    }
  }

  /**
   * 解决冲突：保存合并结果并标记为已解决
   */
  static async resolveConflict(
    projectPath: string,
    filePath: string,
    resolvedContent: string
  ): Promise<void> {
    const relativePath = path.isAbsolute(filePath) ? path.relative(projectPath, filePath) : filePath
    await fs.promises.writeFile(path.join(projectPath, relativePath), resolvedContent, 'utf-8')
    await execGit(projectPath, '解决冲突', (git) => git.add([relativePath]))
  }

  /**
   * 中止合并操作
   */
  static async abortMerge(projectPath: string): Promise<void> {
    await execGit(projectPath, '中止合并', (git) => git.merge(['--abort']))
  }

  /**
   * 接受所有"我们的"更改（批量解决冲突）
   */
  static async acceptAllOurs(projectPath: string, conflictedFiles: string[]): Promise<void> {
    await execGit(projectPath, '接受所有本地更改', async (git) => {
      for (const filePath of conflictedFiles) {
        const relativePath = path.isAbsolute(filePath)
          ? path.relative(projectPath, filePath)
          : filePath
        await git.checkout(['--ours', '--', relativePath])
        await git.add([relativePath])
      }
    })
  }

  /**
   * 接受所有"他们的"更改（批量解决冲突）
   */
  static async acceptAllTheirs(projectPath: string, conflictedFiles: string[]): Promise<void> {
    await execGit(projectPath, '接受所有远程更改', async (git) => {
      for (const filePath of conflictedFiles) {
        const relativePath = path.isAbsolute(filePath)
          ? path.relative(projectPath, filePath)
          : filePath
        await git.checkout(['--theirs', '--', relativePath])
        await git.add([relativePath])
      }
    })
  }

  // ==================== Tag 管理 ====================

  /**
   * 获取所有标签
   */
  static async listTags(
    projectPath: string
  ): Promise<Array<{ name: string; hash: string; message?: string; date?: string }>> {
    try {
      const git = getGit(projectPath)
      // 使用 for-each-ref 一次性获取所有 tag 信息，性能优化：O(N²) -> O(N)
      const output = await git.raw([
        'for-each-ref',
        '--sort=-creatordate',
        '--format=%(refname:short)|%(objectname:short)|%(creatordate:iso8601)|%(contents:subject)',
        'refs/tags'
      ])

      if (!output.trim()) return []

      return output
        .trim()
        .split('\n')
        .map((line) => {
          const [name, hash, date, message] = line.split('|')
          return { name, hash, message: message || undefined, date: date || undefined }
        })
    } catch {
      return []
    }
  }

  /**
   * 创建标签
   */
  static async createTag(
    projectPath: string,
    tagName: string,
    options?: { message?: string; commitHash?: string }
  ): Promise<void> {
    try {
      const git = getGit(projectPath)
      const tagOptions: string[] = []

      if (options?.message) {
        tagOptions.push('-a', tagName, '-m', options.message)
      } else {
        tagOptions.push(tagName)
      }

      if (options?.commitHash) {
        tagOptions.push(options.commitHash)
      }

      await git.tag(tagOptions)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('already exists')) {
        throw new Error(`标签 "${tagName}" 已存在`)
      }
      throw formatGitError(error, '创建标签')
    }
  }

  /**
   * 删除本地标签
   */
  static async deleteTag(projectPath: string, tagName: string): Promise<void> {
    await execGit(projectPath, '删除标签', (git) => git.tag(['-d', tagName]))
  }

  /**
   * 推送标签到远程
   */
  static async pushTag(
    projectPath: string,
    tagName: string,
    remote: string = 'origin'
  ): Promise<void> {
    await execGit(projectPath, '推送标签', (git) => git.push([remote, tagName]))
  }

  /**
   * 删除远程标签
   */
  static async deleteRemoteTag(
    projectPath: string,
    tagName: string,
    remote: string = 'origin'
  ): Promise<void> {
    await execGit(projectPath, '删除远程标签', (git) => git.push([remote, '--delete', tagName]))
  }

  // ==================== Rebase ====================

  /**
   * 执行 rebase 操作
   */
  static async rebase(
    projectPath: string,
    onto: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const git = getGit(projectPath)
      await git.rebase([onto])
      return { success: true, message: 'Rebase 成功' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('CONFLICT') || message.includes('conflict')) {
        return { success: false, message: 'Rebase 过程中发生冲突，请解决冲突后继续' }
      }
      throw formatGitError(error, 'Rebase')
    }
  }

  // ==================== Squash ====================

  /**
   * 合并最近 N 个提交为一个（Squash）
   */
  static async squashCommits(projectPath: string, count: number, message: string): Promise<void> {
    await execGit(projectPath, 'Squash', async (git) => {
      await git.reset(['--soft', `HEAD~${count}`])
      await git.commit(message)
    })
  }

  // ==================== 仓库初始化 ====================

  /**
   * 初始化 Git 仓库
   */
  static async initRepository(projectPath: string): Promise<void> {
    await execGit(projectPath, '初始化仓库', (git) => git.init())
  }

  // ==================== 远程仓库管理 ====================

  /**
   * 添加远程仓库
   */
  static async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    await execGit(projectPath, '添加远程仓库', (git) => git.addRemote(name, url))
  }

  /**
   * 删除远程仓库
   */
  static async removeRemote(projectPath: string, name: string): Promise<void> {
    await execGit(projectPath, '删除远程仓库', (git) => git.removeRemote(name))
  }

  /**
   * 修改远程仓库 URL
   */
  static async setRemoteUrl(projectPath: string, name: string, url: string): Promise<void> {
    await execGit(projectPath, '修改远程仓库', (git) => git.raw(['remote', 'set-url', name, url]))
  }

  // ==================== Cherry-pick ====================

  /**
   * Cherry-pick 提交
   */
  static async cherryPick(
    projectPath: string,
    commitHash: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const git = getGit(projectPath)
      await git.raw(['cherry-pick', commitHash])
      return { success: true, message: 'Cherry-pick 成功' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('CONFLICT') || message.includes('conflict')) {
        return { success: false, message: 'Cherry-pick 过程中发生冲突，请手动解决冲突后提交' }
      }
      throw formatGitError(error, 'Cherry-pick')
    }
  }
}
