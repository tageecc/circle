export interface KeyBinding {
  command: string
  key: string
  when?: string
}

export interface KeymapProfile {
  name: string
  bindings: Record<string, string>
}

export const COMMANDS = [
  // 文件操作
  { id: 'file.save', label: '保存', category: '文件' },
  { id: 'file.saveAll', label: '全部保存', category: '文件' },
  { id: 'file.new', label: '新建文件', category: '文件' },
  { id: 'file.open', label: '打开文件', category: '文件' },
  { id: 'file.close', label: '关闭文件', category: '文件' },

  // 编辑操作
  { id: 'editor.undo', label: '撤销', category: '编辑' },
  { id: 'editor.redo', label: '重做', category: '编辑' },
  { id: 'editor.cut', label: '剪切', category: '编辑' },
  { id: 'editor.copy', label: '复制', category: '编辑' },
  { id: 'editor.paste', label: '粘贴', category: '编辑' },
  { id: 'editor.find', label: '查找', category: '编辑' },
  { id: 'editor.replace', label: '替换', category: '编辑' },
  { id: 'editor.findInFiles', label: '在文件中查找', category: '编辑' },
  { id: 'editor.toggleLineComment', label: '切换行注释', category: '编辑' },
  { id: 'editor.toggleBlockComment', label: '切换块注释', category: '编辑' },
  { id: 'editor.duplicateLine', label: '复制当前行', category: '编辑' },
  { id: 'editor.moveLineUp', label: '向上移动行', category: '编辑' },
  { id: 'editor.moveLineDown', label: '向下移动行', category: '编辑' },
  { id: 'editor.deleteLine', label: '删除行', category: '编辑' },
  { id: 'editor.formatDocument', label: '格式化文档', category: '编辑' },

  // 导航
  { id: 'navigate.back', label: '后退', category: '导航' },
  { id: 'navigate.forward', label: '前进', category: '导航' },
  { id: 'navigate.goToLine', label: '跳转到行', category: '导航' },
  { id: 'navigate.goToDefinition', label: '跳转到定义', category: '导航' },
  { id: 'navigate.goToImplementation', label: '跳转到实现', category: '导航' },
  { id: 'navigate.findUsages', label: '查找引用', category: '导航' },
  { id: 'navigate.searchEverything', label: '随处搜索', category: '导航' },
  { id: 'navigate.quickOpen', label: '快速打开', category: '导航' },

  // 视图
  { id: 'view.toggleSidebar', label: '切换侧边栏', category: '视图' },
  { id: 'view.toggleTerminal', label: '切换终端', category: '视图' },
  { id: 'view.zoomIn', label: '放大', category: '视图' },
  { id: 'view.zoomOut', label: '缩小', category: '视图' },
  { id: 'view.resetZoom', label: '重置缩放', category: '视图' },
  { id: 'view.nextTab', label: '下一个标签页', category: '视图' },
  { id: 'view.previousTab', label: '上一个标签页', category: '视图' },

  // 调试
  { id: 'debug.start', label: '开始调试', category: '调试' },
  { id: 'debug.stop', label: '停止调试', category: '调试' },
  { id: 'debug.stepOver', label: '单步跳过', category: '调试' },
  { id: 'debug.stepInto', label: '单步进入', category: '调试' },
  { id: 'debug.toggleBreakpoint', label: '切换断点', category: '调试' }
]

