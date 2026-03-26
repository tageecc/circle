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
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<Float32Array | null> {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider || 'openai-small'
    const provider = EMBEDDING_PROVIDERS[embeddingConfig]

    if (!provider) {
      console.warn(`[Embedding] Unknown provider: ${embeddingConfig}`)
      return null
    }

    try {
      return await this.callProvider(provider, text)
    } catch (error) {
      console.error('[Embedding] Failed to generate embedding:', error)
      return null
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<(Float32Array | null)[]> {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider || 'openai-small'
    const provider = EMBEDDING_PROVIDERS[embeddingConfig]

    if (!provider) {
      console.warn(`[Embedding] Unknown provider: ${embeddingConfig}`)
      return texts.map(() => null)
    }

    try {
      return await this.callProviderBatch(provider, texts)
    } catch (error) {
      console.error('[Embedding] Failed to generate embeddings batch:', error)
      return texts.map(() => null)
    }
  }

  private async callProvider(provider: EmbeddingProvider, text: string): Promise<Float32Array> {
    if (provider.name === 'OpenAI') {
      return await this.callOpenAI(provider.model, text)
    } else if (provider.name === 'Voyage AI') {
      return await this.callVoyageAI(provider.model, text)
    }
    throw new Error(`Unsupported provider: ${provider.name}`)
  }

  private async callProviderBatch(
    provider: EmbeddingProvider,
    texts: string[]
  ): Promise<(Float32Array | null)[]> {
    if (provider.name === 'OpenAI') {
      return await this.callOpenAIBatch(provider.model, texts)
    } else if (provider.name === 'Voyage AI') {
      return await this.callVoyageAIBatch(provider.model, texts)
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

  private async callOpenAIBatch(
    model: string,
    texts: string[]
  ): Promise<(Float32Array | null)[]> {
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

  private async callVoyageAIBatch(
    model: string,
    texts: string[]
  ): Promise<(Float32Array | null)[]> {
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

  /**
   * Get configured embedding dimensions
   */
  getDimensions(): number {
    const config = this.configService.getServiceSettings()
    const embeddingConfig = config?.embeddingProvider || 'openai-small'
    const provider = EMBEDDING_PROVIDERS[embeddingConfig]
    return provider?.dimensions || 1536
  }
}
