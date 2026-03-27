import { useCallback, useState, useMemo, useEffect, useRef } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton
} from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { RichTextInput, type PastedImage, type Attachment } from '@/components/ui/rich-text-input'
import { ArrowUp, Square } from 'lucide-react'
import { getProviderLogo } from '@/lib/provider-logos'
import { cn } from '@/lib/utils'
import { getProvider } from '@/constants/providers'
import { getModelInfo } from '@/constants/models'
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import type { LanguageModelUsage } from 'ai'
import { useTranslation } from 'react-i18next'

interface ModelConfig {
  id: string
  providerId: string
  modelId: string
  displayName: string | null
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export type { PastedImage, Attachment }

interface ChatInputProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop?: () => void
  disabled?: boolean
  isSending?: boolean
  pastedImages: PastedImage[]
  onPastedImagesChange: (images: PastedImage[]) => void
  attachments?: Attachment[]
  onAttachmentsChange?: (attachments: Attachment[]) => void
  onModelChange?: (provider: string, model: string) => void
  defaultProvider?: string
  defaultModel?: string
  autoFocus?: boolean
  minHeight?: string
  // Context usage
  maxTokens?: number
  usedTokens?: number
  usage?: LanguageModelUsage
}

export function ChatInput({
  placeholder,
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isSending = false,
  pastedImages,
  onPastedImagesChange,
  attachments = [],
  onAttachmentsChange,
  onModelChange,
  defaultProvider = 'Alibaba (China)',
  defaultModel = 'qwen-plus',
  autoFocus = false,
  minHeight,
  maxTokens,
  usedTokens,
  usage
}: ChatInputProps) {
  const { t } = useTranslation()
  const inputGroupRef = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider)
  const [selectedModel, setSelectedModel] = useState(defaultModel)
  const [configuredModels, setConfiguredModels] = useState<ModelConfig[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  
  // Load configured models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await window.api.modelConfig.getAll()
        setConfiguredModels(models)
        
        // Set default model if available
        const defaultModel = models.find(m => m.isDefault)
        if (defaultModel) {
          setSelectedProvider(defaultModel.providerId)
          setSelectedModel(defaultModel.modelId)
          onModelChange?.(defaultModel.providerId, defaultModel.modelId)
        }
      } catch (error) {
        console.error('Failed to load models:', error)
      } finally {
        setIsLoadingModels(false)
      }
    }
    loadModels()
  }, [onModelChange])
  
  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, ModelConfig[]> = {}
    configuredModels.forEach(model => {
      if (!groups[model.providerId]) {
        groups[model.providerId] = []
      }
      groups[model.providerId].push(model)
    })
    return groups
  }, [configuredModels])
  
  // 设置下拉菜单的挂载容器
  useEffect(() => {
    if (inputGroupRef.current) {
      setPortalContainer(inputGroupRef.current)
    }
  }, [])

  // Get display name for selected model
  const selectedModelName = useMemo(() => {
    const configModel = configuredModels.find(
      m => m.providerId === selectedProvider && m.modelId === selectedModel
    )
    if (configModel?.displayName) return configModel.displayName
    
    const modelInfo = getModelInfo(selectedModel)
    return modelInfo?.name || selectedModel
  }, [selectedProvider, selectedModel, configuredModels])

  const hasContent = value.trim() || pastedImages.length > 0 || attachments.length > 0
  const showStopButton = isSending && onStop && !hasContent

  const handleModelChange = useCallback(
    (provider: string, modelId: string) => {
      setSelectedProvider(provider)
      setSelectedModel(modelId)
      onModelChange?.(provider, modelId)
    },
    [onModelChange]
  )

  return (
    <div style={minHeight ? { minHeight } : undefined}>
      <InputGroup ref={inputGroupRef} className="[--radius:1.5rem]">
        <RichTextInput
          placeholder={placeholder ?? t('chat.type_message')}
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={disabled}
          onPastedImagesChange={onPastedImagesChange}
          onAttachmentsChange={onAttachmentsChange}
          autoFocus={autoFocus}
        />
        <InputGroupAddon align="block-end">
          {/* 模型选择器 */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <InputGroupButton
                variant="ghost"
                disabled={disabled}
                className="flex items-center gap-1.5"
              >
                {getProviderLogo(selectedProvider) && (
                  <img
                    src={getProviderLogo(selectedProvider)!}
                    alt={selectedProvider}
                    className="size-3.5 dark:invert opacity-60"
                  />
                )}
                <span className="text-xs font-medium">{selectedModelName}</span>
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-[380px] max-h-[500px] overflow-y-auto [--radius:0.95rem] -translate-x-32"
              container={portalContainer}
            >
              {isLoadingModels ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('chat.loading_models')}
                </div>
              ) : configuredModels.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="mb-2 text-sm text-muted-foreground">
                    {t('chat.no_models_configured')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('chat.go_to_settings_to_add')}
                  </p>
                </div>
              ) : (
                <>
                  {Object.entries(modelsByProvider).map(([providerId, providerModels]) => {
                    const provider = getProvider(providerId)
                    if (!provider) return null
                    
                    return (
                      <div key={providerId}>
                        <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2">
                          {getProviderLogo(providerId) && (
                            <img
                              src={getProviderLogo(providerId)!}
                              alt={provider.name}
                              className="size-4 dark:invert opacity-70"
                            />
                          )}
                          <span className="text-xs font-semibold text-foreground">{provider.name}</span>
                        </DropdownMenuLabel>
                        {providerModels.map((model) => {
                          const modelInfo = getModelInfo(model.modelId)
                          const displayName = model.displayName || modelInfo?.name || model.modelId
                          const contextWindow = modelInfo?.contextWindow 
                            ? modelInfo.contextWindow >= 1000000
                              ? `${(modelInfo.contextWindow / 1000000).toFixed(1)}M`
                              : `${Math.round(modelInfo.contextWindow / 1000)}K`
                            : null
                          
                          return (
                            <DropdownMenuItem
                              key={model.id}
                              onSelect={() => handleModelChange(model.providerId, model.modelId)}
                              className={cn(
                                'cursor-pointer px-3 py-3 focus:bg-accent/50',
                                selectedProvider === model.providerId &&
                                  selectedModel === model.modelId &&
                                  'bg-accent/30'
                              )}
                            >
                              <div className="flex w-full flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-foreground">{displayName}</span>
                                  {contextWindow && (
                                    <span className="text-xs text-muted-foreground">
                                      {contextWindow}
                                    </span>
                                  )}
                                </div>
                                {modelInfo && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>${modelInfo.cost.input}/{modelInfo.cost.output} per 1M</span>
                                    {modelInfo.reasoning && (
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                        Reasoning
                                      </span>
                                    )}
                                  </div>
                                )}
                                {model.isDefault && (
                                  <span className="text-xs text-primary">
                                    {t('chat.default_model')}
                                  </span>
                                )}
                              </div>
                            </DropdownMenuItem>
                          )
                        })}
                        <DropdownMenuSeparator className="my-1" />
                      </div>
                    )
                  })}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Context 用量显示 */}
          <div className="ml-auto flex items-center gap-1">
            {usedTokens != null && usedTokens > 0 && maxTokens && usage && (
              <Context
                maxTokens={maxTokens}
                modelId={selectedModel}
                usage={usage}
                usedTokens={usedTokens!}
              >
                <ContextTrigger />
                <ContextContent>
                  <ContextContentHeader />
                  <ContextContentBody>
                    <ContextInputUsage />
                    <ContextOutputUsage />
                    <ContextReasoningUsage />
                    <ContextCacheUsage />
                  </ContextContentBody>
                  <ContextContentFooter />
                </ContextContent>
              </Context>
            )}

            {/* 发送/停止按钮 */}
            {showStopButton ? (
              <InputGroupButton
                variant="secondary"
                className="rounded-full"
                size="icon-xs"
                onClick={onStop}
                title={t('chat.stop_generating')}
              >
                <Square className="size-3 fill-current" />
                <span className="sr-only">{t('chat.stop')}</span>
              </InputGroupButton>
            ) : (
              <InputGroupButton
                variant="default"
                className="rounded-full"
                size="icon-xs"
                disabled={!hasContent || disabled}
                onClick={onSend}
                title={isSending ? t('chat.enqueue') : t('chat.send_message')}
              >
                <ArrowUp className="size-4" />
                <span className="sr-only">{t('chat.send')}</span>
              </InputGroupButton>
            )}
          </div>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
