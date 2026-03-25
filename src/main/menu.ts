import { Menu, BrowserWindow } from 'electron'
import { t } from './utils/i18n'

let cachedRecent: { path: string; name: string }[] = []

function sendMenuAction(action: string, path?: string): void {
  const win = BrowserWindow.getFocusedWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:menu-action', { action, path })
  }
}

function buildFileSubmenu(): Electron.MenuItemConstructorOptions[] {
  const recentItems: Electron.MenuItemConstructorOptions[] =
    cachedRecent.length > 0
      ? cachedRecent.slice(0, 10).map((p) => ({
          label: p.name.length > 40 ? p.name.slice(0, 37) + '...' : p.name,
          click: () => sendMenuAction('openRecent', p.path)
        }))
      : [{ label: t('menu.file.noRecentProjects'), enabled: false }]

  return [
    {
      label: t('menu.file.open'),
      accelerator: 'CmdOrCtrl+O',
      click: () => sendMenuAction('openProject')
    },
    { label: t('menu.file.openFolder'), click: () => sendMenuAction('openProject') },
    { type: 'separator' },
    { label: t('menu.file.openRecent'), submenu: recentItems },
    { type: 'separator' },
    {
      label: t('menu.file.save'),
      accelerator: 'CmdOrCtrl+S',
      click: () => sendMenuAction('saveFile')
    },
    { type: 'separator' },
    {
      label: t('menu.file.closeEditor'),
      accelerator: 'CmdOrCtrl+W',
      click: () => sendMenuAction('closeFile')
    },
    { label: t('menu.file.closeFolder'), click: () => sendMenuAction('closeWorkspace') }
  ]
}

export function setupNativeMenu(): void {
  if (process.platform !== 'darwin') return

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Circle',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' },
        { role: 'services' as const },
        { type: 'separator' },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' },
        { role: 'quit' as const }
      ]
    },
    { label: t('menu.file.label'), submenu: buildFileSubmenu() },
    {
      label: t('menu.edit.label'),
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const }
      ]
    },
    {
      label: t('menu.view.label'),
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: t('menu.help.label'),
      submenu: [
        { label: t('menu.help.debugConfig'), click: () => sendMenuAction('debugConfig') },
        { type: 'separator' },
        { role: 'about' as const }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * 更新「打开最近」子菜单（由渲染进程在 recentProjects 变化时调用）
 */
export function updateRecentProjectsMenu(recent: { path: string; name: string }[]): void {
  if (process.platform !== 'darwin') return
  cachedRecent = recent
  setupNativeMenu()
}
