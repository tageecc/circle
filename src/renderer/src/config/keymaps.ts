export interface KeyBinding {
  command: string
  key: string
  when?: string
}

export type KeymapCategoryId = 'file' | 'editor' | 'navigate' | 'view' | 'debug'

export interface KeymapCommandDef {
  id: string
  category: KeymapCategoryId
}

/** settings 命名空间下的 i18n 路径：`keymap.commands.<id>`（id 中的 `.` 对应嵌套） */
export function keymapCommandLabelKey(commandId: string): string {
  return `keymap.commands.${commandId}`
}

/** settings 命名空间下的 i18n 路径：`keymap.categories.<categoryId>` */
export function keymapCategoryLabelKey(categoryId: KeymapCategoryId): string {
  return `keymap.categories.${categoryId}`
}

/** settings 命名空间下的 i18n 路径：`keymap.presets.<presetId>` */
export function keymapPresetLabelKey(presetId: string): string {
  return `keymap.presets.${presetId}`
}

export interface KeymapProfile {
  bindings: Record<string, string>
}

export const COMMANDS: KeymapCommandDef[] = [
  { id: 'file.save', category: 'file' },
  { id: 'file.saveAll', category: 'file' },
  { id: 'file.new', category: 'file' },
  { id: 'file.open', category: 'file' },
  { id: 'file.close', category: 'file' },

  { id: 'editor.undo', category: 'editor' },
  { id: 'editor.redo', category: 'editor' },
  { id: 'editor.cut', category: 'editor' },
  { id: 'editor.copy', category: 'editor' },
  { id: 'editor.paste', category: 'editor' },
  { id: 'editor.find', category: 'editor' },
  { id: 'editor.replace', category: 'editor' },
  { id: 'editor.findInFiles', category: 'editor' },
  { id: 'editor.toggleLineComment', category: 'editor' },
  { id: 'editor.toggleBlockComment', category: 'editor' },
  { id: 'editor.duplicateLine', category: 'editor' },
  { id: 'editor.moveLineUp', category: 'editor' },
  { id: 'editor.moveLineDown', category: 'editor' },
  { id: 'editor.deleteLine', category: 'editor' },
  { id: 'editor.formatDocument', category: 'editor' },

  { id: 'navigate.back', category: 'navigate' },
  { id: 'navigate.forward', category: 'navigate' },
  { id: 'navigate.goToLine', category: 'navigate' },
  { id: 'navigate.goToDefinition', category: 'navigate' },
  { id: 'navigate.goToImplementation', category: 'navigate' },
  { id: 'navigate.findUsages', category: 'navigate' },
  { id: 'navigate.searchEverything', category: 'navigate' },
  { id: 'navigate.quickOpen', category: 'navigate' },

  { id: 'view.toggleSidebar', category: 'view' },
  { id: 'view.toggleTerminal', category: 'view' },
  { id: 'view.zoomIn', category: 'view' },
  { id: 'view.zoomOut', category: 'view' },
  { id: 'view.resetZoom', category: 'view' },
  { id: 'view.nextTab', category: 'view' },
  { id: 'view.previousTab', category: 'view' },

  { id: 'debug.start', category: 'debug' },
  { id: 'debug.stop', category: 'debug' },
  { id: 'debug.stepOver', category: 'debug' },
  { id: 'debug.stepInto', category: 'debug' },
  { id: 'debug.toggleBreakpoint', category: 'debug' }
]

export const KEYMAP_PRESETS: Record<string, KeymapProfile> = {
  vscode: {
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
