import { Menu, MenuItemConstructorOptions, app } from 'electron'
import { ConfigService } from './config.service'
import { sendToRenderer } from '../utils/ipc'

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
                { role: 'about' as const, label: '关于 Circle' },
                { type: 'separator' as const },
                { role: 'hide' as const, label: '隐藏 Circle' },
                { role: 'hideOthers' as const, label: '隐藏其他' },
                { role: 'unhide' as const, label: '全部显示' },
                { type: 'separator' as const },
                {
                  label: '重启应用',
                  click: () => {
                    app.relaunch()
                    app.quit()
                  }
                },
                { role: 'quit' as const, label: '退出 Circle' }
              ]
            }
          ]
        : []),

      // 文件菜单
      {
        label: '文件',
        submenu: [
          {
            label: '打开项目...',
            accelerator: 'CmdOrCtrl+O',
            click: () => sendToRenderer('menu:open-project', {})
          },
          {
            label: '最近打开',
            submenu: this.buildRecentProjectsMenu()
          },
          { type: 'separator' },
          {
            label: '保存',
            accelerator: 'CmdOrCtrl+S',
            click: () => sendToRenderer('menu:save-file', {})
          },
          {
            label: '全部保存',
            accelerator: 'CmdOrCtrl+Alt+S',
            click: () => sendToRenderer('menu:save-all', {})
          },
          { type: 'separator' },
          {
            label: '关闭项目',
            accelerator: 'CmdOrCtrl+K CmdOrCtrl+F',
            click: () => sendToRenderer('menu:close-workspace', {})
          },
          { type: 'separator' },
          {
            label: '设置',
            accelerator: 'CmdOrCtrl+,',
            click: () => sendToRenderer('menu:open-settings', {})
          },
          ...(!isMac
            ? [
                { type: 'separator' as const },
                {
                  label: '重启应用',
                  click: () => {
                    app.relaunch()
                    app.quit()
                  }
                },
                { type: 'separator' as const },
                { role: 'quit' as const, label: '退出' }
              ]
            : [])
        ]
      },

      // 编辑菜单
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'selectAll', label: '全选' }
        ]
      },

      // 视图菜单
      {
        label: '视图',
        submenu: [
          {
            label: '切换左侧边栏',
            accelerator: 'CmdOrCtrl+B',
            click: () => sendToRenderer('menu:toggle-sidebar', {})
          },
          {
            label: '切换右侧边栏',
            accelerator: 'CmdOrCtrl+Alt+B',
            click: () => sendToRenderer('menu:toggle-chat', {})
          },
          {
            label: '切换控制台',
            accelerator: 'CmdOrCtrl+J',
            click: () => sendToRenderer('menu:toggle-terminal', {})
          },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '全屏' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          ...(isDev
            ? [
                { type: 'separator' as const },
                { role: 'forceReload' as const, label: '重新加载' },
                { role: 'toggleDevTools' as const, label: '开发者工具' }
              ]
            : [])
        ]
      },

      // 窗口菜单
      ...(isMac
        ? [
            {
              label: '窗口',
              submenu: [
                { role: 'minimize' as const, label: '最小化' },
                { role: 'zoom' as const, label: '缩放' },
                { type: 'separator' as const },
                { role: 'front' as const, label: '前置所有窗口' }
              ]
            }
          ]
        : []),

      // 帮助菜单
      {
        label: '帮助',
        submenu: [
          {
            label: '报告问题...',
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
          label: '无最近项目',
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
