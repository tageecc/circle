import * as monaco from 'monaco-editor'

// Map our custom command IDs to Monaco's internal action IDs
export const MONACO_ACTIONS_MAP: Record<string, string> = {
  'editor.undo': 'undo',
  'editor.redo': 'redo',
  // 'editor.cut': 'editor.action.clipboardCutAction', // Browsers limit clipboard access
  // 'editor.copy': 'editor.action.clipboardCopyAction',
  // 'editor.paste': 'editor.action.clipboardPasteAction',
  'editor.find': 'actions.find',
  'editor.replace': 'editor.action.startFindReplaceAction',
  'editor.toggleLineComment': 'editor.action.commentLine',
  'editor.toggleBlockComment': 'editor.action.blockComment',
  'editor.duplicateLine': 'editor.action.copyLinesDownAction',
  'editor.moveLineUp': 'editor.action.moveLinesUpAction',
  'editor.moveLineDown': 'editor.action.moveLinesDownAction',
  'editor.deleteLine': 'editor.action.deleteLines',
  'editor.formatDocument': 'editor.action.formatDocument',
  'navigate.goToLine': 'editor.action.gotoLine',
  'navigate.goToDefinition': 'editor.action.revealDefinition',
  'navigate.goToImplementation': 'editor.action.goToImplementation',
  'navigate.findUsages': 'references-view.findReferences',
  'debug.toggleBreakpoint': 'editor.debug.action.toggleBreakpoint',
  'view.toggleTerminal': 'workbench.action.terminal.toggleTerminal', // This might need custom handling if not using full VSCode workbench
  'view.zoomIn': 'editor.action.fontZoomIn',
  'view.zoomOut': 'editor.action.fontZoomOut',
  'view.resetZoom': 'editor.action.fontZoomReset'
}

