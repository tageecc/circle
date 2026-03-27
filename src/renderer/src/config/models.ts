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
        id: 'qwen-plus',
        name: 'Qwen Plus',
        descriptionKey: 'models.descriptions.qwen_plus',
        contextWindow: '1M',
        capabilityKeys: ['models.caps.text_generation', 'models.caps.code', 'models.caps.reasoning']
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        descriptionKey: 'models.descriptions.qwen_max',
        contextWindow: '256K',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context'
        ]
      },
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
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
        contextWindow: '128K',
        capabilityKeys: ['models.caps.reasoning', 'models.caps.math', 'models.caps.code']
      }
    ]
  },
  OpenAI: {
    nameKey: 'models.providers.openai',
    models: [
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
        contextWindow: '128K',
        capabilityKeys: [
          'models.caps.deep_reasoning',
          'models.caps.science',
          'models.caps.math',
          'models.caps.programming'
        ]
      },
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        descriptionKey: 'models.descriptions.o1_mini',
        contextWindow: '128K',
        capabilityKeys: ['models.caps.reasoning', 'models.caps.code', 'models.caps.math']
      }
    ]
  },
  Anthropic: {
    nameKey: 'models.providers.anthropic',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        descriptionKey: 'models.descriptions.claude_35_sonnet',
        contextWindow: '200K',
        capabilityKeys: [
          'models.caps.complex_reasoning',
          'models.caps.code',
          'models.caps.long_context',
          'models.caps.analysis'
        ]
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        descriptionKey: 'models.descriptions.claude_35_haiku',
        contextWindow: '200K',
        capabilityKeys: ['models.caps.fast_response', 'models.caps.daily_tasks']
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        descriptionKey: 'models.descriptions.claude_3_opus',
        contextWindow: '200K',
        capabilityKeys: [
          'models.caps.complex_tasks',
          'models.caps.creative',
          'models.caps.analysis'
        ]
      }
    ]
  },
  Google: {
    nameKey: 'models.providers.google',
    models: [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        descriptionKey: 'models.descriptions.gemini_20_flash',
        contextWindow: '1M',
        capabilityKeys: [
          'models.caps.ultra_long_context',
          'models.caps.multimodal',
          'models.caps.fast_response'
        ]
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        descriptionKey: 'models.descriptions.gemini_15_pro',
        contextWindow: '2M',
        capabilityKeys: [
          'models.caps.ultra_long_context',
          'models.caps.multimodal',
          'models.caps.reasoning'
        ]
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
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
