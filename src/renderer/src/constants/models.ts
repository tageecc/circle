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
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    contextWindow: 1000000,
    maxTokens: 128000,
    cost: { input: 2.5, output: 15.0 },
    input: ['text', 'image']
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    contextWindow: 400000,
    maxTokens: 128000,
    cost: { input: 0.75, output: 4.5 },
    input: ['text', 'image']
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'openai',
    contextWindow: 400000,
    maxTokens: 128000,
    cost: { input: 0.2, output: 1.25 },
    input: ['text', 'image']
  },
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
    cost: { input: 10.0, output: 30.0 },
    deprecated: true
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    contextWindow: 8192,
    maxTokens: 4096,
    cost: { input: 30.0, output: 60.0 },
    deprecated: true
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextWindow: 16385,
    maxTokens: 4096,
    cost: { input: 0.5, output: 1.5 },
    deprecated: true
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    contextWindow: 200000,
    maxTokens: 100000,
    cost: { input: 15.0, output: 60.0 },
    reasoning: true
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 65536,
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
    reasoning: true,
    deprecated: true
  },

  // ===== Anthropic =====
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 1000000,
    maxTokens: 128000,
    cost: { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
    input: ['text', 'image'],
    reasoning: true
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 1000000,
    maxTokens: 64000,
    cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
    input: ['text', 'image'],
    reasoning: true
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 64000,
    cost: { input: 1.0, output: 5.0 },
    input: ['text', 'image'],
    reasoning: true
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
    input: ['text', 'image'],
    deprecated: true
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 1.0, output: 5.0 },
    input: ['text', 'image'],
    deprecated: true
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    cost: { input: 15.0, output: 75.0 },
    input: ['text', 'image'],
    deprecated: true
  },

  // ===== Google Gemini =====
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'google',
    contextWindow: 1048576,
    maxTokens: 65536,
    cost: { input: 2.0, output: 12.0 },
    input: ['text', 'image', 'audio', 'video'],
    reasoning: true
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'google',
    contextWindow: 1048576,
    maxTokens: 65536,
    cost: { input: 0.5, output: 3.0 },
    input: ['text', 'image', 'audio', 'video'],
    reasoning: true
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash-Lite Preview',
    provider: 'google',
    contextWindow: 1048576,
    maxTokens: 65536,
    cost: { input: 0.25, output: 1.5 },
    input: ['text', 'image', 'audio', 'video'],
    reasoning: true
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    contextWindow: 1048576,
    maxTokens: 65536,
    cost: { input: 1.25, output: 10.0 },
    input: ['text', 'image', 'audio', 'video'],
    reasoning: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1048576,
    maxTokens: 65536,
    cost: { input: 0.3, output: 2.5 },
    input: ['text', 'image', 'audio', 'video'],
    reasoning: true
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'google',
    contextWindow: 1048576,
    maxTokens: 65536,
    cost: { input: 0.1, output: 0.4 },
    input: ['text', 'image', 'audio', 'video'],
    reasoning: true
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2000000,
    maxTokens: 8192,
    cost: { input: 1.25, output: 5.0 },
    input: ['text', 'image', 'audio', 'video'],
    deprecated: true
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.075, output: 0.3 },
    input: ['text', 'image', 'audio', 'video'],
    deprecated: true
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'google',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.0, output: 0.0 },
    input: ['text', 'image', 'audio', 'video'],
    deprecated: true
  },

  // ===== DeepSeek =====
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat (V3.2)',
    provider: 'deepseek',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.28, output: 0.42, cacheRead: 0.028 }
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner (V3.2)',
    provider: 'deepseek',
    contextWindow: 128000,
    maxTokens: 64000,
    cost: { input: 0.28, output: 0.42, cacheRead: 0.028 },
    reasoning: true
  },

  // ===== xAI =====
  {
    id: 'grok-4.20-0309-reasoning',
    name: 'Grok 4.20 (Reasoning)',
    provider: 'xai',
    contextWindow: 2000000,
    maxTokens: 131072,
    cost: { input: 2.0, output: 6.0, cacheRead: 0.2 },
    input: ['text', 'image'],
    reasoning: true
  },
  {
    id: 'grok-4.20-0309-non-reasoning',
    name: 'Grok 4.20',
    provider: 'xai',
    contextWindow: 2000000,
    maxTokens: 131072,
    cost: { input: 2.0, output: 6.0, cacheRead: 0.2 },
    input: ['text', 'image']
  },
  {
    id: 'grok-4.20-multi-agent-0309',
    name: 'Grok 4.20 Multi-Agent',
    provider: 'xai',
    contextWindow: 2000000,
    maxTokens: 131072,
    cost: { input: 2.0, output: 6.0, cacheRead: 0.2 },
    input: ['text', 'image'],
    reasoning: true
  },
  {
    id: 'grok-4-1-fast-reasoning',
    name: 'Grok 4.1 Fast (Reasoning)',
    provider: 'xai',
    contextWindow: 2000000,
    maxTokens: 131072,
    cost: { input: 0.2, output: 0.5, cacheRead: 0.05 },
    input: ['text', 'image'],
    reasoning: true
  },
  {
    id: 'grok-4-1-fast-non-reasoning',
    name: 'Grok 4.1 Fast',
    provider: 'xai',
    contextWindow: 2000000,
    maxTokens: 131072,
    cost: { input: 0.2, output: 0.5, cacheRead: 0.05 },
    input: ['text', 'image']
  },

  // ===== Mistral =====
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large (latest)',
    provider: 'mistral',
    contextWindow: 256000,
    maxTokens: 8192,
    cost: { input: 0.5, output: 1.5 },
    input: ['text', 'image']
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium (latest)',
    provider: 'mistral',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.7, output: 2.1 },
    input: ['text', 'image']
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small (latest)',
    provider: 'mistral',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.2, output: 0.6 },
    input: ['text', 'image']
  },
  {
    id: 'codestral-2508',
    name: 'Codestral 25.08',
    provider: 'mistral',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.3, output: 0.9 },
    input: ['text', 'image']
  },
  {
    id: 'devstral-2512',
    name: 'Devstral 2',
    provider: 'mistral',
    contextWindow: 256000,
    maxTokens: 8192,
    cost: { input: 0.4, output: 2.0 },
    input: ['text', 'image']
  },
  // ===== Groq =====
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 32768,
    cost: { input: 0.59, output: 0.79 }
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 131072,
    cost: { input: 0.05, output: 0.08 }
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 65536,
    cost: { input: 0.15, output: 0.6 },
    reasoning: true
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 65536,
    cost: { input: 0.075, output: 0.3 },
    reasoning: true
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 40960,
    cost: { input: 0.29, output: 0.59 },
    reasoning: true
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.11, output: 0.34 },
    input: ['text', 'image']
  },
  {
    id: 'groq/compound',
    name: 'Groq Compound',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.15, output: 0.6 },
    reasoning: true
  },
  {
    id: 'groq/compound-mini',
    name: 'Groq Compound Mini',
    provider: 'groq',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.15, output: 0.6 },
    reasoning: true
  },

  // ===== Alibaba DashScope (international) =====
  {
    id: 'qwen3-max',
    name: 'Qwen3 Max',
    provider: 'alibaba',
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0.343, output: 1.371, cacheRead: 0.034 },
    reasoning: true
  },
  {
    id: 'qwen3.6-plus',
    name: 'Qwen3.6 Plus',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 65536,
    cost: { input: 0.28, output: 0.72, cacheRead: 0.028 },
    input: ['text', 'image', 'video'],
    reasoning: true
  },
  {
    id: 'qwen3.6-plus-2026-04-02',
    name: 'Qwen3.6 Plus (2026-04-02)',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 65536,
    cost: { input: 0.28, output: 0.72, cacheRead: 0.028 },
    input: ['text', 'image', 'video'],
    reasoning: true
  },
  {
    id: 'qwen3.5-plus',
    name: 'Qwen3.5 Plus',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.22, output: 0.55, cacheRead: 0.022 }
  },
  {
    id: 'qwen3.5-flash',
    name: 'Qwen3.5 Flash',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.05, output: 0.1, cacheRead: 0.005 }
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.143, output: 0.429, cacheRead: 0.014 }
  },
  {
    id: 'qwen-flash',
    name: 'Qwen Flash',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.043, output: 0.086, cacheRead: 0.004 }
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.029, output: 0.086 }
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'alibaba',
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0.4, output: 1.2 }
  },
  {
    id: 'qwq-plus',
    name: 'QwQ Plus',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.514, output: 1.543 },
    reasoning: true
  },
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.15, output: 0.45 }
  },
  {
    id: 'qwen3-coder-flash',
    name: 'Qwen3 Coder Flash',
    provider: 'alibaba',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.05, output: 0.15 }
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
    id: 'qwen-vl-max',
    name: 'Qwen VL Max',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.057, output: 0.143 },
    input: ['text', 'image']
  },
  {
    id: 'qwen-vl-plus',
    name: 'Qwen VL Plus',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.029, output: 0.057 },
    input: ['text', 'image']
  },

  // ===== Alibaba Model Studio (China) =====
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
    id: 'qwen3.6-plus',
    name: 'Qwen3.6 Plus',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 65536,
    cost: { input: 0.28, output: 0.72, cacheRead: 0.028 },
    input: ['text', 'image', 'video'],
    reasoning: true
  },
  {
    id: 'qwen3.6-plus-2026-04-02',
    name: 'Qwen3.6 Plus (2026-04-02)',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 65536,
    cost: { input: 0.28, output: 0.72, cacheRead: 0.028 },
    input: ['text', 'image', 'video'],
    reasoning: true
  },
  {
    id: 'qwen3.5-plus',
    name: 'Qwen3.5 Plus',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.22, output: 0.55, cacheRead: 0.022 }
  },
  {
    id: 'qwen3.5-flash',
    name: 'Qwen3.5 Flash',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.05, output: 0.1, cacheRead: 0.005 }
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
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'alibaba-cn',
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0.4, output: 1.2 }
  },
  {
    id: 'qwen-coder-plus',
    name: 'Qwen Coder Plus',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.15, output: 0.45 }
  },
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.15, output: 0.45 }
  },
  {
    id: 'qwen3-coder-flash',
    name: 'Qwen3 Coder Flash',
    provider: 'alibaba-cn',
    contextWindow: 1000000,
    maxTokens: 8192,
    cost: { input: 0.05, output: 0.15 }
  },
  {
    id: 'qwen2.5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.057, output: 0.171 }
  },
  {
    id: 'qwen2.5-32b-instruct',
    name: 'Qwen2.5 32B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.029, output: 0.086 }
  },
  {
    id: 'qwen2.5-14b-instruct',
    name: 'Qwen2.5 14B Instruct',
    provider: 'alibaba-cn',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.014, output: 0.043 }
  },
  {
    id: 'qwen2.5-7b-instruct',
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
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.286, output: 0.857 },
    reasoning: true
  },
  {
    id: 'qwq-plus',
    name: 'QwQ Plus',
    provider: 'alibaba-cn',
    contextWindow: 131072,
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

  // ===== Moonshot =====
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'moonshot',
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0.5, output: 2.8 },
    input: ['text', 'image', 'video'],
    reasoning: true
  },
  {
    id: 'kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    provider: 'moonshot',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.4, output: 2.0 },
    reasoning: true
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Moonshot v1 128K',
    provider: 'moonshot',
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0.6, output: 0.6 }
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
    id: 'moonshot-v1-8k',
    name: 'Moonshot v1 8K',
    provider: 'moonshot',
    contextWindow: 8000,
    maxTokens: 4096,
    cost: { input: 0.12, output: 0.12 }
  },

  // ===== Zhipu =====
  {
    id: 'glm-5',
    name: 'GLM-5',
    provider: 'zhipu',
    contextWindow: 200000,
    maxTokens: 128000,
    cost: { input: 1.0, output: 3.2 },
    reasoning: true
  },
  {
    id: 'glm-5-turbo',
    name: 'GLM-5 Turbo',
    provider: 'zhipu',
    contextWindow: 200000,
    maxTokens: 128000,
    cost: { input: 0.5, output: 1.6 },
    reasoning: true
  },
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    provider: 'zhipu',
    contextWindow: 200000,
    maxTokens: 128000,
    cost: { input: 0.6, output: 1.8 },
    reasoning: true
  },
  {
    id: 'glm-4.6',
    name: 'GLM-4.6',
    provider: 'zhipu',
    contextWindow: 200000,
    maxTokens: 128000,
    cost: { input: 0.5, output: 1.5 },
    reasoning: true
  },
  {
    id: 'glm-4.5-air',
    name: 'GLM-4.5 Air',
    provider: 'zhipu',
    contextWindow: 128000,
    maxTokens: 96000,
    cost: { input: 0.1, output: 0.1 }
  },
  {
    id: 'glm-4-long',
    name: 'GLM-4 Long',
    provider: 'zhipu',
    contextWindow: 1000000,
    maxTokens: 4096,
    cost: { input: 0.05, output: 0.05 }
  },

  // ===== Perplexity =====
  {
    id: 'sonar-pro',
    name: 'Sonar Pro',
    provider: 'perplexity',
    contextWindow: 200000,
    maxTokens: 8192,
    cost: { input: 3.0, output: 15.0 }
  },
  {
    id: 'sonar',
    name: 'Sonar',
    provider: 'perplexity',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 1.0, output: 1.0 }
  },
  {
    id: 'sonar-reasoning-pro',
    name: 'Sonar Reasoning Pro',
    provider: 'perplexity',
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 2.0, output: 8.0 },
    reasoning: true
  },

  // ===== Fireworks AI =====
  {
    id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'fireworks',
    contextWindow: 131072,
    maxTokens: 16384,
    cost: { input: 0.9, output: 0.9 }
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    provider: 'fireworks',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.9, output: 0.9 }
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'fireworks',
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.2, output: 0.2 }
  },

  // ===== Together AI =====
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'together',
    contextWindow: 128000,
    maxTokens: 65536,
    cost: { input: 0.15, output: 0.6 },
    reasoning: true
  },
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    name: 'Llama 3.3 70B Instruct Turbo',
    provider: 'together',
    contextWindow: 131072,
    maxTokens: 4096,
    cost: { input: 0.88, output: 0.88 }
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'together',
    contextWindow: 128000,
    maxTokens: 65536,
    cost: { input: 0.05, output: 0.2 },
    reasoning: true
  }
]

export function getModelInfo(modelId: string, providerId?: string): ModelInfo | undefined {
  if (providerId) {
    const scoped = MODELS_DATABASE.find((m) => m.id === modelId && m.provider === providerId)
    if (scoped) return scoped
  }
  return MODELS_DATABASE.find((m) => m.id === modelId)
}

export function getModelsByProvider(provider: string): ModelInfo[] {
  return MODELS_DATABASE.filter((m) => m.provider === provider)
}
