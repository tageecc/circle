import { useMemo, useEffect, useRef, useState, useDeferredValue } from 'react'
import { InputGroup, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { RichTextInput, type Attachment, type PastedImage } from '@/components/ui/rich-text-input'
import { AlertCircle, ArrowUp, Square } from 'lucide-react'
import { getProviderLogoAsset } from '@/lib/provider-logos'
import { cn } from '@/lib/utils'
import { getProvider } from '@/constants/providers'
import { getModelInfo } from '@/constants/models'
import { eventBus } from '@/lib/event-bus'
import { type AvailableChatModel } from '@/lib/chat-models'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
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
  ContextTrigger
} from '@/components/ai-elements/context'
import type { LanguageModelUsage } from '@/types/chat'
import { useTranslation } from 'react-i18next'

export type { Attachment, PastedImage }

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
  availableModels: AvailableChatModel[]
  isLoadingModels: boolean
  selectedModelId: string | null
  onModelChange?: (modelId: string | null) => void
  showModelSelector?: boolean
  autoFocus?: boolean
  minHeight?: string
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
  availableModels,
  isLoadingModels,
  selectedModelId,
  onModelChange,
  showModelSelector = true,
  autoFocus = false,
  minHeight,
  maxTokens,
  usedTokens,
  usage
}: ChatInputProps) {
  const { t } = useTranslation()
  const inputGroupRef = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const onModelChangeRef = useRef(onModelChange)
  const deferredModelSearch = useDeferredValue(modelSearch)

  useEffect(() => {
    onModelChangeRef.current = onModelChange
  })

  const modelEntries = useMemo(() => {
    return availableModels.map((model) => {
      const provider = getProvider(model.providerId)
      const modelInfo = getModelInfo(model.modelId, model.providerId)
      const contextWindow = modelInfo?.contextWindow
        ? modelInfo.contextWindow >= 1000000
          ? `${(modelInfo.contextWindow / 1000000).toFixed(1)}M`
          : `${Math.round(modelInfo.contextWindow / 1000)}K`
        : null

      return {
        ...model,
        providerName: provider?.name || model.providerId,
        providerLogo: getProviderLogoAsset(model.providerId),
        displayName: modelInfo?.name || model.modelId,
        contextWindow,
        costLabel: modelInfo ? `$${modelInfo.cost.input}/${modelInfo.cost.output} per 1M` : null,
        reasoning: Boolean(modelInfo?.reasoning),
        searchText:
          `${model.modelId} ${modelInfo?.name || ''} ${provider?.name || ''} ${model.providerId}`.toLowerCase()
      }
    })
  }, [availableModels])

  const filteredModels = useMemo(() => {
    const keyword = deferredModelSearch.trim().toLowerCase()
    if (!keyword) {
      return modelEntries
    }

    return modelEntries.filter((model) => model.searchText.includes(keyword))
  }, [deferredModelSearch, modelEntries])

  useEffect(() => {
    if (inputGroupRef.current) {
      setPortalContainer(inputGroupRef.current)
    }
  }, [])

  const selectedEntry = useMemo(
    () =>
      selectedModelId
        ? (availableModels.find((model) => model.id === selectedModelId) ?? null)
        : null,
    [availableModels, selectedModelId]
  )

  useEffect(() => {
    if (!isLoadingModels && selectedModelId && !selectedEntry) {
      onModelChangeRef.current?.(null)
    }
  }, [isLoadingModels, selectedEntry, selectedModelId])

  const hasConfiguredModels = availableModels.length > 0
  const hasValidSelection = selectedEntry !== null
  const selectedProvider = selectedEntry?.providerId ?? ''
  const selectedModel = selectedEntry?.modelId ?? ''
  const requiresExplicitModel = showModelSelector

  const selectedModelName = useMemo(() => {
    if (!showModelSelector) return ''
    if (isLoadingModels) return t('chat.loading_models')
    if (!hasConfiguredModels) return t('chat.no_model')
    if (!selectedEntry) return t('chat.select_model')
    return selectedEntry.modelId
  }, [hasConfiguredModels, isLoadingModels, selectedEntry, showModelSelector, t])

  const hasContent = value.trim() || pastedImages.length > 0 || attachments.length > 0
  const showStopButton = isSending && onStop && !hasContent

  return (
    <div style={minHeight ? { minHeight } : undefined}>
      <InputGroup ref={inputGroupRef} className="[--radius:1.5rem]">
        <RichTextInput
          placeholder={
            requiresExplicitModel && !hasConfiguredModels
              ? t('chat.configure_model_first')
              : requiresExplicitModel && !hasValidSelection
                ? t('chat.select_model')
                : (placeholder ?? t('chat.type_message'))
          }
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={disabled}
          onPastedImagesChange={onPastedImagesChange}
          onAttachmentsChange={onAttachmentsChange}
          autoFocus={autoFocus}
        />
        <InputGroupAddon align="block-end">
          {showModelSelector && (
            <DropdownMenu
              modal={false}
              open={modelPickerOpen}
              onOpenChange={(open) => {
                setModelPickerOpen(open)
                if (!open) {
                  setModelSearch('')
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <InputGroupButton
                  variant="ghost"
                  disabled={disabled || isLoadingModels || isSending}
                  className={cn(
                    'flex items-center gap-1.5 transition-colors',
                    !hasValidSelection &&
                      'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/30'
                  )}
                >
                  {hasValidSelection ? (
                    getProviderLogoAsset(selectedProvider) && (
                      <img
                        src={getProviderLogoAsset(selectedProvider)!.src}
                        alt={selectedProvider}
                        className={cn(
                          'size-3.5 object-contain opacity-80',
                          getProviderLogoAsset(selectedProvider)?.invertInDark && 'dark:invert'
                        )}
                      />
                    )
                  ) : (
                    <AlertCircle className="size-3.5" />
                  )}
                  <span className="text-xs font-medium">{selectedModelName}</span>
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[420px] p-0 [--radius:1rem] -translate-x-32"
                container={portalContainer}
              >
                {isLoadingModels ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t('chat.loading_models')}
                  </div>
                ) : !hasConfiguredModels ? (
                  <div className="space-y-3 px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('chat.no_models_configured')}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mx-auto"
                      onClick={() => eventBus.emit('open-settings', { tab: 'models' })}
                    >
                      {t('chat.open_settings')}
                    </Button>
                  </div>
                ) : (
                  <Command shouldFilter={false} className="bg-transparent">
                    <CommandInput
                      value={modelSearch}
                      onValueChange={setModelSearch}
                      autoFocus
                      placeholder={t('chat.search_models_placeholder')}
                    />
                    <CommandList className="max-h-[360px] p-1.5">
                      <CommandEmpty>{t('chat.no_filtered_models')}</CommandEmpty>
                      {filteredModels.map((model) => {
                        const isSelected = selectedModelId === model.id

                        return (
                          <CommandItem
                            key={model.id}
                            value={model.searchText}
                            onSelect={() => {
                              onModelChangeRef.current?.(model.id)
                              setModelPickerOpen(false)
                            }}
                            className={cn(
                              'cursor-pointer rounded-xl px-3 py-3 data-[selected=true]:bg-accent/50',
                              isSelected && 'bg-accent/30'
                            )}
                          >
                            <div className="flex w-full items-start gap-3">
                              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                                {model.providerLogo ? (
                                  <img
                                    src={model.providerLogo.src}
                                    alt={model.providerName}
                                    className={cn(
                                      'size-4 object-contain opacity-90',
                                      model.providerLogo.invertInDark && 'dark:invert'
                                    )}
                                  />
                                ) : (
                                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                    {model.providerId.slice(0, 2)}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="truncate font-mono text-sm font-medium text-foreground">
                                    {model.modelId}
                                  </span>
                                  {model.contextWindow && (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {model.contextWindow}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {!model.providerLogo && (
                                    <span className="truncate">{model.providerName}</span>
                                  )}
                                  {model.displayName !== model.modelId && (
                                    <span className="truncate">{model.displayName}</span>
                                  )}
                                  {model.costLabel && <span>{model.costLabel}</span>}
                                  {model.reasoning && (
                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                      Reasoning
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandList>
                  </Command>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="ml-auto flex items-center gap-1">
            {showModelSelector &&
              hasValidSelection &&
              usedTokens != null &&
              usedTokens > 0 &&
              maxTokens &&
              usage && (
                <Context
                  maxTokens={maxTokens}
                  modelId={selectedModel}
                  usage={usage}
                  usedTokens={usedTokens}
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
                disabled={!hasContent || disabled || (requiresExplicitModel && !hasValidSelection)}
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
