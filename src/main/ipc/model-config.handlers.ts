import { ipcMain } from 'electron'
import { getDb } from '../database/db'
import { ModelConfigService } from '../services/model-config.service'

export function registerModelConfigHandlers() {
  const db = getDb()
  const modelConfigService = new ModelConfigService(db)

  ipcMain.handle('model-config:getAll', async () => {
    return await modelConfigService.getAllModels()
  })

  ipcMain.handle('model-config:getDefault', async () => {
    return await modelConfigService.getDefaultModel()
  })

  ipcMain.handle(
    'model-config:add',
    async (
      _,
      input: {
        providerId: string
        modelId: string
        isDefault?: boolean
      }
    ) => {
      return await modelConfigService.addModel(input)
    }
  )

  ipcMain.handle('model-config:setDefault', async (_, id: string) => {
    await modelConfigService.setDefault(id)
    return { success: true }
  })

  ipcMain.handle('model-config:delete', async (_, id: string) => {
    await modelConfigService.deleteModel(id)
    return { success: true }
  })

  ipcMain.handle('model-config:exists', async (_, providerId: string, modelId: string) => {
    return await modelConfigService.modelExists(providerId, modelId)
  })
}
