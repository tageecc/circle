import { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { ConfigService } from '../services/config.service'
import { createQwen } from 'qwen-ai-provider-v5'
/**
 * Language Model 工厂函数
 * 根据 modelId 创建对应的 Language Model
 *
 * modelId 格式: "provider/model" (如 "Alibaba (China)/qwen-plus")
 *
 * 避免在多个 Service 中重复实现相同的逻辑
 */
export function createLanguageModel(modelId: string, configService: ConfigService): LanguageModel {
  const [provider, model] = modelId.split('/')

  if (!provider || !model) {
    throw new Error(`无效的 modelId 格式: ${modelId}，期望格式为 "provider/model"`)
  }

  switch (provider) {
    case 'Alibaba (China)': {
      const apiKey = configService.getApiKey('dashscope') || process.env.DASHSCOPE_API_KEY
      if (!apiKey) throw new Error('DashScope API Key 未配置，请在设置中配置')
      return createQwen({
        apiKey,
        baseURL: process.env.DASHSCOPE_BASE_URL,
      })(model)
    }

    case 'OpenAI': {
      const apiKey = configService.getApiKey('openai') || process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OpenAI API Key 未配置，请在设置中配置')
      return createOpenAI({ apiKey })(model)
    }

    case 'Anthropic': {
      const apiKey = configService.getApiKey('anthropic') || process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('Anthropic API Key 未配置，请在设置中配置')
      return createAnthropic({ apiKey })(model)
    }

    case 'Google': {
      const apiKey = configService.getApiKey('google') || process.env.GOOGLE_API_KEY
      if (!apiKey) throw new Error('Google API Key 未配置，请在设置中配置')
      return createGoogleGenerativeAI({ apiKey })(model)
    }

    case 'DeepSeek': {
      const apiKey = configService.getApiKey('deepseek') || process.env.DEEPSEEK_API_KEY
      if (!apiKey) throw new Error('DeepSeek API Key 未配置，请在设置中配置')
      return createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' })(model)
    }

    default:
      throw new Error(`不支持的模型提供商: ${provider}`)
  }
}
