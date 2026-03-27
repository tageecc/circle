import { Menu, MenuItemConstructorOptions, app } from 'electron'
import { ConfigService } from './config.service'
import { sendToRenderer } from '../utils/ipc'
import { mainI18n as i18n } from '../i18n'

export class MenuService {
  private menu: Menu | null = null

  constructor(private configService: ConfigService) {}

  createMenu(): Menu {
    const isMac = process.platform === 'darwin'
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    const template: MenuItemConstructorOptions[] = [
      // macOS 应用菜单
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const, label: i18n.t('menu.about_circle') },
                { type: 'separator' as const },
                { role: 'hide' as const, label: i18n.t('menu.hide_circle') },
                { role: 'hideOthers' as const, label: i18n.t('menu.hide_others') },
                { role: 'unhide' as const, label: i18n.t('menu.show_all') },
                { type: 'separator' as const },
                {
                  label: i18n.t('menu.restart_app'),
                  click: () => {
                    app.relaunch()
                    app.quit()
                  }
                },
                { role: 'quit' as const, label: i18n.t('menu.quit_circle') }
              ]
            }
          ]
        : []),

      // 文件菜单
      {
        label: i18n.t('menu.file'),
        submenu: [
          {
            label: i18n.t('menu.open_project'),
            accelerator: 'CmdOrCtrl+O',
            click: () => sendToRenderer('menu:open-project', {})
          },
          {
            label: i18n.t('menu.recent_projects'),
            submenu: this.buildRecentProjectsMenu()
          },
          { type: 'separator' },
          {
            label: i18n.t('menu.save'),
            accelerator: 'CmdOrCtrl+S',
            click: () => sendToRenderer('menu:save-file', {})
          },
          {
            label: i18n.t('menu.save_all'),
            accelerator: 'CmdOrCtrl+Alt+S',
            click: () => sendToRenderer('menu:save-all', {})
          },
          { type: 'separator' },
          {
            label: i18n.t('menu.close_project'),
            accelerator: 'CmdOrCtrl+K CmdOrCtrl+F',
            click: () => sendToRenderer('menu:close-workspace', {})
          },
          { type: 'separator' },
          {
            label: i18n.t('menu.settings'),
            accelerator: 'CmdOrCtrl+,',
            click: () => sendToRenderer('menu:open-settings', {})
          },
          ...(!isMac
            ? [
                { type: 'separator' as const },
                {
                  label: i18n.t('menu.restart_app'),
                  click: () => {
                    app.relaunch()
                    app.quit()
                  }
                },
                { type: 'separator' as const },
                { role: 'quit' as const, label: i18n.t('menu.quit') }
              ]
            : [])
        ]
      },

      // 编辑菜单
      {
        label: i18n.t('menu.edit'),
        submenu: [
          { role: 'undo', label: i18n.t('menu.undo') },
          { role: 'redo', label: i18n.t('menu.redo') },
          { type: 'separator' },
          { role: 'cut', label: i18n.t('menu.cut') },
          { role: 'copy', label: i18n.t('menu.copy') },
          { role: 'paste', label: i18n.t('menu.paste') },
          { role: 'selectAll', label: i18n.t('menu.select_all') }
        ]
      },

      // 视图菜单
      {
        label: i18n.t('menu.view'),
        submenu: [
          {
            label: i18n.t('menu.toggle_left_sidebar'),
            accelerator: 'CmdOrCtrl+B',
            click: () => sendToRenderer('menu:toggle-sidebar', {})
          },
          {
            label: i18n.t('menu.toggle_right_sidebar'),
            accelerator: 'CmdOrCtrl+Alt+B',
            click: () => sendToRenderer('menu:toggle-chat', {})
          },
          {
            label: i18n.t('menu.toggle_console'),
            accelerator: 'CmdOrCtrl+J',
            click: () => sendToRenderer('menu:toggle-terminal', {})
          },
          { type: 'separator' },
          { role: 'togglefullscreen', label: i18n.t('menu.fullscreen') },
          { type: 'separator' },
          { role: 'resetZoom', label: i18n.t('menu.actual_size') },
          { role: 'zoomIn', label: i18n.t('menu.zoom_in') },
          { role: 'zoomOut', label: i18n.t('menu.zoom_out') },
          ...(isDev
            ? [
                { type: 'separator' as const },
                { role: 'forceReload' as const, label: i18n.t('menu.reload') },
                { role: 'toggleDevTools' as const, label: i18n.t('menu.dev_tools') }
              ]
            : [])
        ]
      },

      // 窗口菜单
      ...(isMac
        ? [
            {
              label: i18n.t('menu.window'),
              submenu: [
                { role: 'minimize' as const, label: i18n.t('menu.minimize') },
                { role: 'zoom' as const, label: i18n.t('menu.zoom_window') },
                { type: 'separator' as const },
                { role: 'front' as const, label: i18n.t('menu.bring_all_to_front') }
              ]
            }
          ]
        : []),

      // 帮助菜单
      {
        label: i18n.t('menu.help'),
        submenu: [
          {
            label: i18n.t('menu.report_issue'),
            click: () => sendToRenderer('menu:report-bug', {})
          }
        ]
      }
    ]

    this.menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(this.menu)
    return this.menu
  }

  private buildRecentProjectsMenu(): MenuItemConstructorOptions[] {
    const recentProjects = this.configService.getRecentProjects()

    if (recentProjects.length === 0) {
      return [
        {
          label: i18n.t('menu.no_recent_projects'),
          enabled: false
        }
      ]
    }

    return recentProjects.slice(0, 10).map((project) => ({
      label: project.name,
      sublabel: project.path,
      click: () => sendToRenderer('menu:open-recent-project', { path: project.path })
    }))
  }
}
