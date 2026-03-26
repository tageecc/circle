/**
 * Message Snapshot Service
 * 管理消息级别的文件快照，用于回滚功能
 */

import { promises as fs } from 'fs'
import { getDb } from '../database/db'
import * as crypto from 'crypto'

export interface FileSnapshot {
  content: string
  contentHash: string
  action: 'create' | 'edit' | 'delete'
  size: number
}

export interface MessageSnapshot {
  messageId: number
  sessionId: string
  timestamp: number
  files: {
    [absolutePath: string]: FileSnapshot
  }
}

export class MessageSnapshotService {
  private static instance: MessageSnapshotService
  private db = getDb()

  private constructor() {}

  static getInstance(): MessageSnapshotService {
    if (!MessageSnapshotService.instance) {
      MessageSnapshotService.instance = new MessageSnapshotService()
    }
    return MessageSnapshotService.instance
  }

  /**
   * 创建快照
   */
  async createSnapshot(snapshot: MessageSnapshot): Promise<void> {
    console.log(`[Snapshot] Creating snapshot for message: ${snapshot.messageId}`)
    console.log(`[Snapshot] Files: ${Object.keys(snapshot.files).length}`)

    this.db.saveSnapshot({
      messageId: snapshot.messageId,
      sessionId: snapshot.sessionId,
      timestamp: new Date(snapshot.timestamp),
      snapshotData: JSON.stringify(snapshot.files)
    })
  }

  /**
   * 获取快照
   */
  async getSnapshot(messageId: number): Promise<MessageSnapshot | null> {
    const row = this.db.getSnapshot(messageId)
    if (!row) return null

    return {
      messageId: row.messageId,
      sessionId: row.sessionId,
      timestamp: row.timestamp.getTime(),
      files: JSON.parse(row.snapshotData)
    }
  }

  /**
   * 获取受影响的文件列表（用于 UI 显示）
   */
  async getAffectedFiles(messageId: number): Promise<
    {
      path: string
      action: 'create' | 'edit' | 'delete'
      size: number
    }[]
  > {
    const snapshot = await this.getSnapshot(messageId)
    if (!snapshot) return []

    return Object.entries(snapshot.files).map(([path, data]) => ({
      path,
      action: data.action,
      size: data.size
    }))
  }

  /**
   * 恢复文件到快照状态
   */
  async restoreFiles(messageId: number): Promise<{
    success: boolean
    filesRestored: number
    files: string[]
  }> {
    const snapshot = await this.getSnapshot(messageId)
    if (!snapshot) {
      throw new Error('Snapshot not found')
    }

    console.log(`[Snapshot] Restoring ${Object.keys(snapshot.files).length} files`)

    const restoredFiles: string[] = []

    for (const [filePath, fileData] of Object.entries(snapshot.files)) {
      try {
        if (fileData.action === 'delete') {
          // 如果原本是删除操作，现在恢复删除（先检查文件是否存在）
          try {
            await fs.access(filePath)
            await fs.unlink(filePath)
            console.log(`[Snapshot] Deleted: ${filePath}`)
          } catch (err: any) {
            if (err.code === 'ENOENT') {
              console.log(`[Snapshot] File already deleted: ${filePath}`)
            } else {
              throw err
            }
          }
        } else {
          // 恢复文件内容
          await fs.writeFile(filePath, fileData.content, 'utf-8')
          console.log(`[Snapshot] Restored: ${filePath}`)
        }
        restoredFiles.push(filePath)
      } catch (error) {
        console.error(`[Snapshot] Failed to restore file: ${filePath}`, error)
      }
    }

    return {
      success: true,
      filesRestored: restoredFiles.length,
      files: restoredFiles
    }
  }

  /**
   * 计算内容哈希
   */
  hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex')
  }

}
