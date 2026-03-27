import { ipcMain } from 'electron'
import { getDb } from '../database/db'
import { ModelConfigService } from '../services/model-config.service'

export function registerModelConfigHandlers() {
  const db = getDb()
  const modelConfigService = new ModelConfigService(db)

  // Get all configured models
  ipcMain.handle('model-config:getAll', async () => {
    try {
      return await modelConfigService.getAllModels()
    } catch (error) {
      console.error('Failed to get models:', error)
      throw error
    }
  })

  // Get models by provider
  ipcMain.handle('model-config:getByProvider', async (_, providerId: string) => {
    try {
      return await modelConfigService.getModelsByProvider(providerId)
    } catch (error) {
      console.error('Failed to get models by provider:', error)
      throw error
    }
  })

  // Get default model
  ipcMain.handle('model-config:getDefault', async () => {
    try {
      return await modelConfigService.getDefaultModel()
    } catch (error) {
      console.error('Failed to get default model:', error)
      throw error
    }
  })

  // Add a new model
  ipcMain.handle(
    'model-config:add',
    async (
      _,
      input: {
        providerId: string
        modelId: string
        displayName?: string
        isDefault?: boolean
      }
    ) => {
      try {
        return await modelConfigService.addModel(input)
      } catch (error) {
        console.error('Failed to add model:', error)
        throw error
      }
    }
  )

  // Update a model
  ipcMain.handle(
    'model-config:update',
    async (
      _,
      id: string,
      updates: {
        displayName?: string
        isDefault?: boolean
      }
    ) => {
      try {
        await modelConfigService.updateModel(id, updates)
        return { success: true }
      } catch (error) {
        console.error('Failed to update model:', error)
        throw error
      }
    }
  )

  // Set a model as default
  ipcMain.handle('model-config:setDefault', async (_, id: string) => {
    try {
      await modelConfigService.setDefault(id)
      return { success: true }
    } catch (error) {
      console.error('Failed to set default model:', error)
      throw error
    }
  })

  // Delete a model
  ipcMain.handle('model-config:delete', async (_, id: string) => {
    try {
      await modelConfigService.deleteModel(id)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete model:', error)
      throw error
    }
  })

  // Check if model exists
  ipcMain.handle('model-config:exists', async (_, providerId: string, modelId: string) => {
    try {
      return await modelConfigService.modelExists(providerId, modelId)
    } catch (error) {
      console.error('Failed to check model existence:', error)
      throw error
    }
  })
}
