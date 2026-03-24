import * as fs from 'fs/promises'
import * as path from 'path'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
}

export class FileService {
  /**
   * 读取文件内容
   */
  static async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 读取二进制文件（用于图片等）
   */
  static async readBinaryFile(filePath: string): Promise<Buffer> {
    try {
      const content = await fs.readFile(filePath)
      return content
    } catch (error) {
      console.error(`Failed to read binary file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 写入文件
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 列出目录内容
   */
  static async listDirectory(dirPath: string): Promise<FileNode[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) {
          continue
        }

        const fullPath = path.join(dirPath, entry.name)
        const stats = await fs.stat(fullPath)
        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size
        }

        nodes.push(node)
      }

      // 排序：目录在前，文件在后
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return nodes
    } catch (error) {
      console.error(`Failed to list directory ${dirPath}:`, error)
      throw error
    }
  }

  /**
   * 创建文件
   */
  static async createFile(filePath: string, content: string = ''): Promise<void> {
    try {
      // 检查文件是否已存在
      try {
        await fs.access(filePath)
        throw new Error('File already exists')
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }

      await this.writeFile(filePath, content)
    } catch (error) {
      console.error(`Failed to create file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 创建目录
   */
  static async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error)
      throw error
    }
  }

  /**
   * 删除文件或目录
   */
  static async delete(targetPath: string): Promise<void> {
    try {
      const stat = await fs.stat(targetPath)
      if (stat.isDirectory()) {
        await fs.rm(targetPath, { recursive: true })
      } else {
        await fs.unlink(targetPath)
      }
    } catch (error) {
      console.error(`Failed to delete ${targetPath}:`, error)
      throw error
    }
  }

  /**
   * 重命名文件或目录
   */
  static async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      console.error(`Failed to rename ${oldPath} to ${newPath}:`, error)
      throw error
    }
  }

  /**
   * 判断是否应该忽略文件/目录
   */
  private static shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      // 隐藏文件
      /^\./,
      // Node.js
      /^node_modules$/,
      // Build outputs
      /^dist$/,
      /^build$/,
      /^out$/,
      /^\.next$/,
      // Dependencies
      /^\.pnpm$/,
      /^pnpm-lock\.yaml$/,
      /^package-lock\.json$/,
      /^yarn\.lock$/,
      // Git
      /^\.git$/,
      // IDE
      /^\.vscode$/,
      /^\.idea$/,
      // OS
      /^\.DS_Store$/,
      /^Thumbs\.db$/
    ]

    return ignorePatterns.some((pattern) => pattern.test(name))
  }

  /**
   * 检查路径是否存在
   */
  static async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取文件信息
   */
  static async getFileInfo(filePath: string) {
    try {
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      }
    } catch (error) {
      console.error(`Failed to get file info ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 在文件管理器中显示文件
   */
  static async revealInFinder(filePath: string): Promise<void> {
    try {
      const { shell } = require('electron')
      shell.showItemInFolder(filePath)
    } catch (error) {
      console.error(`Failed to reveal in finder ${filePath}:`, error)
      throw error
    }
  }
}
