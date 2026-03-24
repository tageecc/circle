import { getDatabase } from '../database/client'
import { users, type User } from '../database/schema.sqlite'
import { eq } from 'drizzle-orm'

function getDb() {
  return getDatabase()
}

/**
 * 用户管理服务
 * 负责用户创建、查询、更新
 *
 * 工作模式：
 * - 本地单用户模式：基于机器标识自动创建唯一用户
 * - 每台电脑一个用户，无需注册登录
 * - 自动迁移旧数据
 */
export class UserService {
  private static instance: UserService
  private currentUser: User | null = null

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  /**
   * 初始化用户系统（应用启动时调用）
   */
  async initialize(): Promise<User> {
    // 1. 获取或创建用户
    const user = await this.getOrCreateDefaultUser()
    this.currentUser = user

    // 2. 检查并迁移旧数据
    const { MigrationService } = await import('./migration.service')
    const migrationService = MigrationService.getInstance()

    const needsMigration = await migrationService.needsMigration()
    if (needsMigration) {
      console.log('[UserService] Detected old data, starting migration...')
      const result = await migrationService.migrateOldDataToCurrentUser(user.id)
      console.log('[UserService] Migration completed:', result)
    }

    return user
  }

  /**
   * 获取当前用户
   */
  getCurrentUser(): User | null {
    return this.currentUser
  }

  /**
   * 创建或获取用户（基于机器标识自动创建）
   * 每台电脑自动生成唯一用户，无需注册登录
   */
  async getOrCreateDefaultUser(): Promise<User> {
    const { MachineIdService } = await import('./machine-id.service')
    const machineIdService = MachineIdService.getInstance()

    // 生成基于机器的唯一用户名
    const username = machineIdService.generateUsername()
    const displayName = machineIdService.generateDisplayName()

    // 尝试获取该机器的用户
    const [existingUser] = await getDb()
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (existingUser) {
      // 更新最后登录时间
      await this.updateLastLogin(existingUser.id)
      return existingUser
    }

    // 创建新用户
    const [newUser] = await getDb()
      .insert(users)
      .values({
        username,
        displayName,
        preferences: JSON.stringify({ theme: 'dark', language: 'zh-CN' })
      })
      .returning()

    console.log('[UserService] Created machine-based user:', newUser.id, username)
    return newUser
  }

  /**
   * 创建新用户
   */
  async createUser(data: {
    username: string
    email?: string
    displayName?: string
    avatar?: string
  }): Promise<User> {
    const [user] = await getDb()
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        displayName: data.displayName || data.username,
        avatar: data.avatar,
        preferences: '{}'
      })
      .returning()

    console.log('[UserService] User created:', user.id)
    return user
  }

  /**
   * 获取用户
   */
  async getUser(userId: string): Promise<User | null> {
    const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1)

    return user || null
  }

  /**
   * 通过用户名获取用户
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1)

    return user || null
  }

  /**
   * 更新用户
   */
  async updateUser(
    userId: string,
    data: {
      displayName?: string
      email?: string
      avatar?: string
      preferences?: Record<string, any>
    }
  ): Promise<User> {
    const { preferences, ...rest } = data
    const [updated] = await getDb()
      .update(users)
      .set({
        ...rest,
        ...(preferences !== undefined ? { preferences: JSON.stringify(preferences) } : {}),
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, userId))
      .returning()

    if (!updated) {
      throw new Error(`User not found: ${userId}`)
    }

    console.log('[UserService] User updated:', userId)
    return updated
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(userId: string): Promise<void> {
    await getDb()
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, userId))
  }

  /**
   * 本地注册（将当前默认用户关联到邮箱）
   */
  async registerLocal(email: string, displayName?: string): Promise<User> {
    if (!this.currentUser) {
      throw new Error('No current user found')
    }

    // 检查邮箱是否已被使用
    const existing = await this.getUserByEmail(email)
    if (existing) {
      throw new Error('Email already registered')
    }

    // 更新当前用户，添加邮箱
    const updated = await this.updateUser(this.currentUser.id, {
      email,
      displayName: displayName || email.split('@')[0]
    })

    this.currentUser = updated
    console.log('[UserService] Registered local user:', email)
    return updated
  }

  /**
   * 本地登录（切换到另一个邮箱账号）
   */
  async loginLocal(email: string): Promise<User | null> {
    // 查找该邮箱的用户
    const user = await this.getUserByEmail(email)
    if (!user) {
      throw new Error('Account not found. Please register first.')
    }

    // 更新最后登录时间
    await this.updateLastLogin(user.id)

    // 切换当前用户
    this.currentUser = user
    console.log('[UserService] Switched to user:', email)
    return user
  }

  /**
   * 通过邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1)

    return user || null
  }

  /**
   * 合并写入 preferences（JSON），用于 AI 用户规则等
   */
  async mergePreferences(partial: Record<string, unknown>): Promise<User> {
    const user = this.currentUser
    if (!user) {
      throw new Error('No current user')
    }
    let current: Record<string, unknown> = {}
    try {
      current = user.preferences ? JSON.parse(user.preferences) : {}
    } catch {
      current = {}
    }
    const merged = { ...current, ...partial }
    const updated = await this.updateUser(user.id, { preferences: merged })
    this.currentUser = updated
    return updated
  }
}
