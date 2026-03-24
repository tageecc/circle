import { app, dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

/**
 * 头像管理服务
 * 负责头像文件的上传、保存、删除和读取
 */
export class AvatarService {
  private static avatarDir: string

  /**
   * 初始化头像目录
   */
  static async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.avatarDir = path.join(userDataPath, 'avatars')

    // 确保目录存在
    try {
      await fs.access(this.avatarDir)
    } catch {
      await fs.mkdir(this.avatarDir, { recursive: true })
      console.log('✅ Avatar directory created:', this.avatarDir)
    }
  }

  /**
   * 获取头像目录路径
   */
  static getAvatarDir(): string {
    return this.avatarDir
  }

  /**
   * 打开文件选择对话框，让用户选择头像
   * @returns 返回选中的文件路径，如果取消则返回 null
   */
  static async selectAvatarFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: '选择头像',
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  }

  /**
   * 保存头像文件到应用目录
   * @param sourcePath 源文件路径
   * @param agentId Agent ID（用于生成唯一文件名）
   * @returns 返回保存后的文件名（不含路径）
   */
  static async saveAvatar(sourcePath: string, agentId: string): Promise<string> {
    // 读取源文件
    const fileBuffer = await fs.readFile(sourcePath)

    // 验证文件大小（限制为 5MB）
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (fileBuffer.length > maxSize) {
      throw new Error('图片文件太大，请选择小于 5MB 的图片')
    }

    // 获取文件扩展名
    const ext = path.extname(sourcePath).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      throw new Error('不支持的图片格式')
    }

    // 生成文件名：agentId + 时间戳 + hash（防止缓存问题）
    const timestamp = Date.now()
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex').substring(0, 8)
    const fileName = `${agentId}_${timestamp}_${hash}${ext}`
    const targetPath = path.join(this.avatarDir, fileName)

    // 删除该 agent 的旧头像
    await this.deleteAgentAvatars(agentId)

    // 保存新头像
    await fs.writeFile(targetPath, fileBuffer)
    console.log('✅ Avatar saved:', fileName)

    return fileName
  }

  /**
   * 删除 agent 的所有头像文件
   * @param agentId Agent ID
   */
  static async deleteAgentAvatars(agentId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.avatarDir)
      const agentFiles = files.filter((file) => file.startsWith(`${agentId}_`))

      await Promise.all(
        agentFiles.map((file) =>
          fs
            .unlink(path.join(this.avatarDir, file))
            .catch((err) => console.warn('Failed to delete avatar:', file, err))
        )
      )

      if (agentFiles.length > 0) {
        console.log(`✅ Deleted ${agentFiles.length} old avatar(s) for agent ${agentId}`)
      }
    } catch (error) {
      console.error('Failed to delete agent avatars:', error)
    }
  }

  /**
   * 获取头像的完整路径
   * @param fileName 文件名
   * @returns 返回完整路径
   */
  static getAvatarPath(fileName: string): string {
    return path.join(this.avatarDir, fileName)
  }

  /**
   * 检查头像文件是否存在
   * @param fileName 文件名
   * @returns 返回是否存在
   */
  static async avatarExists(fileName: string): Promise<boolean> {
    try {
      const filePath = this.getAvatarPath(fileName)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 读取头像文件为 Base64
   * @param fileName 文件名
   * @returns 返回 Base64 编码的字符串（包含 data URI 前缀）
   */
  static async readAvatarAsBase64(fileName: string): Promise<string> {
    const filePath = this.getAvatarPath(fileName)
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(fileName).toLowerCase()

    // 确定 MIME 类型
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }

    const mimeType = mimeTypes[ext] || 'image/png'
    const base64 = buffer.toString('base64')

    return `data:${mimeType};base64,${base64}`
  }

  /**
   * 读取任意路径的图片文件为 Base64（用于预览）
   * @param filePath 文件的完整路径
   * @returns 返回 Base64 编码的字符串（包含 data URI 前缀）
   */
  static async readFileAsBase64(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // 确定 MIME 类型
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }

    const mimeType = mimeTypes[ext] || 'image/png'
    const base64 = buffer.toString('base64')

    return `data:${mimeType};base64,${base64}`
  }

  /**
   * 清理孤立的头像文件（没有对应的 agent）
   * @param existingAgentIds 当前存在的所有 agent ID 列表
   */
  static async cleanupOrphanedAvatars(existingAgentIds: string[]): Promise<void> {
    try {
      const files = await fs.readdir(this.avatarDir)
      let deletedCount = 0

      for (const file of files) {
        // 提取 agentId（文件名格式：agentId_timestamp_hash.ext）
        const agentId = file.split('_')[0]

        if (!existingAgentIds.includes(agentId)) {
          await fs.unlink(path.join(this.avatarDir, file))
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        console.log(`✅ Cleaned up ${deletedCount} orphaned avatar(s)`)
      }
    } catch (error) {
      console.error('Failed to cleanup orphaned avatars:', error)
    }
  }
}
