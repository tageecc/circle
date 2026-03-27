import mitt from 'mitt'

/** Application-wide event map for the mitt bus. */
export type AppEvents = {
  /** Fired when Files: Exclude settings change. */
  'files-exclude-changed': void

  /** Navigate the editor to a line (e.g. from search). */
  'editor-goto-line': {
    filePath: string
    line: number
    column: number
    length?: number
  }

  /** Request focus for a terminal panel. */
  'terminal:focus': {
    terminalId: string
  }

  /** Open settings dialog with optional tab. */
  'open-settings': {
    tab?: string
  }

  /** Model configuration has been updated. */
  'models-updated': void
}

/**
 * Global event bus (`emit` / `on` / `off`).
 */
export const eventBus = mitt<AppEvents>()