// Map string key names to Monaco KeyCode names
const KEY_CODE_MAP: Record<string, number> = {
  BACKSPACE: monaco.KeyCode.Backspace,
  TAB: monaco.KeyCode.Tab,
  ENTER: monaco.KeyCode.Enter,
  SHIFT: monaco.KeyCode.Shift,
  CTRL: monaco.KeyCode.Ctrl,
  ALT: monaco.KeyCode.Alt,
  PAUSEBREAK: monaco.KeyCode.PauseBreak,
  CAPSLOCK: monaco.KeyCode.CapsLock,
  ESCAPE: monaco.KeyCode.Escape,
  SPACE: monaco.KeyCode.Space,
  PAGEUP: monaco.KeyCode.PageUp,
  PAGEDOWN: monaco.KeyCode.PageDown,
  END: monaco.KeyCode.End,
  HOME: monaco.KeyCode.Home,
  LEFT: monaco.KeyCode.LeftArrow,
  UP: monaco.KeyCode.UpArrow,
  RIGHT: monaco.KeyCode.RightArrow,
  DOWN: monaco.KeyCode.DownArrow,
  INSERT: monaco.KeyCode.Insert,
  DELETE: monaco.KeyCode.Delete,
  '0': monaco.KeyCode.Digit0,
  '1': monaco.KeyCode.Digit1,
  '2': monaco.KeyCode.Digit2,
  '3': monaco.KeyCode.Digit3,
  '4': monaco.KeyCode.Digit4,
  '5': monaco.KeyCode.Digit5,
  '6': monaco.KeyCode.Digit6,
  '7': monaco.KeyCode.Digit7,
  '8': monaco.KeyCode.Digit8,
  '9': monaco.KeyCode.Digit9,
  A: monaco.KeyCode.KeyA,
  B: monaco.KeyCode.KeyB,
  C: monaco.KeyCode.KeyC,
  D: monaco.KeyCode.KeyD,
  E: monaco.KeyCode.KeyE,
  F: monaco.KeyCode.KeyF,
  G: monaco.KeyCode.KeyG,
  H: monaco.KeyCode.KeyH,
  I: monaco.KeyCode.KeyI,
  J: monaco.KeyCode.KeyJ,
  K: monaco.KeyCode.KeyK,
  L: monaco.KeyCode.KeyL,
  M: monaco.KeyCode.KeyM,
  N: monaco.KeyCode.KeyN,
  O: monaco.KeyCode.KeyO,
  P: monaco.KeyCode.KeyP,
  Q: monaco.KeyCode.KeyQ,
  R: monaco.KeyCode.KeyR,
  S: monaco.KeyCode.KeyS,
  T: monaco.KeyCode.KeyT,
  U: monaco.KeyCode.KeyU,
  V: monaco.KeyCode.KeyV,
  W: monaco.KeyCode.KeyW,
  X: monaco.KeyCode.KeyX,
  Y: monaco.KeyCode.KeyY,
  Z: monaco.KeyCode.KeyZ,
  F1: monaco.KeyCode.F1,
  F2: monaco.KeyCode.F2,
  F3: monaco.KeyCode.F3,
  F4: monaco.KeyCode.F4,
  F5: monaco.KeyCode.F5,
  F6: monaco.KeyCode.F6,
  F7: monaco.KeyCode.F7,
  F8: monaco.KeyCode.F8,
  F9: monaco.KeyCode.F9,
  F10: monaco.KeyCode.F10,
  F11: monaco.KeyCode.F11,
  F12: monaco.KeyCode.F12,
  NUMPAD0: monaco.KeyCode.Numpad0,
  NUMPAD1: monaco.KeyCode.Numpad1,
  NUMPAD2: monaco.KeyCode.Numpad2,
  NUMPAD3: monaco.KeyCode.Numpad3,
  NUMPAD4: monaco.KeyCode.Numpad4,
  NUMPAD5: monaco.KeyCode.Numpad5,
  NUMPAD6: monaco.KeyCode.Numpad6,
  NUMPAD7: monaco.KeyCode.Numpad7,
  NUMPAD8: monaco.KeyCode.Numpad8,
  NUMPAD9: monaco.KeyCode.Numpad9,
  '*': monaco.KeyCode.NumpadMultiply,
  '+': monaco.KeyCode.NumpadAdd, // Or KeyCode.Equal depending on context, but let's try NumpadAdd/Equal
  '-': monaco.KeyCode.Minus,
  '.': monaco.KeyCode.Period,
  '/': monaco.KeyCode.Slash,
  '`': monaco.KeyCode.Backquote,
  '=': monaco.KeyCode.Equal,
  '[': monaco.KeyCode.BracketLeft,
  ']': monaco.KeyCode.BracketRight,
  '\\': monaco.KeyCode.Backslash,
  ';': monaco.KeyCode.Semicolon,
  "'": monaco.KeyCode.Quote,
  ',': monaco.KeyCode.Comma
}

export function parseMonacoKeybinding(keyStr: string): number {
  if (!keyStr) return 0

  const parts = keyStr.split('+')
  let keybinding = 0
  let keyCode = 0

  parts.forEach((part) => {
    const upper = part.toUpperCase().trim()

    if (upper === 'META' || upper === 'CMD' || upper === 'COMMAND') {
      keybinding |= monaco.KeyMod.CtrlCmd
    } else if (upper === 'CTRL' || upper === 'CONTROL') {
      keybinding |= monaco.KeyMod.WinCtrl
    } else if (upper === 'ALT' || upper === 'OPTION') {
      keybinding |= monaco.KeyMod.Alt
    } else if (upper === 'SHIFT') {
      keybinding |= monaco.KeyMod.Shift
    } else {
      // Map key char to code
      if (KEY_CODE_MAP[upper] !== undefined) {
        keyCode = KEY_CODE_MAP[upper]
      } else {
        // Fallback for simple single letters not in map if any
        // But our map covers A-Z
        console.warn(`Unknown key code: ${upper}`)
      }
    }
  })

  return keybinding | keyCode
}
