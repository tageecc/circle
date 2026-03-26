import { getDb } from '../database/db'
import * as schema from '../database/schema'
import { eq } from 'drizzle-orm'
import { MachineIdService } from './machine-id.service'
import { nanoid } from 'nanoid'

export interface User {
  id: string
  deviceId: string
  username: string
  displayName: string
  avatar?: string
  preferences: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

/**
 * 用户服务
 * 简化版本：只支持设备用户模式，无注册/登录功能
 */
export class UserService {
  private static instance: UserService
  private currentUser: User | null = null
  private deviceId: string

  private constructor() {
    this.deviceId = MachineIdService.getInstance().getMachineId()
  }

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  getDeviceId(): string {
    return this.deviceId
  }

  async initialize(): Promise<User> {
    console.log('[UserService] Initializing device user...')
    console.log('[UserService] Device ID:', this.deviceId)

    const db = getDb().getDb()

    const [existingUser] = db
      .select()
      .from(schema.deviceUser)
      .where(eq(schema.deviceUser.deviceId, this.deviceId))
      .limit(1)
      .all()

    if (existingUser) {
      this.currentUser = {
        id: existingUser.id,
        deviceId: existingUser.deviceId,
        username: existingUser.username,
        displayName: existingUser.displayName,
        avatar: existingUser.avatar || undefined,
        preferences: JSON.parse(existingUser.preferences),
        createdAt: new Date(existingUser.createdAt),
        updatedAt: new Date(existingUser.updatedAt)
      }
      console.log('[UserService] Found existing device user:', this.currentUser.id)
      return this.currentUser
    }

    const machineIdService = MachineIdService.getInstance()
    const username = machineIdService.generateUsername()
    const displayName = machineIdService.generateDisplayName()
    const now = new Date()
    const userId = `user_${nanoid()}`

    const [newUser] = db
      .insert(schema.deviceUser)
      .values({
        id: userId,
        deviceId: this.deviceId,
        username,
        displayName,
        avatar: null,
        preferences: JSON.stringify({
          theme: 'dark',
          language: 'zh-CN'
        }),
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .all()

    this.currentUser = {
      id: newUser.id,
      deviceId: newUser.deviceId,
      username: newUser.username,
      displayName: newUser.displayName,
      avatar: newUser.avatar || undefined,
      preferences: JSON.parse(newUser.preferences),
      createdAt: new Date(newUser.createdAt),
      updatedAt: new Date(newUser.updatedAt)
    }

    console.log('[UserService] Created new device user:', this.currentUser.id)
    return this.currentUser
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  async updatePreferences(preferences: Record<string, unknown>): Promise<void> {
    if (!this.currentUser) {
      throw new Error('User not initialized')
    }

    const db = getDb().getDb()
    const now = new Date()

    db.update(schema.deviceUser)
      .set({
        preferences: JSON.stringify(preferences),
        updatedAt: now
      })
      .where(eq(schema.deviceUser.id, this.currentUser.id))
      .run()

    this.currentUser.preferences = preferences
    this.currentUser.updatedAt = now
  }

  async updateProfile(updates: { displayName?: string; avatar?: string }): Promise<void> {
    if (!this.currentUser) {
      throw new Error('User not initialized')
    }

    const db = getDb().getDb()
    const now = new Date()

    const updateData: any = { updatedAt: now }
    if (updates.displayName !== undefined) {
      updateData.displayName = updates.displayName
    }
    if (updates.avatar !== undefined) {
      updateData.avatar = updates.avatar
    }

    db.update(schema.deviceUser)
      .set(updateData)
      .where(eq(schema.deviceUser.id, this.currentUser.id))
      .run()

    if (updates.displayName !== undefined) {
      this.currentUser.displayName = updates.displayName
    }
    if (updates.avatar !== undefined) {
      this.currentUser.avatar = updates.avatar
    }
    this.currentUser.updatedAt = now
  }
}
