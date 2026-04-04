import { useState, useMemo, type ReactElement } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from 'react-i18next'
import { MODELS_DATABASE } from '@/constants/models'

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  groq: 'Groq',
  mistral: 'Mistral',
  xai: 'xAI',
  alibaba: 'Alibaba',
  'alibaba-cn': 'Alibaba (China)',
  fireworks: 'Fireworks AI',
  together: 'Together AI',
  perplexity: 'Perplexity',
  moonshot: 'Moonshot AI',
  zhipu: 'Zhipu AI'
}

const PROVIDER_MODELS: Record<string, string[]> = (() => {
  const acc: Record<string, string[]> = {}
  for (const m of MODELS_DATABASE) {
    const label = PROVIDER_LABEL[m.provider]
    if (!label) continue
    if (!acc[label]) acc[label] = []
    acc[label].push(m.id)
  }
  return acc
})()

interface ModelSelectProps {
  provider: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ModelSelect({
  provider,
  value,
  onChange,
  disabled
}: ModelSelectProps): ReactElement {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const availableModels = useMemo(
    () => (provider ? PROVIDER_MODELS[provider] || [] : []),
    [provider]
  )
  const hasModels = availableModels.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || !provider}
        >
          {!provider ? (
            <span className="text-muted-foreground">请先选择提供商</span>
          ) : !hasModels ? (
            <span className="text-muted-foreground">自定义输入模型名称</span>
          ) : value && availableModels.includes(value) ? (
            value
          ) : value ? (
            <span className="flex items-center gap-2">
              {value}
              <span className="text-xs text-muted-foreground">(自定义)</span>
            </span>
          ) : (
            '选择模型...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder={t('model_select.search_placeholder')} />
          {!hasModels ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>{t('model_select.no_models')}</p>
              <p className="mt-1 text-xs">{t('model_select.manual_input_hint')}</p>
            </div>
          ) : (
            <>
              <CommandEmpty>未找到模型</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {availableModels.map((model) => (
                  <CommandItem
                    key={model}
                    value={model}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? '' : currentValue)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', value === model ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="font-mono text-xs">{model}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
