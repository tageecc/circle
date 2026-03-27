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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PROVIDERS, getProvider } from '@/constants/providers'
import { getModelsByProvider, getModelInfo } from '@/constants/models'
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
  const [modelId, setModelId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)

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

  const availableModels = useMemo(() => {
    return selectedProvider ? getModelsByProvider(selectedProvider) : []
  }, [selectedProvider])

  const selectedProviderData = useMemo(() => {
    return selectedProvider ? getProvider(selectedProvider) : null
  }, [selectedProvider])

  useEffect(() => {
    if (selectedProviderData?.baseURL && !baseURL) {
      setBaseURL(selectedProviderData.baseURL)
    }
  }, [selectedProviderData, baseURL])

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, ModelConfig[]> = {}
    models.forEach((model) => {
      if (!groups[model.providerId]) {
        groups[model.providerId] = []
      }
      groups[model.providerId].push(model)
    })
    return groups
  }, [models])

  const handleAddModel = async () => {
    if (!selectedProvider) {
      toast.error(t('models_settings.select_provider_first'))
      return
    }

    if (!modelId.trim()) {
      toast.error(t('models_settings.enter_model_id'))
      return
    }

    if (!apiKey.trim()) {
      toast.error(t('models_settings.enter_api_key'))
      return
    }

    try {
      const exists = await window.api.modelConfig.exists(selectedProvider, modelId)
      if (exists) {
        toast.error(t('models_settings.model_already_exists'))
        return
      }

      await window.api.providerApiKey.set({
        providerId: selectedProvider,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || undefined
      })

      await window.api.modelConfig.add({
        providerId: selectedProvider,
        modelId: modelId.trim(),
        isDefault: models.length === 0
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

  const resetAddDialog = () => {
    setSelectedProvider('')
    setModelId('')
    setApiKey('')
    setBaseURL('')
    setModelPopoverOpen(false)
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

  const formatContextWindow = (contextWindow: number): string => {
    return contextWindow >= 1000000
      ? `${(contextWindow / 1000000).toFixed(1)}M`
      : `${Math.round(contextWindow / 1000)}K`
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
            <p className="mb-4 text-sm text-muted-foreground">{t('models_settings.no_models')}</p>
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
                  {providerModels.map((model) => {
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('models_settings.add_model')}</DialogTitle>
            <DialogDescription>{t('models_settings.add_model_description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>{t('models_settings.provider')}</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('models_settings.select_provider')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectGroup>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selectedProviderData?.keyUrl && (
                <button
                  onClick={() => window.api.shell.openExternal(selectedProviderData.keyUrl!)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('models_settings.get_api_key')}
                </button>
              )}
            </div>

            {/* Custom Base URL */}
            {selectedProvider === 'custom' && (
              <div className="space-y-2">
                <Label>{t('models_settings.base_url')}</Label>
                <Input
                  placeholder="https://api.openai.com/v1"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                />
              </div>
            )}

            {/* API Key */}
            {selectedProvider && (
              <>
                <div className="space-y-2">
                  <Label>{t('models_settings.api_key')}</Label>
                  <Input
                    type="password"
                    placeholder={t('models_settings.enter_api_key_placeholder')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                {/* Model ID */}
                <div className="space-y-2">
                  <Label>{t('models_settings.model_id')}</Label>
                  <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          placeholder={
                            selectedProviderData?.modelHint ||
                            t('models_settings.model_id_placeholder')
                          }
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                          onFocus={() => availableModels.length > 0 && setModelPopoverOpen(true)}
                          className="pr-9"
                        />
                        {availableModels.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setModelPopoverOpen(!modelPopoverOpen)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </PopoverTrigger>
                    {availableModels.length > 0 && (
                      <PopoverContent 
                        align="start" 
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onWheel={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        <div 
                          className="max-h-[300px] overflow-y-auto p-2"
                          style={{ 
                            overscrollBehavior: 'contain',
                            WebkitOverflowScrolling: 'touch'
                          }}
                          onWheel={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          {availableModels.map((model) => (
                            <button
                              key={model.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setModelId(model.id)
                                setModelPopoverOpen(false)
                              }}
                              className="w-full flex flex-col items-start gap-1 rounded-md px-3 py-2 text-left hover:bg-accent transition-colors"
                            >
                              <span className="font-mono text-sm font-medium">{model.id}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatContextWindow(model.contextWindow)} • $
                                {model.cost.input}/{model.cost.output}
                              </span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                  {selectedProviderData?.modelHint && (
                    <p className="text-xs text-muted-foreground">
                      {t('models_settings.model_hint', { model: selectedProviderData.modelHint })}
                    </p>
                  )}
                </div>
              </>
            )}
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
            <Button onClick={handleAddModel} disabled={!selectedProvider || !modelId || !apiKey}>
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
