import { dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Git 工具函数集合
 */
export class GitUtils {
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

  /**
   * 从 Git URL 提取仓库名称
   */
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create project: ${message}`)
    }
  }

  /**
   * 标准化 Git URL
   */
  static normalizeGitUrl(gitUrl: string): string {
    return gitUrl
      .replace(/\.git$/, '')
      .replace(/^https?:\/\/[^@]+@/, 'https://')
      .replace(/^git@([^:]+):/, 'https://$1/')
      .toLowerCase()
      .trim()
  }
}
