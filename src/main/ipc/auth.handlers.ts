import { ipcMain } from 'electron'
import { UserService } from '../services/user.service'
import { LocalSyncService } from '../services/local-sync.service'

/**
 * 认证相关 IPC 处理器
 */
export function registerAuthHandlers() {
  /**
   * 注册账号
   */
  ipcMain.handle('auth:register', async (_, { email, displayName }) => {
    try {
      const userService = UserService.getInstance()

      // 注册本地账号（将当前默认用户关联到邮箱）
      const user = await userService.registerLocal(email, displayName)

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName
        }
      }
    } catch (error: any) {
      console.error('[IPC] Register failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * 登录账号
   */
  ipcMain.handle('auth:login', async (_, { email, mergeStrategy }) => {
    try {
      const userService = UserService.getInstance()
      const syncService = LocalSyncService.getInstance()

      // 获取当前用户
      const currentUser = userService.getCurrentUser()
      if (!currentUser) {
        throw new Error('No current user found')
      }

      // 查找目标账号
      const targetUser = await userService.getUserByEmail(email)
      if (!targetUser) {
        throw new Error('账号不存在，请先注册')
      }

      // 如果已经是当前用户，无需合并
      if (currentUser.id === targetUser.id) {
        return {
          success: true,
          message: 'Already logged in',
          conflicts: null,
          mergeResult: null
        }
      }

      // 合并数据
      const mergeResult = await syncService.mergeUsers(currentUser.id, targetUser.id, mergeStrategy)

      // 切换到目标用户
      await userService.loginLocal(email)

      return {
        success: true,
        conflicts: mergeResult.conflicts,
        mergeResult: {
          memoriesAdded: mergeResult.memoriesAdded,
          memoriesUpdated: mergeResult.memoriesUpdated,
          memoriesSkipped: mergeResult.memoriesSkipped,
          projectsAdded: mergeResult.projectsAdded,
          projectsUpdated: mergeResult.projectsUpdated,
          projectsSkipped: mergeResult.projectsSkipped
        }
      }
    } catch (error: any) {
      console.error('[IPC] Login failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * 获取当前用户信息
   */
  ipcMain.handle('auth:getCurrentUser', async () => {
    try {
      const userService = UserService.getInstance()
      const user = userService.getCurrentUser()

      if (!user) {
        return {
          success: false,
          error: 'No user found'
        }
      }

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          preferences: user.preferences
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * 合并更新当前用户的 preferences（JSON）
   */
  ipcMain.handle('auth:updatePreferences', async (_, partial: Record<string, unknown>) => {
    try {
      const userService = UserService.getInstance()
      const user = await userService.mergePreferences(partial)
      return {
        success: true,
        preferences: user.preferences
      }
    } catch (error: any) {
      console.error('[IPC] updatePreferences failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * 登出（切换回默认用户）
   */
  ipcMain.handle('auth:logout', async () => {
    try {
      const userService = UserService.getInstance()

      // 重新初始化，会创建/获取默认用户
      await userService.initialize()

      return {
        success: true
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  console.log('[IPC] Auth handlers registered')
}