export const KEYMAP_PRESETS: Record<string, KeymapProfile> = {
  vscode: {
    name: 'VS Code',
    bindings: {
      'file.save': 'Meta+S',
      'file.saveAll': 'Meta+Alt+S',
      'file.new': 'Meta+N',
      'file.open': 'Meta+O',
      'file.close': 'Meta+W',
      'editor.undo': 'Meta+Z',
      'editor.redo': 'Meta+Shift+Z',
      'editor.cut': 'Meta+X',
      'editor.copy': 'Meta+C',
      'editor.paste': 'Meta+V',
      'editor.find': 'Meta+F',
      'editor.replace': 'Meta+Alt+F',
      'editor.findInFiles': 'Meta+Shift+F',
      'editor.toggleLineComment': 'Meta+/',
      'editor.toggleBlockComment': 'Shift+Alt+A',
      'editor.duplicateLine': 'Shift+Alt+Down',
      'editor.moveLineUp': 'Alt+Up',
      'editor.moveLineDown': 'Alt+Down',
      'editor.deleteLine': 'Meta+Shift+K',
      'editor.formatDocument': 'Shift+Alt+F',
      'navigate.back': 'Ctrl+-',
      'navigate.forward': 'Ctrl+Shift+-',
      'navigate.goToLine': 'Ctrl+G',
      'navigate.goToDefinition': 'F12',
      'navigate.goToImplementation': 'Meta+F12',
      'navigate.findUsages': 'Shift+F12',
      'navigate.searchEverything': 'Meta+P',
      'navigate.quickOpen': 'Meta+P',
      'view.toggleSidebar': 'Meta+B',
      'view.toggleTerminal': 'Ctrl+`',
      'view.zoomIn': 'Meta+=',
      'view.zoomOut': 'Meta+-',
      'view.resetZoom': 'Meta+0',
      'view.nextTab': 'Meta+Shift+]',
      'view.previousTab': 'Meta+Shift+[',
      'debug.start': 'F5',
      'debug.stop': 'Shift+F5',
      'debug.stepOver': 'F10',
      'debug.stepInto': 'F11',
      'debug.toggleBreakpoint': 'F9'
    }
  },
  eclipse: {
    name: 'Eclipse (macOS)',
    bindings: {
      'file.save': 'Meta+S',
      'file.saveAll': 'Meta+Shift+S',
      'file.new': 'Meta+N',
      'file.open': 'Meta+O',
      'file.close': 'Meta+W',
      'editor.undo': 'Meta+Z',
      'editor.redo': 'Meta+Shift+Z',
      'editor.cut': 'Meta+X',
      'editor.copy': 'Meta+C',
      'editor.paste': 'Meta+V',
      'editor.find': 'Meta+F',
      'editor.replace': 'Meta+F', // Eclipse usually uses Find/Replace dialog for both
      'editor.findInFiles': 'Ctrl+H',
      'editor.toggleLineComment': 'Meta+/',
      'editor.toggleBlockComment': 'Ctrl+Shift+/',
      'editor.duplicateLine': 'Meta+Alt+Down',
      'editor.moveLineUp': 'Alt+Up',
      'editor.moveLineDown': 'Alt+Down',
      'editor.deleteLine': 'Meta+D',
      'editor.formatDocument': 'Meta+Shift+F',
      'navigate.back': 'Meta+[',
      'navigate.forward': 'Meta+]',
      'navigate.goToLine': 'Meta+L',
      'navigate.goToDefinition': 'F3',
      'navigate.goToImplementation': 'Meta+T', // Roughly corresponds to Open Type/Hierarchy
      'navigate.findUsages': 'Meta+Shift+G',
      'navigate.searchEverything': 'Meta+Shift+R', // Open Resource
      'navigate.quickOpen': 'Meta+Shift+R',
      'view.toggleSidebar': 'Meta+M', // Maximize active view/editor usually
      'view.toggleTerminal': 'Ctrl+`', // Not standard Eclipse but common modern addition
      'view.zoomIn': 'Meta+=',
      'view.zoomOut': 'Meta+-',
      'view.resetZoom': 'Meta+0',
      'view.nextTab': 'Meta+F6',
      'view.previousTab': 'Meta+Shift+F6',
      'debug.start': 'F11',
      'debug.stop': 'Meta+F2',
      'debug.stepOver': 'F6',
      'debug.stepInto': 'F5',
      'debug.toggleBreakpoint': 'Meta+Shift+B'
    }
  },
  intellij: {
    name: 'IntelliJ IDEA Classic (macOS)',
    bindings: {
      'file.save': 'Meta+S',
      'file.saveAll': 'Meta+S', // IDEA saves automatically usually
      'file.new': 'Meta+N',
      'file.open': 'Meta+O',
      'file.close': 'Meta+W',
      'editor.undo': 'Meta+Z',
      'editor.redo': 'Meta+Shift+Z',
      'editor.cut': 'Meta+X',
      'editor.copy': 'Meta+C',
      'editor.paste': 'Meta+V',
      'editor.find': 'Meta+F',
      'editor.replace': 'Meta+R',
      'editor.findInFiles': 'Meta+Shift+F',
      'editor.toggleLineComment': 'Meta+/',
      'editor.toggleBlockComment': 'Meta+Alt+/',
      'editor.duplicateLine': 'Meta+D',
      'editor.moveLineUp': 'Shift+Alt+Up',
      'editor.moveLineDown': 'Shift+Alt+Down',
      'editor.deleteLine': 'Meta+Backspace',
      'editor.formatDocument': 'Meta+Alt+L',
      'navigate.back': 'Meta+Alt+Left',
      'navigate.forward': 'Meta+Alt+Right',
      'navigate.goToLine': 'Meta+L',
      'navigate.goToDefinition': 'Meta+B',
      'navigate.goToImplementation': 'Meta+Alt+B',
      'navigate.findUsages': 'Alt+F7',
      'navigate.searchEverything': 'Shift+Shift', // Search Everywhere
      'navigate.quickOpen': 'Meta+Shift+O', // Open File
      'view.toggleSidebar': 'Meta+1',
      'view.toggleTerminal': 'Alt+F12',
      'view.zoomIn': 'Meta+=', // Not standard but good default
      'view.zoomOut': 'Meta+-',
      'view.resetZoom': 'Meta+0',
      'view.nextTab': 'Meta+Shift+]',
      'view.previousTab': 'Meta+Shift+[',
      'debug.start': 'Ctrl+D',
      'debug.stop': 'Meta+F2',
      'debug.stepOver': 'F8',
      'debug.stepInto': 'F7',
      'debug.toggleBreakpoint': 'Meta+F8'
    }
  }
}
