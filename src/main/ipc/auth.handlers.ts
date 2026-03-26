import { ipcMain } from 'electron'
import { UserService } from '../services/user.service'

/**
 * 认证相关 IPC 处理器
 * 简化版本：只支持设备用户模式
 */
export function registerAuthHandlers() {
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
          error: 'User not initialized'
        }
      }

      return {
        success: true,
        user: {
          id: user.id,
          deviceId: user.deviceId,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          preferences: user.preferences
        }
      }
    } catch (error: any) {
      console.error('[IPC] Get current user failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * 更新用户资料
   */
  ipcMain.handle(
    'auth:updateProfile',
    async (_, updates: { displayName?: string; avatar?: string }) => {
      try {
        const userService = UserService.getInstance()
        await userService.updateProfile(updates)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[IPC] Update profile failed:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * 更新用户偏好设置
   */
  ipcMain.handle('auth:updatePreferences', async (_, preferences: Record<string, unknown>) => {
    try {
      const userService = UserService.getInstance()
      await userService.updatePreferences(preferences)

      return {
        success: true
      }
    } catch (error: any) {
      console.error('[IPC] Update preferences failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
}
