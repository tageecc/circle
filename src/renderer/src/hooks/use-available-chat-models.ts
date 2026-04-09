import { useEffect, useState } from 'react'
import { eventBus } from '@/lib/event-bus'
import {
  getAvailableChatModels,
  type AvailableChatModel,
  type ProviderCredentialSummary
} from '@/lib/chat-models'

export function useAvailableChatModels() {
  const [availableModels, setAvailableModels] = useState<AvailableChatModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadModels = async () => {
      try {
        const credentials = (await window.api.modelConfig.listProviderCredentials()) as
          | ProviderCredentialSummary[]
          | undefined

        if (!cancelled) {
          setAvailableModels(getAvailableChatModels(credentials ?? []))
        }
      } catch (error) {
        if (!cancelled) {
          console.error('加载可用聊天模型失败:', error)
          setAvailableModels([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModels(false)
        }
      }
    }

    void loadModels()

    const handleModelsUpdated = (): void => {
      void loadModels()
    }

    eventBus.on('models-updated', handleModelsUpdated)
    return () => {
      cancelled = true
      eventBus.off('models-updated', handleModelsUpdated)
    }
  }, [])

  return { availableModels, isLoadingModels }
}
