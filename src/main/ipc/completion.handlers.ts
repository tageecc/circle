/**
 * 代码补全 IPC Handlers
 */

const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG_COMPLETION === 'true'
const debug = (...args: unknown[]): void => {
  if (DEBUG) console.log('[CompletionHandlers]', ...args)
}

import { ipcMain } from 'electron'
import { CompletionService, type CompletionRequest } from '../services/completion.service'
import type { ConfigService } from '../services/config.service'

export function registerCompletionHandlers(configService: ConfigService): void {
  const completionService = new CompletionService(configService)

  ipcMain.handle('completion:generate', async (_, request: CompletionRequest) => {
    try {
      return await completionService.generateCompletion(request)
    } catch (error) {
      console.error('[CompletionHandlers] Error:', error)
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  debug('Handlers registered')
}
