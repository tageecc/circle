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
import { PROVIDER_MODELS } from '@/config/models'
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
  
  // 设置下拉菜单的挂载容器
  useEffect(() => {
    if (inputGroupRef.current) {
      setPortalContainer(inputGroupRef.current)
    }
  }, [])

  const selectedModelName = useMemo(() => {
    const providerConfig = PROVIDER_MODELS[selectedProvider]
    if (!providerConfig) return selectedModel
    const modelInfo = providerConfig.models.find((m) => m.id === selectedModel)
    return modelInfo?.name || selectedModel
  }, [selectedProvider, selectedModel])

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
              {Object.entries(PROVIDER_MODELS).map(([provider, { nameKey, models }]) => (
                <div key={provider}>
                  <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2">
                    {getProviderLogo(provider) && (
                      <img
                        src={getProviderLogo(provider)!}
                        alt={provider}
                        className="size-4 dark:invert opacity-70"
                      />
                    )}
                    <span className="text-xs font-semibold text-foreground">{t(nameKey)}</span>
                  </DropdownMenuLabel>
                  {models.map((model) => (
                    <DropdownMenuItem
                      key={`${provider}-${model.id}`}
                      onSelect={() => handleModelChange(provider, model.id)}
                      className={cn(
                        'cursor-pointer px-3 py-3 focus:bg-accent/50',
                        selectedProvider === provider &&
                          selectedModel === model.id &&
                          'bg-accent/30'
                      )}
                    >
                      <div className="flex w-full flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{model.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.contextWindow}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {t(model.descriptionKey)}
                        </p>
                        {model.capabilityKeys && model.capabilityKeys.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {model.capabilityKeys.map((capKey) => (
                              <span
                                key={capKey}
                                className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                              >
                                {t(capKey)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="my-1" />
                </div>
              ))}
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
