import { dialog } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

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
  untracked: string[]
  conflicted: string[]
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

export class GitService {
  /**
   * 克隆 Git 仓库
   */
  static async cloneRepository(
    repoUrl: string,
    targetPath: string,
    onProgress?: (message: string) => void
  ): Promise<string> {
    try {
      if (fs.existsSync(targetPath)) {
        throw new Error(`Target directory already exists: ${targetPath}`)
      }

      onProgress?.('正在克隆仓库...')
      await execAsync(`git clone "${repoUrl}" "${targetPath}"`)
      onProgress?.('克隆完成！')

      return targetPath
    } catch (error: any) {
      throw new Error(`Failed to clone repository: ${error.message || error}`)
    }
  }

  /**
   * 选择目标文件夹
   */
  static async selectTargetDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Parent Directory',
      buttonLabel: 'Select'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  }

  static extractRepoName(repoUrl: string): string {
    const name = repoUrl
      .replace(/\.git$/, '')
      .split('/')
      .pop()
    return name || 'repository'
  }

  /**
   * 创建新项目目录
   */
  static async createNewProject(parentPath: string, projectName: string): Promise<string> {
    try {
      const projectPath = path.join(parentPath, projectName)

      // 检查目录是否已存在
      if (fs.existsSync(projectPath)) {
        throw new Error(`Project directory already exists: ${projectPath}`)
      }

      // 创建项目目录
      fs.mkdirSync(projectPath, { recursive: true })

      // 创建一个基础的 README.md 文件
      const readmeContent = `# ${projectName}\n\nA new project created with Circle.\n`
      fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8')

      return projectPath
    } catch (error: any) {
      throw new Error(`Failed to create project: ${error.message || error}`)
    }
  }

  /**
   * 检查目录是否是 Git 仓库
   */
  static async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: projectPath
      })
      return stdout.trim() === 'true'
    } catch {
      return false
    }
  }

  /**
   * 获取当前分支名称
   */
  static async getCurrentBranch(projectPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath
      })
      return stdout.trim()
    } catch (error) {
      console.error('Failed to get current branch:', error)
      return null
    }
  }

  /**
   * 获取所有分支（本地和远程）
   */
  static async getAllBranches(projectPath: string): Promise<GitBranch[]> {
    try {
      const { stdout } = await execAsync('git branch -a --format="%(refname:short)|%(HEAD)"', {
        cwd: projectPath
      })

      const branches: GitBranch[] = []
      const lines = stdout.trim().split('\n')

      for (const line of lines) {
        const [name, head] = line.split('|')
        if (name) {
          branches.push({
            name: name.trim(),
            current: head === '*',
            remote: name.includes('origin/')
          })
        }
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
    try {
      await execAsync(`git checkout "${branchName}"`, {
        cwd: projectPath
      })
    } catch (error: any) {
      throw new Error(`Failed to checkout branch: ${error.message || error}`)
    }
  }

  /**
   * 创建新分支
   */
  static async createBranch(
    projectPath: string,
    branchName: string,
    checkout: boolean = true
  ): Promise<void> {
    try {
      const command = checkout ? `git checkout -b "${branchName}"` : `git branch "${branchName}"`

      await execAsync(command, {
        cwd: projectPath
      })
    } catch (error: any) {
      throw new Error(`Failed to create branch: ${error.message || error}`)
    }
  }

  /**
   * 删除分支
   */
  static async deleteBranch(
    projectPath: string,
    branchName: string,
    force: boolean = false
  ): Promise<void> {
    try {
      const flag = force ? '-D' : '-d'
      await execAsync(`git branch ${flag} "${branchName}"`, {
        cwd: projectPath
      })
    } catch (error: any) {
      throw new Error(`Failed to delete branch: ${error.message || error}`)
    }
  }

  /**
   * 获取 Git 状态
   */
  static async getStatus(projectPath: string): Promise<GitStatus> {
    try {
      const [statusResult, branchResult] = await Promise.all([
        execAsync('git status --porcelain=v1', { cwd: projectPath }),
        execAsync('git status -sb', { cwd: projectPath })
      ])

      const branch = branchResult.stdout.match(/## (.+?)(?:\.\.\.|$)/)?.[1] || 'unknown'
      const aheadMatch = branchResult.stdout.match(/ahead (\d+)/)
      const behindMatch = branchResult.stdout.match(/behind (\d+)/)

      const staged: string[] = []
      const modified: string[] = []
      const untracked: string[] = []
      const conflicted: string[] = []

      const lines = statusResult.stdout.split('\n')
      for (const line of lines) {
        if (!line) continue

        const status = line.substring(0, 2)
        const file = line.substring(3)

        if (status === '??') {
          untracked.push(file)
        } else if (status.includes('U') || status === 'AA' || status === 'DD') {
          conflicted.push(file)
        } else if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file)
        } else if (status[1] !== ' ' && status[1] !== '?') {
          modified.push(file)
        }
      }

      return {
        branch,
        ahead: aheadMatch ? parseInt(aheadMatch[1]) : 0,
        behind: behindMatch ? parseInt(behindMatch[1]) : 0,
        staged,
        modified,
        untracked,
        conflicted
      }
    } catch (error: any) {
      throw new Error(`Failed to get status: ${error.message || error}`)
    }
  }

  /**
   * 暂存文件
   */
  static async stageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
      if (files.length === 0) {
        await execAsync('git add -A', { cwd: projectPath })
      } else {
        const fileList = files.map((f) => `"${f}"`).join(' ')
        await execAsync(`git add ${fileList}`, { cwd: projectPath })
      }
    } catch (error: any) {
      throw new Error(`Failed to stage files: ${error.message || error}`)
    }
  }

  /**
   * 提交更改
   */
  static async commit(projectPath: string, message: string): Promise<void> {
    try {
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: projectPath
      })
    } catch (error: any) {
      throw new Error(`Failed to commit: ${error.message || error}`)
    }
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
      let command = `git push ${remote}`

      if (branch) {
        command += ` ${branch}`
      }

      if (setUpstream) {
        command += ' --set-upstream'
      }

      await execAsync(command, { cwd: projectPath })
    } catch (error: any) {
      throw new Error(`Failed to push: ${error.message || error}`)
    }
  }

  /**
   * 从远程拉取
   */
  static async pull(
    projectPath: string,
    remote: string = 'origin',
    branch?: string
  ): Promise<void> {
    try {
      const command = branch ? `git pull ${remote} ${branch}` : `git pull`

      await execAsync(command, { cwd: projectPath })
    } catch (error: any) {
      throw new Error(`Failed to pull: ${error.message || error}`)
    }
  }

  /**
   * 获取远程更新
   */
  static async fetch(projectPath: string, remote: string = 'origin'): Promise<void> {
    try {
      await execAsync(`git fetch ${remote}`, { cwd: projectPath })
    } catch (error: any) {
      throw new Error(`Failed to fetch: ${error.message || error}`)
    }
  }

  /**
   * 获取远程仓库列表
   */
  static async getRemotes(projectPath: string): Promise<Array<{ name: string; url: string }>> {
    try {
      const { stdout } = await execAsync('git remote -v', { cwd: projectPath })
      const lines = stdout.trim().split('\n')
      const remotes: Array<{ name: string; url: string }> = []
      const seen = new Set<string>()

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/)
        if (match && !seen.has(match[1])) {
          remotes.push({
            name: match[1],
            url: match[2]
          })
          seen.add(match[1])
        }
      }

      return remotes
    } catch {
      return []
    }
  }

  /**
   * 获取文件差异
   */
  static async getDiff(projectPath: string, filePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, {
        cwd: projectPath
      })
      return stdout
    } catch (error) {
      console.error('Failed to get diff:', error)
      return ''
    }
  }

  /**
   * 取消暂存文件
   */
  static async unstageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
      const fileList = files.map((f) => `"${f}"`).join(' ')
      await execAsync(`git reset HEAD ${fileList}`, { cwd: projectPath })
    } catch (error: any) {
      throw new Error(`Failed to unstage files: ${error.message || error}`)
    }
  }

  /**
   * 获取文件的 Git blame 信息
   */
  static async getBlame(projectPath: string, filePath: string): Promise<GitBlameInfo> {
    try {
      const relativePath = path.relative(projectPath, filePath)
      const { stdout } = await execAsync(`git blame --line-porcelain "${relativePath}"`, {
        cwd: projectPath,
        maxBuffer: 10 * 1024 * 1024
      })

      const lines: GitBlameLine[] = []
      const blameLines = stdout.split('\n')
      let currentLine: Partial<GitBlameLine> = {}

      for (let i = 0; i < blameLines.length; i++) {
        const line = blameLines[i]
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
   * 回滚文件到HEAD版本（撤销本地更改）
   */
  static async revertFile(projectPath: string, filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(projectPath, filePath)
      await execAsync(`git checkout HEAD -- "${relativePath}"`, { cwd: projectPath })
    } catch (error: any) {
      throw new Error(`Failed to revert file: ${error.message || error}`)
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
      const relativePath = path.relative(projectPath, filePath)
      const { stdout } = await execAsync(
        `git log -n ${limit} --pretty=format:"%H|%an|%ad|%s" --date=iso -- "${relativePath}"`,
        { cwd: projectPath }
      )

      if (!stdout.trim()) {
        return []
      }

      return stdout
        .trim()
        .split('\n')
        .map((line) => {
          const [hash, author, date, message] = line.split('|')
          return { hash, author, date, message }
        })
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
      const relativePath = path.relative(projectPath, filePath)
      const { stdout } = await execAsync(`git diff ${branch} -- "${relativePath}"`, {
        cwd: projectPath
      })
      return stdout
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
      const relativePath = path.relative(projectPath, filePath)
      const { stdout } = await execAsync(`git diff HEAD -- "${relativePath}"`, { cwd: projectPath })
      return stdout
    } catch (error) {
      console.error('Failed to get working diff:', error)
      return ''
    }
  }
}
