import { useRef, useCallback, useState, useEffect } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea
} from '../ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { Plus, ArrowUp, X, Bot, Wrench, Square } from 'lucide-react'
import { getProviderLogo } from '@/lib/provider-logos'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export interface PastedImage {
  id: string
  dataUrl: string
  name: string
  size: number
}

export interface Agent {
  id: string
  name: string
  description?: string
  model?: string
  provider?: string
  avatar?: string
  tools?: number
  metadata?: {
    isSystem?: boolean
  }
}

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
  minHeight?: string
  /** 可选：获取当前选中的 agent ID */
  onAgentChange?: (agentId: string) => void
  /** 可选：默认选中的 agent ID */
  defaultAgentId?: string
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
  minHeight = '80px',
  onAgentChange,
  defaultAgentId
}: ChatInputProps) {
  const { t } = useTranslation('chat')
  const resolvedPlaceholder = placeholder ?? t('input.placeholderAsk')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId || '')

  // 加载 agents 列表
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await window.api.agents.getAll()

        // 加载每个 agent 的头像和详细信息
        const mappedAgents: Agent[] = await Promise.all(
          data.map(async (agent: any) => {
            let avatarData: string | undefined

            // 如果 metadata.avatar 存在
            if (agent.metadata?.avatar) {
              // 判断是 URL 还是文件名
              if (
                agent.metadata.avatar.startsWith('http://') ||
                agent.metadata.avatar.startsWith('https://')
              ) {
                // 是 URL，直接使用
                avatarData = agent.metadata.avatar
              } else {
                // 是文件名，加载为 Base64
                try {
                  avatarData = await window.api.avatar.readAsBase64(agent.metadata.avatar)
                } catch (error) {
                  console.error('Failed to load avatar for agent:', agent.id, error)
                }
              }
            }

            return {
              id: agent.id,
              name: agent.name,
              description: agent.description || '',
              model: agent.model,
              provider: agent.provider,
              tools: Array.isArray(agent.tools) ? agent.tools.length : 0,
              avatar: avatarData,
              metadata: agent.metadata
            }
          })
        )

        setAgents(mappedAgents)
        // 如果没有默认值且有 agents，选择第一个
        if (!defaultAgentId && mappedAgents.length > 0) {
          setSelectedAgentId(mappedAgents[0].id)
          onAgentChange?.(mappedAgents[0].id)
        }
      } catch (error) {
        console.error('Failed to load agents:', error)
      }
    }
    loadAgents()
  }, [])

  // 同步 defaultAgentId 变化
  useEffect(() => {
    if (defaultAgentId && defaultAgentId !== selectedAgentId) {
      setSelectedAgentId(defaultAgentId)
    }
  }, [defaultAgentId, selectedAgentId])

  // 处理 agent 选择变化
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId)
    onAgentChange?.(agentId)
  }

  // 处理粘贴事件
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string
              const newImage: PastedImage = {
                id: `img-${Date.now()}-${i}`,
                dataUrl,
                name: file.name || t('input.pastedImageFileName', { ts: Date.now() }),
                size: file.size
              }
              onPastedImagesChange([...pastedImages, newImage])
            }
            reader.readAsDataURL(file)
          }
        }
      }
    },
    [pastedImages, onPastedImagesChange, t]
  )

  // 删除粘贴的图片
  const handleRemoveImage = (imageId: string) => {
    onPastedImagesChange(pastedImages.filter((img) => img.id !== imageId))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isSending && (value.trim() || pastedImages.length > 0) && !disabled) {
        onSend()
      }
    }
  }

  return (
    <div>
      {/* 图片预览区域 - 显示在输入框上方 */}
      {pastedImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 pb-2">
          {pastedImages.map((image) => (
            <div
              key={image.id}
              className="group relative inline-block overflow-hidden rounded-lg border border-border bg-muted/50"
            >
              <img src={image.dataUrl} alt={image.name} className="h-20 w-20 object-cover" />
              {/* 删除按钮 */}
              <button
                onClick={() => handleRemoveImage(image.id)}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                title={t('input.removeImage')}
              >
                <X className="size-3" />
              </button>
              {/* 文件名提示 */}
              <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate">{image.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <InputGroup className="[--radius:1.5rem]">
        <InputGroupTextarea
          ref={textareaRef}
          placeholder={resolvedPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          className="resize-none"
          style={{ minHeight }}
        />
        <InputGroupAddon align="block-end">
          {/* Agent 选择器 */}
          {agents.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton variant="ghost" disabled={disabled || isSending}>
                  {agents.find((a) => a.id === selectedAgentId)?.name || t('input.selectAgent')}
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[320px] max-h-[400px] overflow-y-auto [--radius:0.95rem] -translate-x-32"
              >
                {agents.map((agent) => {
                  const providerLogo = agent.provider ? getProviderLogo(agent.provider) : undefined

                  return (
                    <DropdownMenuItem
                      key={agent.id}
                      onSelect={() => handleAgentChange(agent.id)}
                      className={cn(
                        'cursor-pointer p-3',
                        agent.id === selectedAgentId && 'bg-accent'
                      )}
                    >
                      <div className="flex w-full items-start gap-3">
                        <Avatar className="size-10 shrink-0">
                          {agent.avatar ? (
                            <AvatarImage src={agent.avatar} alt={agent.name} />
                          ) : null}
                          <AvatarFallback className="bg-primary">
                            <Bot className="size-5 text-primary-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="truncate text-sm font-medium">{agent.name}</h4>
                            {agent.metadata?.isSystem && (
                              <Badge variant="default" className="px-1 py-0 text-[9px] h-4">
                                {t('input.systemBadge')}
                              </Badge>
                            )}
                            {agent.model && (
                              <Badge variant="outline" className="h-4 gap-1 px-1 text-[9px]">
                                {providerLogo && (
                                  <img
                                    src={providerLogo}
                                    alt={agent.provider}
                                    className="size-2.5"
                                  />
                                )}
                                {agent.model}
                              </Badge>
                            )}
                            {agent.tools !== undefined && agent.tools > 0 && (
                              <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[9px]">
                                {agent.tools}
                                <Wrench className="size-2.5" />
                              </Badge>
                            )}
                          </div>
                          {agent.description && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {agent.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 附件按钮 */}
          <InputGroupButton
            variant="outline"
            className="rounded-full"
            size="icon-xs"
            disabled={disabled || isSending}
          >
            <Plus className="size-4" />
          </InputGroupButton>

          {/* 发送/停止按钮 */}
          <InputGroupButton
            variant="default"
            className="ml-auto rounded-full"
            size="icon-xs"
            disabled={!isSending && ((!value.trim() && pastedImages.length === 0) || disabled)}
            onClick={isSending ? onStop : onSend}
            title={isSending ? t('input.stopGeneratingTitle') : t('input.sendMessageTitle')}
          >
            {!isSending ? (
              <>
                <ArrowUp className="size-4" />
                <span className="sr-only">{t('input.send')}</span>
              </>
            ) : (
              <>
                <Square className="size-3 fill-current" />
                <span className="sr-only">{t('input.stop')}</span>
              </>
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
