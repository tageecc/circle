export type ProviderKind = 'openai-compatible' | 'anthropic' | 'google' | 'credential-only'

export interface ProviderRuntimeConfig {
  id: string
  kind: ProviderKind
  defaultBaseURL?: string
  envApiKey?: string
  envBaseURL?: string
  requiresApiKey: boolean
  supportsBaseURL: boolean
  aliases?: string[]
}

export interface EmbeddingProviderConfig {
  id: string
  label: string
  providerId: string
  model: string
  dimensions: number
}

export const PROVIDER_RUNTIME_CONFIGS: Record<string, ProviderRuntimeConfig> = {
  anthropic: {
    id: 'anthropic',
    kind: 'anthropic',
    defaultBaseURL: 'https://api.anthropic.com',
    envApiKey: 'ANTHROPIC_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: false,
    aliases: ['Anthropic', 'Anthropic (Claude)']
  },
  openai: {
    id: 'openai',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.openai.com/v1',
    envApiKey: 'OPENAI_API_KEY',
    envBaseURL: 'OPENAI_BASE_URL',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['OpenAI', 'OpenAI (GPT)']
  },
  google: {
    id: 'google',
    kind: 'google',
    defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta',
    envApiKey: 'GOOGLE_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: false,
    aliases: ['Google', 'Google (Gemini)']
  },
  deepseek: {
    id: 'deepseek',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    envApiKey: 'DEEPSEEK_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['DeepSeek']
  },
  openrouter: {
    id: 'openrouter',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://openrouter.ai/api/v1',
    envApiKey: 'OPENROUTER_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['OpenRouter']
  },
  xai: {
    id: 'xai',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.x.ai/v1',
    envApiKey: 'XAI_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['xAI', 'xAI (Grok)']
  },
  mistral: {
    id: 'mistral',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.mistral.ai/v1',
    envApiKey: 'MISTRAL_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Mistral']
  },
  groq: {
    id: 'groq',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.groq.com/openai/v1',
    envApiKey: 'GROQ_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Groq']
  },
  together: {
    id: 'together',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.together.xyz/v1',
    envApiKey: 'TOGETHER_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Together', 'Together AI']
  },
  cerebras: {
    id: 'cerebras',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.cerebras.ai/v1',
    envApiKey: 'CEREBRAS_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Cerebras']
  },
  alibaba: {
    id: 'alibaba',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    envApiKey: 'DASHSCOPE_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Alibaba', 'Alibaba DashScope']
  },
  'alibaba-cn': {
    id: 'alibaba-cn',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envApiKey: 'DASHSCOPE_API_KEY',
    envBaseURL: 'DASHSCOPE_BASE_URL',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Alibaba (China)', 'Alibaba Bailian', 'Alibaba Bailian (国内)', 'dashscope']
  },
  moonshot: {
    id: 'moonshot',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.moonshot.ai/v1',
    envApiKey: 'MOONSHOT_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Moonshot', 'Moonshot (Kimi)']
  },
  zhipu: {
    id: 'zhipu',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
    envApiKey: 'ZHIPU_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Zhipu', 'Zhipu (GLM)']
  },
  perplexity: {
    id: 'perplexity',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.perplexity.ai',
    envApiKey: 'PERPLEXITY_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Perplexity']
  },
  fireworks: {
    id: 'fireworks',
    kind: 'openai-compatible',
    defaultBaseURL: 'https://api.fireworks.ai/inference/v1',
    envApiKey: 'FIREWORKS_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: true,
    aliases: ['Fireworks', 'Fireworks AI']
  },
  ollama: {
    id: 'ollama',
    kind: 'openai-compatible',
    defaultBaseURL: 'http://127.0.0.1:11434/v1',
    requiresApiKey: false,
    supportsBaseURL: true,
    aliases: ['Ollama', 'Ollama (local)']
  },
  lmstudio: {
    id: 'lmstudio',
    kind: 'openai-compatible',
    defaultBaseURL: 'http://127.0.0.1:1234/v1',
    requiresApiKey: false,
    supportsBaseURL: true,
    aliases: ['LMStudio', 'LMStudio (local)']
  },
  custom: {
    id: 'custom',
    kind: 'openai-compatible',
    requiresApiKey: false,
    supportsBaseURL: true,
    aliases: ['Custom', 'Custom (OpenAI-compatible)']
  },
  voyage: {
    id: 'voyage',
    kind: 'credential-only',
    envApiKey: 'VOYAGE_API_KEY',
    requiresApiKey: true,
    supportsBaseURL: false,
    aliases: ['Voyage', 'Voyage AI']
  }
}

const PROVIDER_ALIAS_LOOKUP = Object.values(PROVIDER_RUNTIME_CONFIGS).reduce<Record<string, string>>(
  (lookup, config) => {
    lookup[config.id.toLowerCase()] = config.id
    for (const alias of config.aliases ?? []) {
      lookup[alias.trim().toLowerCase()] = config.id
    }
    return lookup
  },
  {}
)

export const EMBEDDING_PROVIDER_CONFIGS: Record<string, EmbeddingProviderConfig> = {
  'openai-small': {
    id: 'openai-small',
    label: 'OpenAI · text-embedding-3-small',
    providerId: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536
  },
  'openai-large': {
    id: 'openai-large',
    label: 'OpenAI · text-embedding-3-large',
    providerId: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 3072
  },
  'voyage-code': {
    id: 'voyage-code',
    label: 'Voyage AI · voyage-code-2',
    providerId: 'voyage',
    model: 'voyage-code-2',
    dimensions: 1536
  },
  'qwen-embed': {
    id: 'qwen-embed',
    label: 'Alibaba Bailian · text-embedding-v3',
    providerId: 'alibaba-cn',
    model: 'text-embedding-v3',
    dimensions: 1024
  }
}

export function normalizeProviderId(providerId: string): string {
  const normalized = providerId.trim().toLowerCase()
  return PROVIDER_ALIAS_LOOKUP[normalized] ?? providerId.trim()
}

export function normalizeModelId(modelId: string): string {
  const separatorIndex = modelId.indexOf('/')
  if (separatorIndex === -1) {
    return modelId.trim()
  }

  const provider = modelId.slice(0, separatorIndex)
  const model = modelId.slice(separatorIndex + 1)
  return `${normalizeProviderId(provider)}/${model}`
}

export function getProviderRuntimeConfig(providerId: string): ProviderRuntimeConfig | undefined {
  return PROVIDER_RUNTIME_CONFIGS[normalizeProviderId(providerId)]
}

export function providerRequiresApiKey(providerId: string): boolean {
  return getProviderRuntimeConfig(providerId)?.requiresApiKey ?? true
}

export function providerSupportsBaseURL(providerId: string): boolean {
  return getProviderRuntimeConfig(providerId)?.supportsBaseURL ?? false
}

export function getEmbeddingProviderConfig(
  embeddingProviderId: string
): EmbeddingProviderConfig | undefined {
  return EMBEDDING_PROVIDER_CONFIGS[embeddingProviderId]
}
