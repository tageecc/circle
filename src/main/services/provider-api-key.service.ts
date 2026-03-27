import { eq } from 'drizzle-orm'
import { CircleDatabase } from '../database/db'
import { providerApiKeys, ProviderApiKey } from '../database/schema'

export class ProviderApiKeyService {
  constructor(private db: CircleDatabase) {}

  async getApiKey(providerId: string): Promise<ProviderApiKey | undefined> {
    const db = this.db.getDb()
    return db.select().from(providerApiKeys).where(eq(providerApiKeys.providerId, providerId)).get()
  }

  async getAllApiKeys(): Promise<ProviderApiKey[]> {
    const db = this.db.getDb()
    return db.select().from(providerApiKeys).all()
  }

  async setApiKey(input: {
    providerId: string
    apiKey: string
    baseURL?: string
  }): Promise<ProviderApiKey> {
    const db = this.db.getDb()
    const now = new Date()

    const existing = await this.getApiKey(input.providerId)

    const apiKeyData: ProviderApiKey = {
      providerId: input.providerId,
      apiKey: input.apiKey,
      baseURL: input.baseURL || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    db.insert(providerApiKeys)
      .values(apiKeyData)
      .onConflictDoUpdate({
        target: providerApiKeys.providerId,
        set: {
          apiKey: input.apiKey,
          baseURL: input.baseURL || null,
          updatedAt: now
        }
      })
      .run()

    return apiKeyData
  }

  async deleteApiKey(providerId: string): Promise<void> {
    const db = this.db.getDb()
    db.delete(providerApiKeys).where(eq(providerApiKeys.providerId, providerId)).run()
  }
}
