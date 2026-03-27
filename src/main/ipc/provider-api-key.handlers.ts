import { ipcMain } from 'electron'
import { getDb } from '../database/db'
import { ProviderApiKeyService } from '../services/provider-api-key.service'

export function registerProviderApiKeyHandlers() {
  const db = getDb()
  const service = new ProviderApiKeyService(db)

  ipcMain.handle('provider-api-key:get', async (_, providerId: string) => {
    return await service.getApiKey(providerId)
  })

  ipcMain.handle('provider-api-key:getAll', async () => {
    return await service.getAllApiKeys()
  })

  ipcMain.handle(
    'provider-api-key:set',
    async (_, input: { providerId: string; apiKey: string; baseURL?: string }) => {
      return await service.setApiKey(input)
    }
  )

  ipcMain.handle('provider-api-key:delete', async (_, providerId: string) => {
    await service.deleteApiKey(providerId)
    return { success: true }
  })
}
