import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

// Mastra 支持的所有模型提供商 - 来源: https://mastra.ai/models/providers/
// value 使用 Mastra 标准 ID，label 用于 UI 显示
const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: 31 },
  { value: 'anthropic', label: 'Anthropic', models: 19 },
  { value: 'google', label: 'Google', models: 24 },
  { value: 'deepseek', label: 'DeepSeek', models: 2 },
  { value: 'groq', label: 'Groq', models: 17 },
  { value: 'mistral', label: 'Mistral', models: 19 },
  { value: 'xai', label: 'xAI', models: 20 },
  { value: 'aihubmix', label: 'AIHubMix', models: 0 },
  { value: 'alibaba', label: 'Alibaba', models: 39 },
  { value: 'alibaba-cn', label: 'Alibaba (China)', models: 61 },
  { value: 'amazon-bedrock', label: 'Amazon Bedrock', models: 0 },
  { value: 'azure', label: 'Azure', models: 0 },
  { value: 'baseten', label: 'Baseten', models: 3 },
  { value: 'cerebras', label: 'Cerebras', models: 3 },
  { value: 'chutes', label: 'Chutes', models: 33 },
  { value: 'cloudflare', label: 'Cloudflare Workers AI', models: 0 },
  { value: 'cortecs', label: 'Cortecs', models: 11 },
  { value: 'deepinfra', label: 'Deep Infra', models: 4 },
  { value: 'fastrouter', label: 'FastRouter', models: 14 },
  { value: 'fireworks', label: 'Fireworks AI', models: 10 },
  { value: 'github', label: 'GitHub Models', models: 55 },
  { value: 'google-vertex', label: 'Google Vertex AI', models: 0 },
  { value: 'huggingface', label: 'Hugging Face', models: 14 },
  { value: 'inception', label: 'Inception', models: 2 },
  { value: 'inference', label: 'Inference', models: 9 },
  { value: 'llama', label: 'Llama', models: 7 },
  { value: 'lmstudio', label: 'LMStudio', models: 3 },
  { value: 'lucidquery', label: 'LucidQuery AI', models: 2 },
  { value: 'modelscope', label: 'ModelScope', models: 7 },
  { value: 'moonshot', label: 'Moonshot AI', models: 3 },
  { value: 'moonshot-cn', label: 'Moonshot AI (China)', models: 3 },
  { value: 'morph', label: 'Morph', models: 3 },
  { value: 'nebius', label: 'Nebius AI Studio', models: 15 },
  { value: 'nvidia', label: 'Nvidia', models: 16 },
  { value: 'ollama', label: 'Ollama', models: 0 },
  { value: 'opencode-zen', label: 'OpenCode Zen', models: 14 },
  { value: 'openrouter', label: 'OpenRouter', models: 0 },
  { value: 'perplexity', label: 'Perplexity', models: 4 },
  { value: 'requesty', label: 'Requesty', models: 13 },
  { value: 'scaleway', label: 'Scaleway', models: 13 },
  { value: 'submodel', label: 'submodel', models: 9 },
  { value: 'synthetic', label: 'Synthetic', models: 22 },
  { value: 'together', label: 'Together AI', models: 6 },
  { value: 'upstage', label: 'Upstage', models: 2 },
  { value: 'venice', label: 'Venice AI', models: 13 },
  { value: 'vultr', label: 'Vultr', models: 5 },
  { value: 'wandb', label: 'Weights & Biases', models: 10 },
  { value: 'zai', label: 'Z.AI', models: 5 },
  { value: 'zai-coding', label: 'Z.AI Coding Plan', models: 5 },
  { value: 'zenmux', label: 'ZenMux', models: 18 },
  { value: 'zhipu', label: 'Zhipu AI', models: 5 },
  { value: 'zhipu-coding', label: 'Zhipu AI Coding Plan', models: 5 }
].sort((a, b) => a.label.localeCompare(b.label))

interface ProviderSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ProviderSelect({ value, onChange, disabled }: ProviderSelectProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value ? PROVIDERS.find((provider) => provider.value === value)?.label : '选择提供商...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="搜索提供商..." />
          <CommandEmpty>未找到提供商</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {PROVIDERS.map((provider) => (
              <CommandItem
                key={provider.value}
                value={provider.value}
                onSelect={() => {
                  // 直接使用 provider.value，避免被转换成小写
                  onChange(provider.value === value ? '' : provider.value)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === provider.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex flex-1 items-center justify-between">
                  <span>{provider.label}</span>
                  {provider.models > 0 && (
                    <span className="text-xs text-muted-foreground">{provider.models} 个模型</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
