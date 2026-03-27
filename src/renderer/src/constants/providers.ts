// Model providers with base URLs and configuration links
export const PROVIDERS: {
  id: string
  name: string
  baseURL?: string
  keyUrl?: string
  modelHint?: string
}[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    baseURL: 'https://api.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    modelHint: 'claude-3-5-sonnet-20241022'
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    baseURL: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    modelHint: 'gpt-4o'
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    keyUrl: 'https://aistudio.google.com/apikey',
    modelHint: 'gemini-2.0-flash-exp'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    modelHint: 'deepseek-chat'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys'
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    baseURL: 'https://api.x.ai/v1',
    keyUrl: 'https://console.x.ai/',
    modelHint: 'grok-beta'
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseURL: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    modelHint: 'mistral-large-latest'
  },
  {
    id: 'groq',
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    modelHint: 'llama-3.3-70b-versatile'
  },
  {
    id: 'together',
    name: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    keyUrl: 'https://api.together.ai/settings/api-keys'
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    keyUrl: 'https://cloud.cerebras.ai/account/api-keys'
  },
  {
    id: 'alibaba',
    name: 'Alibaba DashScope',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyUrl: 'https://dashscope.console.aliyun.com/',
    modelHint: 'qwen-max'
  },
  {
    id: 'alibaba-cn',
    name: 'Alibaba Bailian (国内)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyUrl: 'https://bailian.console.aliyun.com/',
    modelHint: 'qwen3-max'
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    baseURL: 'https://api.moonshot.ai/v1',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    modelHint: 'moonshot-v1-128k'
  },
  {
    id: 'zhipu',
    name: 'Zhipu (GLM)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    modelHint: 'glm-4-plus'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseURL: 'https://api.perplexity.ai',
    keyUrl: 'https://www.perplexity.ai/settings/api',
    modelHint: 'llama-3.1-sonar-large-128k-online'
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    keyUrl: 'https://fireworks.ai/account/api-keys'
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseURL: 'http://127.0.0.1:11434/v1',
    modelHint: 'llama3.2'
  },
  {
    id: 'lmstudio',
    name: 'LMStudio (local)',
    baseURL: 'http://127.0.0.1:1234/v1'
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)'
  }
]

export function getProvider(providerId: string) {
  return PROVIDERS.find((p) => p.id === providerId)
}
