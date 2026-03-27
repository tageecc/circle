import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Star, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/sonner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { PROVIDERS, getProvider } from '@/constants/providers'
import { MODELS_DATABASE, getModelsByProvider, type ModelInfo } from '@/constants/models'
import { cn } from '@/lib/utils'

interface ModelConfig {
  id: string
  providerId: string
  modelId: string
  displayName: string | null
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export function ModelsSettingsContent() {
  const { t } = useTranslation()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [customModelId, setCustomModelId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Load configured models
  const loadModels = async () => {
    try {
      const data = await window.api.modelConfig.getAll()
      setModels(data)
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error(t('models_settings.load_failed'))
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  // Get available models for selected provider
  const availableModels = useMemo(() => {
    if (!selectedProvider) return []
    const providerModels = getModelsByProvider(selectedProvider)
    return providerModels
  }, [selectedProvider])

  // Filtered providers by search query
  const filteredProviders = useMemo(() => {
    if (!searchQuery) return PROVIDERS
    const q = searchQuery.toLowerCase()
    return PROVIDERS.filter(
      p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, ModelConfig[]> = {}
    models.forEach(model => {
      if (!groups[model.providerId]) {
        groups[model.providerId] = []
      }
      groups[model.providerId].push(model)
    })
    return groups
  }, [models])

  // Handle add model
  const handleAddModel = async () => {
    if (!selectedProvider) {
      toast.error(t('models_settings.select_provider_first'))
      return
    }

    const modelId = customModelId || selectedModelId
    if (!modelId) {
      toast.error(t('models_settings.select_model_first'))
      return
    }

    try {
      // Check if model already exists
      const exists = await window.api.modelConfig.exists(selectedProvider, modelId)
      if (exists) {
        toast.error(t('models_settings.model_already_exists'))
        return
      }

      await window.api.modelConfig.add({
        providerId: selectedProvider,
        modelId,
        displayName: displayName || undefined,
        isDefault: models.length === 0 // First model is default
      })

      toast.success(t('models_settings.model_added'))
      setIsAddDialogOpen(false)
      resetAddDialog()
      loadModels()
    } catch (error) {
      console.error('Failed to add model:', error)
      toast.error(t('models_settings.add_failed'))
    }
  }

  // Reset add dialog
  const resetAddDialog = () => {
    setSelectedProvider('')
    setSelectedModelId('')
    setCustomModelId('')
    setDisplayName('')
  }

  // Handle delete model
  const handleDeleteModel = async (modelId: string) => {
    try {
      await window.api.modelConfig.delete(modelId)
      toast.success(t('models_settings.model_deleted'))
      loadModels()
    } catch (error) {
      console.error('Failed to delete model:', error)
      toast.error(t('models_settings.delete_failed'))
    }
  }

  // Handle set default
  const handleSetDefault = async (modelId: string) => {
    try {
      await window.api.modelConfig.setDefault(modelId)
      toast.success(t('models_settings.default_set'))
      loadModels()
    } catch (error) {
      console.error('Failed to set default:', error)
      toast.error(t('models_settings.set_default_failed'))
    }
  }

  // Get model info
  const getModelInfo = (modelId: string): ModelInfo | undefined => {
    return MODELS_DATABASE.find(m => m.id === modelId)
  }

  // Format context window
  const formatContextWindow = (contextWindow: number): string => {
    if (contextWindow >= 1000000) {
      return `${(contextWindow / 1000000).toFixed(1)}M`
    }
    return `${Math.round(contextWindow / 1000)}K`
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('models_settings.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('models_settings.description')}</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('models_settings.add_model')}
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              {t('models_settings.no_models')}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('models_settings.add_first_model')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {Object.entries(modelsByProvider).map(([providerId, providerModels]) => {
            const provider = getProvider(providerId)
            if (!provider) return null

            return (
              <div key={providerId} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{provider.name}</h3>
                  {provider.keyUrl && (
                    <button
                      onClick={() => window.api.shell.openExternal(provider.keyUrl!)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {providerModels.map(model => {
                    const modelInfo = getModelInfo(model.modelId)
                    return (
                      <div
                        key={model.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3 transition-colors',
                          model.isDefault
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:bg-accent'
                        )}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {model.displayName || model.modelId}
                            </span>
                            {model.isDefault && (
                              <Star className="h-3 w-3 fill-primary text-primary" />
                            )}
                          </div>
                          {modelInfo && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatContextWindow(modelInfo.contextWindow)} context</span>
                              <span>
                                ${modelInfo.cost.input}/{modelInfo.cost.output} per 1M tokens
                              </span>
                              {modelInfo.reasoning && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                  Reasoning
                                </span>
                              )}
                            </div>
                          )}
                          {!modelInfo && model.displayName !== model.modelId && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {model.modelId}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!model.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(model.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteModel(model.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Model Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('models_settings.add_model')}</DialogTitle>
            <DialogDescription>{t('models_settings.add_model_description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>{t('models_settings.provider')}</Label>
              <Input
                placeholder={t('models_settings.search_provider')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="mb-2"
              />
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder={t('models_settings.select_provider')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {filteredProviders.map(provider => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            {selectedProvider && (
              <div className="space-y-2">
                <Label>{t('models_settings.model')}</Label>
                {availableModels.length > 0 ? (
                  <>
                    <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('models_settings.select_model')} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectGroup>
                          {availableModels.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col items-start">
                                <span className="font-mono text-sm">{model.id}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatContextWindow(model.contextWindow)} •{' '}
                                  ${model.cost.input}/{model.cost.output}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('models_settings.or_enter_custom')}
                    </p>
                  </>
                ) : null}
                <Input
                  placeholder={t('models_settings.custom_model_id')}
                  value={customModelId}
                  onChange={e => setCustomModelId(e.target.value)}
                  disabled={!!selectedModelId}
                />
              </div>
            )}

            {/* Display Name (Optional) */}
            <div className="space-y-2">
              <Label>{t('models_settings.display_name_optional')}</Label>
              <Input
                placeholder={t('models_settings.display_name_placeholder')}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetAddDialog()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddModel}>{t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
