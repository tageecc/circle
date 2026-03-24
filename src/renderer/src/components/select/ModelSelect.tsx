import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

// 各提供商支持的模型列表 - 来源: https://mastra.ai/models/providers/
const PROVIDER_MODELS: Record<string, string[]> = {
  OpenAI: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o1-preview'
  ],
  Anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],
  Google: [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-pro'
  ],
  DeepSeek: ['deepseek-chat', 'deepseek-reasoner'],
  Groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ],
  Mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'mistral-tiny'
  ],
  xAI: ['grok-beta', 'grok-vision-beta'],
  Alibaba: [
    'qwen-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen2.5-72b-instruct',
    'qwen2.5-32b-instruct',
    'qwen2.5-14b-instruct',
    'qwen2.5-7b-instruct',
    'qwen-vl-max',
    'qwen-vl-plus'
  ],
  'Alibaba (China)': [
    'qwen3-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen-flash',
    'qwen-long',
    'qwen2-5-72b-instruct',
    'qwen2-5-32b-instruct',
    'qwen2-5-14b-instruct',
    'qwen2-5-7b-instruct',
    'qwen3-next-80b-a3b-thinking',
    'qwq-32b',
    'qwq-plus',
    'deepseek-r1',
    'deepseek-v3'
  ],
  'Fireworks AI': [
    'accounts/fireworks/models/llama-v3p3-70b-instruct',
    'accounts/fireworks/models/llama-v3p1-70b-instruct',
    'accounts/fireworks/models/llama-v3p1-8b-instruct'
  ],
  'Together AI': [
    'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
  ],
  Perplexity: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online']
}

interface ModelSelectProps {
  provider: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ModelSelect({ provider, value, onChange, disabled }: ModelSelectProps) {
  const [open, setOpen] = useState(false)

  const availableModels = provider ? PROVIDER_MODELS[provider] || [] : []
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
          <CommandInput placeholder="搜索模型..." />
          {!hasModels ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>该提供商暂无预设模型</p>
              <p className="mt-1 text-xs">请手动输入模型名称</p>
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
