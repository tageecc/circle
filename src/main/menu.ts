import { Menu, BrowserWindow } from 'electron'

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
      : [{ label: '无最近项目', enabled: false }]

  return [
    { label: '打开...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('openProject') },
    { label: '打开文件夹...', click: () => sendMenuAction('openProject') },
    { type: 'separator' },
    { label: '打开最近', submenu: recentItems },
    { type: 'separator' },
    { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('saveFile') },
    { type: 'separator' },
    { label: '关闭编辑器', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('closeFile') },
    { label: '关闭文件夹', click: () => sendMenuAction('closeWorkspace') }
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
    { label: '文件', submenu: buildFileSubmenu() },
    {
      label: '编辑',
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
      label: '视图',
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
      label: '帮助',
      submenu: [
        { label: '调试配置', click: () => sendMenuAction('debugConfig') },
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
