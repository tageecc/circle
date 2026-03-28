/**
 * Auto-updater service for checking and installing updates
 */
import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog } from 'electron'
import log from 'electron-log'

// Configure logging
autoUpdater.logger = log
log.transports.file.level = 'info'

export class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null
  private updateCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    this.setupAutoUpdater()
  }

  private setupAutoUpdater(): void {
    // Configure updater
    autoUpdater.autoDownload = false // Don't auto-download, let user decide
    autoUpdater.autoInstallOnAppQuit = true

    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info)
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-available', info)
      }
    })

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info)
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-not-available', info)
      }
    })

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info)
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-downloaded', info)
      }

      // Show install dialog
      if (!this.mainWindow) return

      dialog
        .showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Ready',
          message: 'A new version has been downloaded.',
          detail: 'The update will be installed when you restart Circle.',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        .then((result) => {
          if (result.response === 0) {
            // Quit and install
            autoUpdater.quitAndInstall(false, true)
          }
        })
    })

    // Download progress
    autoUpdater.on('download-progress', (progress) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('download-progress', progress)
      }
    })

    // Error
    autoUpdater.on('error', (error) => {
      log.error('Update error:', error)
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-error', error.message)
      }
    })
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public async checkForUpdates(): Promise<void> {
    try {
      // Skip in development
      if (process.env.NODE_ENV === 'development') {
        log.info('Skipping update check in development mode')
        return
      }

      log.info('Checking for updates...')
      await autoUpdater.checkForUpdates()
    } catch (error) {
      log.error('Failed to check for updates:', error)
    }
  }

  public async downloadUpdate(): Promise<void> {
    try {
      log.info('Downloading update...')
      await autoUpdater.downloadUpdate()
    } catch (error) {
      log.error('Failed to download update:', error)
    }
  }

  public startAutoCheck(intervalHours = 4): void {
    // Check immediately
    this.checkForUpdates()

    // Then check periodically
    this.updateCheckInterval = setInterval(
      () => {
        this.checkForUpdates()
      },
      intervalHours * 60 * 60 * 1000
    )
  }

  public stopAutoCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }

  public quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }
}

// Export singleton instance
export const autoUpdaterService = new AutoUpdaterService()
