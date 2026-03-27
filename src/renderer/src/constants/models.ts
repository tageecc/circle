// Curated AI model catalog with context window and pricing info
// Last updated: 2026-03-27

export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow: number
  maxTokens: number
  cost: {
    input: number // USD per 1M input tokens
    output: number
    cacheRead?: number
    cacheWrite?: number
  }
  reasoning?: boolean
  input?: string[] // Supported input types: text, image, video, audio
  deprecated?: boolean
}

export const MODELS_DATABASE: ModelInfo[] = [
  // ===== OpenAI =====
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 2.5, output: 10.0 },
    input: ['text', 'image', 'audio']
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0.15, output: 0.6 }
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 10.0, output: 30.0 }
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    contextWindow: 8192,
    maxTokens: 4096,
    cost: { input: 30.0, output: 60.0 }
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextWindow: 16385,
    maxTokens: 4096,
    cost: { input: 0.5, output: 1.5 }
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    contextWindow: 200000,
    maxTokens: 64000,
    cost: { input: 15.0, output: 60.0 },
    reasoning: true
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 64000,
    cost: { input: 3.0, output: 12.0 },
    reasoning: true
  },
  {
    id: 'o1-preview',
    name: 'o1 Preview',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 32768,
    cost: { input: 15.0, output: 60.0 },
    reasoning: true
  },

  // ===== Anthropic Claude =====
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
    input: ['text', 'image']
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 1.0, output: 5.0 },
    input: ['text', 'image']
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    cost: { input: 15.0, output: 75.0 },
    input: ['text', 'image']
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    cost: { input: 3.0, output: 15.0 },
    input: ['text', 'image']
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    cost: { input: 0.25, output: 1.25 },
    input: ['text', 'image']
  },

  // ===== Google Gemini =====
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'google',
    contextWindow: 1000000,
    maxTokens: 8000,
    cost: { input: 0.0, output: 0.0 },
    input: ['text', 'image', 'audio', 'video']
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2000000,
    maxTokens: 8192,
    cost: { input: 1.25, output: 5.0 },
    input: ['text', 'image', 'audio', 'video']
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.075, output: 0.3 },
    input: ['text', 'image', 'audio', 'video']
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash 8B',
    provider: 'google',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.0375, output: 0.15 },
    input: ['text', 'image', 'audio', 'video']
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    contextWindow: 32000,
    maxTokens: 8192,
    cost: { input: 0.5, output: 1.5 },
    input: ['text', 'image']
  },

  // ===== DeepSeek =====
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    contextWindow: 128000,
    maxTokens: 8000,
    cost: { input: 0.28, output: 0.42, cacheRead: 0.028 }
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    contextWindow: 128000,
    maxTokens: 64000,
    cost: { input: 0.28, output: 0.42, cacheRead: 0.028 },
    reasoning: true
  },

  // ===== xAI Grok =====
  {
    id: 'grok-beta',
    name: 'Grok Beta',
    provider: 'xai',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 5.0, output: 15.0 }
  },
  {
    id: 'grok-vision-beta',
    name: 'Grok Vision Beta',
    provider: 'xai',
    contextWindow: 8192,
    maxTokens: 4096,
    cost: { input: 5.0, output: 15.0 },
    input: ['text', 'image']
  },

  // ===== Mistral =====
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large Latest',
    provider: 'mistral',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 2.0, output: 6.0 }
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium Latest',
    provider: 'mistral',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.7, output: 2.1 }
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small Latest',
    provider: 'mistral',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.2, output: 0.6 }
  },
  {
    id: 'mistral-tiny',
    name: 'Mistral Tiny',
    provider: 'mistral',
    contextWindow: 32000,
    maxTokens: 8192,
    cost: { input: 0.14, output: 0.42 }
  },

  // ===== Groq =====
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.59, output: 0.79 }
  },
  {
    id: 'llama-3.1-70b-versatile',
    name: 'Llama 3.1 70B',
    provider: 'groq',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.59, output: 0.79 }
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    provider: 'groq',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.05, output: 0.08 }
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    contextWindow: 32768,
    maxTokens: 32768,
    cost: { input: 0.24, output: 0.24 }
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'groq',
    contextWindow: 8192,
    maxTokens: 8192,
    cost: { input: 0.2, output: 0.2 }
  },

  // ===== Alibaba DashScope =====
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'alibaba',
    contextWindow: 8000,
    maxTokens: 2000,
    cost: { input: 0.4, output: 1.2 }
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: 'alibaba',
    contextWindow: 32000,
    maxTokens: 2000,
    cost: { input: 0.143, output: 0.429 }
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'alibaba',
    contextWindow: 8000,
    maxTokens: 1500,
    cost: { input: 0.029, output: 0.086 }
  },
  {
    id: 'qwen2.5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.057, output: 0.171 }
  },
  {
    id: 'qwen2.5-32b-instruct',
    name: 'Qwen2.5 32B Instruct',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.029, output: 0.086 }
  },
  {
    id: 'qwen2.5-14b-instruct',
    name: 'Qwen2.5 14B Instruct',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.014, output: 0.043 }
  },
  {
    id: 'qwen2.5-7b-instruct',
    name: 'Qwen2.5 7B Instruct',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.007, output: 0.021 }
  },
  {
    id: 'qwen-vl-max',
    name: 'Qwen VL Max',
    provider: 'alibaba',
    contextWindow: 32768,
    maxTokens: 8192,
    cost: { input: 0.057, output: 0.143 },
    input: ['text', 'image']
  },
  {
    id: 'qwen-vl-plus',
    name: 'Qwen VL Plus',
    provider: 'alibaba',
    contextWindow: 32768,
    maxTokens: 8192,
    cost: { input: 0.029, output: 0.057 },
    input: ['text', 'image']
  },

  // ===== Alibaba Bailian (China) =====
  {
    id: 'qwen3-max',
    name: 'Qwen3 Max',
    provider: 'alibaba-cn',
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0.343, output: 1.371, cacheRead: 0.034 },
    reasoning: true
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.217, output: 0.543, cacheRead: 0.022 }
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.043, output: 0.086 }
  },
  {
    id: 'qwen-flash',
    name: 'Qwen Flash',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.043, output: 0.086, cacheRead: 0.004 }
  },
  {
    id: 'qwen-long',
    name: 'Qwen Long',
    provider: 'alibaba-cn',
    contextWindow: 10000000,
    maxTokens: 8192,
    cost: { input: 0.071, output: 0.143 }
  },
  {
    id: 'qwen2-5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.057, output: 0.171 }
  },
  {
    id: 'qwen2-5-32b-instruct',
    name: 'Qwen2.5 32B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.029, output: 0.086 }
  },
  {
    id: 'qwen2-5-14b-instruct',
    name: 'Qwen2.5 14B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.014, output: 0.043 }
  },
  {
    id: 'qwen2-5-7b-instruct',
    name: 'Qwen2.5 7B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.007, output: 0.021 }
  },
  {
    id: 'qwen3-next-80b-a3b-thinking',
    name: 'Qwen3 Next 80B Thinking',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.286, output: 0.857 },
    reasoning: true
  },
  {
    id: 'qwq-32b',
    name: 'QwQ 32B',
    provider: 'alibaba-cn',
    contextWindow: 32768,
    maxTokens: 8192,
    cost: { input: 0.286, output: 0.857 },
    reasoning: true
  },
  {
    id: 'qwq-plus',
    name: 'QwQ Plus',
    provider: 'alibaba-cn',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.514, output: 1.543 },
    reasoning: true
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'alibaba-cn',
    contextWindow: 65536,
    maxTokens: 8192,
    cost: { input: 0.571, output: 2.286 },
    reasoning: true
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'alibaba-cn',
    contextWindow: 65536,
    maxTokens: 8192,
    cost: { input: 0.286, output: 1.143 }
  },

  // ===== Moonshot Kimi =====
  {
    id: 'moonshot-v1-8k',
    name: 'Moonshot v1 8K',
    provider: 'moonshot',
    contextWindow: 8000,
    maxTokens: 4096,
    cost: { input: 0.12, output: 0.12 }
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Moonshot v1 32K',
    provider: 'moonshot',
    contextWindow: 32000,
    maxTokens: 4096,
    cost: { input: 0.24, output: 0.24 }
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Moonshot v1 128K',
    provider: 'moonshot',
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0.6, output: 0.6 }
  },

  // ===== Zhipu GLM =====
  {
    id: 'glm-4-plus',
    name: 'GLM-4-Plus',
    provider: 'zhipu',
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0.7, output: 0.7 }
  },
  {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'zhipu',
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0.1, output: 0.1 }
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    provider: 'zhipu',
    contextWindow: 128000,
    maxTokens: 16000,
    cost: { input: 0.0, output: 0.0 }
  },
  {
    id: 'glm-3-turbo',
    name: 'GLM-3-Turbo',
    provider: 'zhipu',
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0.005, output: 0.005 }
  },

  // ===== Perplexity =====
  {
    id: 'llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large 128K Online',
    provider: 'perplexity',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 1.0, output: 1.0 }
  },
  {
    id: 'llama-3.1-sonar-small-128k-online',
    name: 'Llama 3.1 Sonar Small 128K Online',
    provider: 'perplexity',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.2, output: 0.2 }
  },

  // ===== Fireworks AI =====
  {
    id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'fireworks',
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0.9, output: 0.9 }
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    provider: 'fireworks',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.9, output: 0.9 }
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'fireworks',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.2, output: 0.2 }
  },

  // ===== Together AI =====
  {
    id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    name: 'Meta Llama 3.1 405B Instruct Turbo',
    provider: 'together',
    contextWindow: 130816,
    maxTokens: 4096,
    cost: { input: 3.5, output: 3.5 }
  },
  {
    id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    name: 'Meta Llama 3.1 70B Instruct Turbo',
    provider: 'together',
    contextWindow: 131072,
    maxTokens: 4096,
    cost: { input: 0.88, output: 0.88 }
  },
  {
    id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    name: 'Meta Llama 3.1 8B Instruct Turbo',
    provider: 'together',
    contextWindow: 131072,
    maxTokens: 4096,
    cost: { input: 0.18, output: 0.18 }
  }
]

// Models grouped by provider id
export const MODELS_BY_PROVIDER = MODELS_DATABASE.reduce((acc, model) => {
  if (!acc[model.provider]) {
    acc[model.provider] = []
  }
  acc[model.provider].push(model)
  return acc
}, {} as Record<string, ModelInfo[]>)

// Lookup model by id
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODELS_DATABASE.find(m => m.id === modelId)
}

// List models for one provider
export function getModelsByProvider(provider: string): ModelInfo[] {
  return MODELS_BY_PROVIDER[provider] || []
}

// Fuzzy search across id, name, provider
export function searchModels(query: string): ModelInfo[] {
  const q = query.toLowerCase()
  return MODELS_DATABASE.filter(
    m =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
  )
}

// Sorted provider ids present in the database
export function getAllProviders(): string[] {
  return Object.keys(MODELS_BY_PROVIDER).sort()
}
