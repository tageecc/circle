import { getModelsByProvider } from '@/constants/models'
import { PROVIDERS } from '@/constants/providers'
import { providerRequiresApiKey } from '../../../shared/provider-config'

export interface ProviderCredentialSummary {
  providerId: string
  apiKey: string
  baseURL: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AvailableChatModel {
  id: string
  providerId: string
  modelId: string
}

export const CHAT_MODEL_PROVIDERS = PROVIDERS.filter(
  (provider) => getModelsByProvider(provider.id).length > 0
)

export function getAvailableChatModels(
  credentials: ProviderCredentialSummary[]
): AvailableChatModel[] {
  const credentialMap = new Map(
    credentials.map((credential) => [credential.providerId, credential])
  )

  return CHAT_MODEL_PROVIDERS.flatMap((provider) => {
    const credential = credentialMap.get(provider.id)
    const providerEnabled = (() => {
      if (!credential) {
        return false
      }

      return providerRequiresApiKey(provider.id)
        ? Boolean(credential.apiKey?.trim())
        : Boolean(credential.baseURL?.trim() || provider.baseURL)
    })()

    if (!providerEnabled) {
      return []
    }

    return getModelsByProvider(provider.id).map((model) => ({
      id: `${provider.id}/${model.id}`,
      providerId: provider.id,
      modelId: model.id
    }))
  })
}

export function splitSelectedModelId(
  selectedModelId: string | null
): { providerId: string; modelId: string } | null {
  if (!selectedModelId) {
    return null
  }

  const separatorIndex = selectedModelId.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === selectedModelId.length - 1) {
    return null
  }

  return {
    providerId: selectedModelId.slice(0, separatorIndex),
    modelId: selectedModelId.slice(separatorIndex + 1)
  }
}
