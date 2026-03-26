/**
 * AI 模型配置
 */

export interface ModelInfo {
  id: string
  name: string
  description: string
  contextWindow: string
  capabilities?: string[]
}

export interface ProviderConfig {
  name: string
  models: ModelInfo[]
}

export const PROVIDER_MODELS: Record<string, ProviderConfig> = {
  'Alibaba (China)': {
    name: '阿里云百炼',
    models: [
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        description: '平衡性能与成本的通用模型',
        contextWindow: '1M',
        capabilities: ['文本生成', '代码', '推理']
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        description: '最强大的通义千问模型',
        contextWindow: '256K',
        capabilities: ['复杂推理', '代码', '长文本']
      },
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        description: '快速响应的轻量级模型',
        contextWindow: '1M',
        capabilities: ['快速响应', '日常任务']
      },
      {
        id: 'qwq-plus',
        name: 'QwQ Plus',
        description: '思维链推理模型',
        contextWindow: '128K',
        capabilities: ['思维链', '复杂推理']
      },
      {
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        description: '强大的推理模型',
        contextWindow: '128K',
        capabilities: ['推理', '数学', '代码']
      }
    ]
  },
  OpenAI: {
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: '最新的多模态旗舰模型',
        contextWindow: '128K',
        capabilities: ['视觉', '音频', '代码', '推理']
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: '快速且经济的智能模型',
        contextWindow: '128K',
        capabilities: ['日常任务', '代码', '快速响应']
      },
      {
        id: 'o1',
        name: 'O1',
        description: '深度推理模型，擅长复杂问题',
        contextWindow: '128K',
        capabilities: ['深度推理', '科学', '数学', '编程']
      },
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        description: '快速的推理模型',
        contextWindow: '128K',
        capabilities: ['推理', '代码', '数学']
      }
    ]
  },
  Anthropic: {
    name: 'Anthropic',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic 最智能的模型',
        contextWindow: '200K',
        capabilities: ['复杂推理', '代码', '长文本', '分析']
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: '快速响应的高效模型',
        contextWindow: '200K',
        capabilities: ['快速响应', '日常任务']
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: '旗舰级模型，最强性能',
        contextWindow: '200K',
        capabilities: ['复杂任务', '创作', '分析']
      }
    ]
  },
  Google: {
    name: 'Google',
    models: [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        description: '实验性的快速模型',
        contextWindow: '1M',
        capabilities: ['超长上下文', '多模态', '快速']
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '强大的多模态模型',
        contextWindow: '2M',
        capabilities: ['超长上下文', '多模态', '推理']
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: '快速的多模态模型',
        contextWindow: '1M',
        capabilities: ['长上下文', '多模态', '快速']
      }
    ]
  },
  DeepSeek: {
    name: 'DeepSeek',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        description: '通用对话模型',
        contextWindow: '128K',
        capabilities: ['对话', '代码', '推理']
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        description: '专注推理的模型',
        contextWindow: '128K',
        capabilities: ['推理', '数学', '逻辑']
      }
    ]
  }
}
