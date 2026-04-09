/**
 * Embedding Service
 * Generates embeddings for text using configured provider
 */

import { ConfigService } from './config.service'
import {
  EMBEDDING_PROVIDER_CONFIGS,
  type EmbeddingProviderConfig
} from '../../shared/provider-config'

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
    const embeddingConfig = config?.embeddingProvider
    if (!embeddingConfig) return false
    const provider = EMBEDDING_PROVIDER_CONFIGS[embeddingConfig]

    if (!provider) return false

    return this.configService.hasProviderCredential(provider.providerId)
  }

  /**
   * Get current embedding configuration
   */
  getConfig(): { provider: string; model: string; dimensions: number } | null {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider
    if (!embeddingConfig) return null
    const provider = EMBEDDING_PROVIDER_CONFIGS[embeddingConfig]

    if (!provider) return null

    return {
      provider: embeddingConfig,
      model: provider.model,
      dimensions: provider.dimensions
    }
  }

  private getProvider(): EmbeddingProviderConfig {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider
    if (!embeddingConfig) {
      throw new Error('No embedding provider selected in Model Settings')
    }
    const provider = EMBEDDING_PROVIDER_CONFIGS[embeddingConfig]

    if (!provider) {
      throw new Error(`Unknown embedding provider: ${embeddingConfig}`)
    }
    return provider
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    return await this.callProvider(this.getProvider(), text)
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
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

  private async callProvider(
    provider: EmbeddingProviderConfig,
    text: string
  ): Promise<Float32Array> {
    if (provider.providerId === 'openai') {
      return await this.callOpenAI(provider.model, text)
    } else if (provider.providerId === 'voyage') {
      return await this.callVoyageAI(provider.model, text)
    } else if (provider.providerId === 'alibaba-cn') {
      return await this.callQwen(provider.model, text)
    }
    throw new Error(`Unsupported embedding provider: ${provider.providerId}`)
  }

  private async callProviderBatch(
    provider: EmbeddingProviderConfig,
    texts: string[]
  ): Promise<Float32Array[]> {
    if (provider.providerId === 'openai') {
      return await this.callOpenAIBatch(provider.model, texts)
    } else if (provider.providerId === 'voyage') {
      return await this.callVoyageAIBatch(provider.model, texts)
    } else if (provider.providerId === 'alibaba-cn') {
      return await this.callQwenBatch(provider.model, texts)
    }
    throw new Error(`Unsupported embedding provider: ${provider.providerId}`)
  }

  private async callOpenAI(model: string, text: string): Promise<Float32Array> {
    const apiKey = this.configService.getProviderApiKey('openai')

    if (!apiKey) {
      throw new Error('OpenAI credentials not configured in Model Settings')
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
    const apiKey = this.configService.getProviderApiKey('openai')

    if (!apiKey) {
      throw new Error('OpenAI credentials not configured in Model Settings')
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
    const apiKey = this.configService.getProviderApiKey('voyage')

    if (!apiKey) {
      throw new Error('Voyage AI credentials not configured in Model Settings')
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
    const apiKey = this.configService.getProviderApiKey('voyage')

    if (!apiKey) {
      throw new Error('Voyage AI credentials not configured in Model Settings')
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
    const apiKey = this.configService.getProviderApiKey('alibaba-cn')

    if (!apiKey) {
      throw new Error('Alibaba Bailian credentials not configured in Model Settings')
    }

    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: { texts: [text] }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Alibaba DashScope API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return new Float32Array(data.output.embeddings[0].embedding)
  }

  private async callQwenBatch(model: string, texts: string[]): Promise<Float32Array[]> {
    const apiKey = this.configService.getProviderApiKey('alibaba-cn')

    if (!apiKey) {
      throw new Error('Alibaba Bailian credentials not configured in Model Settings')
    }

    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: { texts }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Alibaba DashScope API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    return data.output.embeddings.map((item: any) => new Float32Array(item.embedding))
  }
}
