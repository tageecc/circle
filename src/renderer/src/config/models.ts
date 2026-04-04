/**
 * AI model catalog. User-visible copy uses i18n keys; resolve with t() in UI.
 */

export interface ModelInfo {
  id: string
  name: string
  descriptionKey: string
  contextWindow: string
  capabilityKeys?: string[]
}

export interface ProviderConfig {
  nameKey: string
  models: ModelInfo[]
}

export const PROVIDER_MODELS: Record<string, ProviderConfig> = {
  'Alibaba (China)': {
    nameKey: 'models.providers.alibaba_china',
    models: [
      {
        id: 'qwen3.6-plus-2026-04-02',
        name: 'Qwen3.6 Plus (2026-04-02)',
        descriptionKey: 'models.descriptions.qwen_plus',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context'
        ]
      },
      {
        id: 'qwen3.6-plus',
        name: 'Qwen3.6 Plus',
        descriptionKey: 'models.descriptions.qwen_plus',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context'
        ]
      },
      {
        id: 'qwen3-max',
        name: 'Qwen3 Max',
        descriptionKey: 'models.descriptions.qwen_max',
        contextWindow: '256K',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context'
        ]
      },
      {
        id: 'qwen3.5-plus',
        name: 'Qwen3.5 Plus',
        descriptionKey: 'models.descriptions.qwen_plus',
        contextWindow: '1M',
        capabilityKeys: ['models.caps.text_generation', 'models.caps.code', 'models.caps.reasoning']
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        descriptionKey: 'models.descriptions.qwen_plus',
        contextWindow: '1M',
        capabilityKeys: ['models.caps.text_generation', 'models.caps.code', 'models.caps.reasoning']
      },
      {
        id: 'qwen-flash',
        name: 'Qwen Flash',
        descriptionKey: 'models.descriptions.qwen_turbo',
        contextWindow: '1M',
        capabilityKeys: ['models.caps.fast_response', 'models.caps.daily_tasks']
      },
      {
        id: 'qwq-plus',
        name: 'QwQ Plus',
        descriptionKey: 'models.descriptions.qwq_plus',
        contextWindow: '128K',
        capabilityKeys: ['models.caps.chain_of_thought', 'models.caps.complex_reasoning']
      },
      {
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        descriptionKey: 'models.descriptions.deepseek_r1',
        contextWindow: '64K',
        capabilityKeys: ['models.caps.reasoning', 'models.caps.math', 'models.caps.code']
      }
    ]
  },
  OpenAI: {
    nameKey: 'models.providers.openai',
    models: [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        descriptionKey: 'models.descriptions.gpt_4o',
        contextWindow: '1M',
        capabilityKeys: ['models.caps.vision', 'models.caps.code', 'models.caps.reasoning']
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        descriptionKey: 'models.descriptions.gpt_4o',
        contextWindow: '128K',
        capabilityKeys: [
          'models.caps.vision',
          'models.caps.audio',
          'models.caps.code',
          'models.caps.reasoning'
        ]
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        descriptionKey: 'models.descriptions.gpt_4o_mini',
        contextWindow: '128K',
        capabilityKeys: ['models.caps.daily_tasks', 'models.caps.code', 'models.caps.fast_response']
      },
      {
        id: 'o1',
        name: 'O1',
        descriptionKey: 'models.descriptions.o1',
        contextWindow: '200K',
        capabilityKeys: [
          'models.caps.deep_reasoning',
          'models.caps.science',
          'models.caps.math',
          'models.caps.programming'
        ]
      }
    ]
  },
  Anthropic: {
    nameKey: 'models.providers.anthropic',
    models: [
      {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        descriptionKey: 'models.descriptions.claude_3_opus',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context',
          'models.caps.analysis'
        ]
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        descriptionKey: 'models.descriptions.claude_35_sonnet',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context',
          'models.caps.analysis'
        ]
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        descriptionKey: 'models.descriptions.claude_35_haiku',
        contextWindow: '200K',
        capabilityKeys: ['models.caps.fast_response', 'models.caps.daily_tasks']
      }
    ]
  },
  Google: {
    nameKey: 'models.providers.google',
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        descriptionKey: 'models.descriptions.gemini_20_flash',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.ultra_long_context',
          'models.caps.multimodal',
          'models.caps.reasoning'
        ]
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash Preview',
        descriptionKey: 'models.descriptions.gemini_15_flash',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.long_context',
          'models.caps.multimodal',
          'models.caps.fast_response'
        ]
      },
      {
        id: 'gemini-3.1-flash-lite-preview',
        name: 'Gemini 3.1 Flash-Lite Preview',
        descriptionKey: 'models.descriptions.gemini_15_flash',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.long_context',
          'models.caps.multimodal',
          'models.caps.fast_response'
        ]
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        descriptionKey: 'models.descriptions.gemini_15_pro',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.ultra_long_context',
          'models.caps.multimodal',
          'models.caps.reasoning'
        ]
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        descriptionKey: 'models.descriptions.gemini_15_flash',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.long_context',
          'models.caps.multimodal',
          'models.caps.fast_response'
        ]
      }
    ]
  },
  DeepSeek: {
    nameKey: 'models.providers.deepseek',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        descriptionKey: 'models.descriptions.deepseek_chat',
        contextWindow: '128K',
        capabilityKeys: ['models.caps.conversation', 'models.caps.code', 'models.caps.reasoning']
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        descriptionKey: 'models.descriptions.deepseek_reasoner',
        contextWindow: '128K',
        capabilityKeys: ['models.caps.reasoning', 'models.caps.math', 'models.caps.logic']
      }
    ]
  }
}
