/**
 * Auto-updater IPC Handlers
 */
import { ipcMain } from 'electron'
import { autoUpdaterService } from '../services/auto-updater.service'

export function registerAutoUpdaterHandlers(): void {
  // Check for updates
  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdaterService.checkForUpdates()
      return { success: true }
    } catch (error) {
      console.error('[AutoUpdater] Check failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Download update
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdaterService.downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('[AutoUpdater] Download failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Quit and install
  ipcMain.handle('updater:quitAndInstall', () => {
    try {
      autoUpdaterService.quitAndInstall()
      return { success: true }
    } catch (error) {
      console.error('[AutoUpdater] Quit and install failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  console.log('[AutoUpdater] Handlers registered')
}
