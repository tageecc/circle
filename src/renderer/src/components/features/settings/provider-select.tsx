import { useState, type ReactElement } from 'react'
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

const CATALOG_MODEL_COUNT: Record<string, number> = {}
for (const m of MODELS_DATABASE) {
  CATALOG_MODEL_COUNT[m.provider] = (CATALOG_MODEL_COUNT[m.provider] || 0) + 1
}

function catalogCount(providerId: string): number {
  return CATALOG_MODEL_COUNT[providerId] ?? 0
}

// value = provider ID; models = entries in src/renderer/src/constants/models.ts for that provider
const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: catalogCount('openai') },
  { value: 'anthropic', label: 'Anthropic', models: catalogCount('anthropic') },
  { value: 'google', label: 'Google', models: catalogCount('google') },
  { value: 'deepseek', label: 'DeepSeek', models: catalogCount('deepseek') },
  { value: 'groq', label: 'Groq', models: catalogCount('groq') },
  { value: 'mistral', label: 'Mistral', models: catalogCount('mistral') },
  { value: 'xai', label: 'xAI', models: catalogCount('xai') },
  { value: 'aihubmix', label: 'AIHubMix', models: 0 },
  { value: 'alibaba', label: 'Alibaba', models: catalogCount('alibaba') },
  { value: 'alibaba-cn', label: 'Alibaba (China)', models: catalogCount('alibaba-cn') },
  { value: 'amazon-bedrock', label: 'Amazon Bedrock', models: 0 },
  { value: 'azure', label: 'Azure', models: 0 },
  { value: 'baseten', label: 'Baseten', models: 0 },
  { value: 'cerebras', label: 'Cerebras', models: 0 },
  { value: 'chutes', label: 'Chutes', models: 0 },
  { value: 'cloudflare', label: 'Cloudflare Workers AI', models: 0 },
  { value: 'cortecs', label: 'Cortecs', models: 0 },
  { value: 'deepinfra', label: 'Deep Infra', models: 0 },
  { value: 'fastrouter', label: 'FastRouter', models: 0 },
  { value: 'fireworks', label: 'Fireworks AI', models: catalogCount('fireworks') },
  { value: 'github', label: 'GitHub Models', models: 0 },
  { value: 'google-vertex', label: 'Google Vertex AI', models: 0 },
  { value: 'huggingface', label: 'Hugging Face', models: 0 },
  { value: 'inception', label: 'Inception', models: 0 },
  { value: 'inference', label: 'Inference', models: 0 },
  { value: 'llama', label: 'Llama', models: 0 },
  { value: 'lmstudio', label: 'LMStudio', models: 0 },
  { value: 'lucidquery', label: 'LucidQuery AI', models: 0 },
  { value: 'modelscope', label: 'ModelScope', models: 0 },
  { value: 'moonshot', label: 'Moonshot AI', models: catalogCount('moonshot') },
  { value: 'moonshot-cn', label: 'Moonshot AI (China)', models: 0 },
  { value: 'morph', label: 'Morph', models: 0 },
  { value: 'nebius', label: 'Nebius AI Studio', models: 0 },
  { value: 'nvidia', label: 'Nvidia', models: 0 },
  { value: 'ollama', label: 'Ollama', models: 0 },
  { value: 'opencode-zen', label: 'OpenCode Zen', models: 0 },
  { value: 'openrouter', label: 'OpenRouter', models: 0 },
  { value: 'perplexity', label: 'Perplexity', models: catalogCount('perplexity') },
  { value: 'requesty', label: 'Requesty', models: 0 },
  { value: 'scaleway', label: 'Scaleway', models: 0 },
  { value: 'submodel', label: 'submodel', models: 0 },
  { value: 'synthetic', label: 'Synthetic', models: 0 },
  { value: 'together', label: 'Together AI', models: catalogCount('together') },
  { value: 'upstage', label: 'Upstage', models: 0 },
  { value: 'venice', label: 'Venice AI', models: 0 },
  { value: 'vultr', label: 'Vultr', models: 0 },
  { value: 'wandb', label: 'Weights & Biases', models: 0 },
  { value: 'zai', label: 'Z.AI', models: 0 },
  { value: 'zai-coding', label: 'Z.AI Coding Plan', models: 0 },
  { value: 'zenmux', label: 'ZenMux', models: 0 },
  { value: 'zhipu', label: 'Zhipu AI', models: catalogCount('zhipu') },
  { value: 'zhipu-coding', label: 'Zhipu AI Coding Plan', models: 0 }
].sort((a, b) => a.label.localeCompare(b.label))

interface ProviderSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ProviderSelect({ value, onChange, disabled }: ProviderSelectProps): ReactElement {
  const { t } = useTranslation()
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
                    <span className="text-xs text-muted-foreground">
                      {t('provider_select.models_count', { count: provider.models })}
                    </span>
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
