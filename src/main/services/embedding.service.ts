/**
 * Embedding Service
 * Generates embeddings for text using configured provider
 */

import { ConfigService } from './config.service'

export interface EmbeddingProvider {
  name: string
  model: string
  dimensions: number
}

export const EMBEDDING_PROVIDERS: Record<string, EmbeddingProvider> = {
  'openai-small': {
    name: 'OpenAI',
    model: 'text-embedding-3-small',
    dimensions: 1536
  },
  'openai-large': {
    name: 'OpenAI',
    model: 'text-embedding-3-large',
    dimensions: 3072
  },
  'voyage-code': {
    name: 'Voyage AI',
    model: 'voyage-code-2',
    dimensions: 1536
  },
  'qwen-embed': {
    name: 'Alibaba (China)',
    model: 'text-embedding-v3',
    dimensions: 1024
  }
}

export class EmbeddingService {
  private static instance: EmbeddingService
  private configService: ConfigService

  private constructor() {
    this.configService = new ConfigService()
  }

  static getInstance(): EmbeddingService {
    if (!this.instance) {
      this.instance = new EmbeddingService()
    }
    return this.instance
  }

  /**
   * Check if embedding is properly configured
   */
  isEnabled(): boolean {
    const config = this.configService.getServiceSettings()
    return config?.vectorSearchEnabled === true
  }

  isConfigured(): boolean {
    if (!this.isEnabled()) return false

    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider || 'openai-small'
    const provider = EMBEDDING_PROVIDERS[embeddingConfig]

    if (!provider) return false

    const apiKeys = this.configService.getApiKeys()
    if (provider.name === 'OpenAI') {
      return !!apiKeys?.openai
    } else if (provider.name === 'Voyage AI') {
      return !!apiKeys?.['voyage']
    } else if (provider.name === 'Alibaba (China)') {
      return !!apiKeys?.dashscope
    }
    return false
  }

  /**
   * Get current embedding configuration
   */
  getConfig(): { provider: string; model: string; dimensions: number } | null {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider || 'openai-small'
    const provider = EMBEDDING_PROVIDERS[embeddingConfig]

    if (!provider) return null

    return {
      provider: embeddingConfig,
      model: provider.model,
      dimensions: provider.dimensions
    }
  }

  private getProvider(): EmbeddingProvider {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider || 'openai-small'
    const provider = EMBEDDING_PROVIDERS[embeddingConfig]

    if (!provider) {
      throw new Error(`Unknown embedding provider: ${embeddingConfig}`)
    }
    return provider
  }

  async generateEmbedding(text: string): Promise<Float32Array | null> {
    try {
      return await this.callProvider(this.getProvider(), text)
    } catch (error) {
      console.error('[Embedding] Failed:', error)
      return null
    }
  }

  async generateEmbeddings(texts: string[]): Promise<(Float32Array | null)[]> {
    const provider = this.getProvider()
    const BATCH_SIZE = 50
    const results: Float32Array[] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const batchResults = await this.callProviderBatch(provider, batch)
      results.push(...batchResults)
    }

    return results
  }

  private async callProvider(provider: EmbeddingProvider, text: string): Promise<Float32Array> {
    if (provider.name === 'OpenAI') {
      return await this.callOpenAI(provider.model, text)
    } else if (provider.name === 'Voyage AI') {
      return await this.callVoyageAI(provider.model, text)
    } else if (provider.name === 'Alibaba (China)') {
      return await this.callQwen(provider.model, text)
    }
    throw new Error(`Unsupported provider: ${provider.name}`)
  }

  private async callProviderBatch(
    provider: EmbeddingProvider,
    texts: string[]
  ): Promise<Float32Array[]> {
    if (provider.name === 'OpenAI') {
      return await this.callOpenAIBatch(provider.model, texts)
    } else if (provider.name === 'Voyage AI') {
      return await this.callVoyageAIBatch(provider.model, texts)
    } else if (provider.name === 'Alibaba (China)') {
      return await this.callQwenBatch(provider.model, texts)
    }
    throw new Error(`Unsupported provider: ${provider.name}`)
  }

  private async callOpenAI(model: string, text: string): Promise<Float32Array> {
    const apiKeys = this.configService.getApiKeys()
    const apiKey = apiKeys?.openai

    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: text,
        encoding_format: 'float'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return new Float32Array(data.data[0].embedding)
  }

  private async callOpenAIBatch(model: string, texts: string[]): Promise<Float32Array[]> {
    const apiKeys = this.configService.getApiKeys()
    const apiKey = apiKeys?.openai

    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: texts,
        encoding_format: 'float'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return data.data.map((item: any) => new Float32Array(item.embedding))
  }

  private async callVoyageAI(model: string, text: string): Promise<Float32Array> {
    const apiKeys = this.configService.getApiKeys()
    const apiKey = apiKeys?.['voyage']

    if (!apiKey) {
      throw new Error('Voyage AI API key not configured')
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: text
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Voyage AI API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return new Float32Array(data.data[0].embedding)
  }

  private async callVoyageAIBatch(model: string, texts: string[]): Promise<Float32Array[]> {
    const apiKeys = this.configService.getApiKeys()
    const apiKey = apiKeys?.['voyage']

    if (!apiKey) {
      throw new Error('Voyage AI API key not configured')
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: texts
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Voyage AI API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return data.data.map((item: any) => new Float32Array(item.embedding))
  }

  private async callQwen(model: string, text: string): Promise<Float32Array> {
    const apiKeys = this.configService.getApiKeys()
    const apiKey = apiKeys?.dashscope

    if (!apiKey) {
      throw new Error('Alibaba DashScope API key not configured')
    }

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: { texts: [text] }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Alibaba DashScope API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return new Float32Array(data.output.embeddings[0].embedding)
  }

  private async callQwenBatch(model: string, texts: string[]): Promise<Float32Array[]> {
    const apiKeys = this.configService.getApiKeys()
    const apiKey = apiKeys?.dashscope

    if (!apiKey) {
      throw new Error('Alibaba DashScope API key not configured')
    }

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: { texts }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Alibaba DashScope API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return data.output.embeddings.map((item: any) => new Float32Array(item.embedding))
  }
}
