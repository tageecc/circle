import { ipcMain } from 'electron'
import { getConfigService } from '../index'
import { getEmbeddingProviderConfig, providerRequiresApiKey } from '../../shared/provider-config'

export function registerModelConfigHandlers() {
  const configService = getConfigService()

  ipcMain.handle('model-config:listProviderCredentials', async () => {
    return configService.listProviderCredentials()
  })

  ipcMain.handle('model-config:getProviderCredential', async (_, providerId: string) => {
    return configService.getProviderCredential(providerId)
  })

  ipcMain.handle(
    'model-config:setProviderCredential',
    async (_, input: { providerId: string; apiKey: string; baseURL?: string }) => {
      return configService.setProviderCredential(input)
    }
  )

  ipcMain.handle('model-config:deleteProviderCredential', async (_, providerId: string) => {
    configService.deleteProviderCredential(providerId)
    return { success: true }
  })

  ipcMain.handle('model-config:getVectorSearchSettings', async () => {
    const serviceSettings = configService.getServiceSettings()
    return {
      vectorSearchEnabled: serviceSettings.vectorSearchEnabled ?? false,
      embeddingProvider: serviceSettings.embeddingProvider ?? 'openai-small'
    }
  })

  ipcMain.handle(
    'model-config:setVectorSearchSettings',
    async (
      _,
      settings: {
        vectorSearchEnabled?: boolean
        embeddingProvider?: string
      }
    ) => {
      const currentSettings = configService.getServiceSettings()
      const nextSettings = {
        vectorSearchEnabled:
          settings.vectorSearchEnabled ?? currentSettings.vectorSearchEnabled ?? false,
        embeddingProvider:
          settings.embeddingProvider ?? currentSettings.embeddingProvider ?? 'openai-small'
      }

      if (nextSettings.vectorSearchEnabled) {
        const embeddingConfig = getEmbeddingProviderConfig(nextSettings.embeddingProvider)
        if (!embeddingConfig) {
          throw new Error('Invalid embedding provider')
        }

        if (
          providerRequiresApiKey(embeddingConfig.providerId) &&
          !configService.hasProviderCredential(embeddingConfig.providerId)
        ) {
          throw new Error(
            `Configure ${embeddingConfig.providerId} credentials before enabling vector search`
          )
        }
      }

      configService.setServiceSettings(nextSettings)
      return { success: true }
    }
  )
}
