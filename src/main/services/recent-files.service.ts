import { getDb } from '../database/db'

/**
 * 最近文件服务
 * 按项目分别存储最近访问的文件路径，使用 SQLite 持久化
 */
export class RecentFilesService {
  private static instance: RecentFilesService
  private db: ReturnType<typeof getDb>

  private constructor() {
    this.db = getDb()
  }

  static getInstance(): RecentFilesService {
    if (!RecentFilesService.instance) {
      RecentFilesService.instance = new RecentFilesService()
    }
    return RecentFilesService.instance
  }

  addRecentFile(projectPath: string, filePath: string): void {
    if (!projectPath || !filePath) return
    this.db.addRecentFile(projectPath, filePath)
  }

  getRecentFiles(projectPath: string, limit: number = 20): string[] {
    if (!projectPath) return []
    return this.db.getRecentFiles(projectPath, limit)
  }

  removeRecentFile(projectPath: string, filePath: string): void {
    if (!projectPath || !filePath) return
    this.db.removeRecentFile(projectPath, filePath)
  }

  clearRecentFiles(projectPath: string): void {
    if (!projectPath) return
    this.db.clearRecentFiles(projectPath)
  }
}
