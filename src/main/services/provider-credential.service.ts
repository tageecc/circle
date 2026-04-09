import { eq } from 'drizzle-orm'
import { CircleDatabase } from '../database/db'
import { providerApiKeys, ProviderApiKey } from '../database/schema'
import {
  getProviderRuntimeConfig,
  normalizeProviderId,
  providerRequiresApiKey
} from '../../shared/provider-config'

export class ProviderCredentialService {
  constructor(private db: CircleDatabase) {}

  listCredentials(): ProviderApiKey[] {
    const db = this.db.getDb()
    return db.select().from(providerApiKeys).all()
  }

  getStoredCredential(providerId: string): ProviderApiKey | undefined {
    const db = this.db.getDb()
    const normalizedProviderId = normalizeProviderId(providerId)
    return db
      .select()
      .from(providerApiKeys)
      .where(eq(providerApiKeys.providerId, normalizedProviderId))
      .get()
  }

  setCredential(input: { providerId: string; apiKey: string; baseURL?: string }): ProviderApiKey {
    const db = this.db.getDb()
    const now = new Date()
    const providerId = normalizeProviderId(input.providerId)

    const credential: ProviderApiKey = {
      providerId,
      apiKey: input.apiKey,
      baseURL: input.baseURL || null,
      createdAt: now,
      updatedAt: now
    }

    db.insert(providerApiKeys)
      .values(credential)
      .onConflictDoUpdate({
        target: providerApiKeys.providerId,
        set: {
          apiKey: input.apiKey,
          baseURL: input.baseURL || null,
          updatedAt: now
        }
      })
      .run()

    return credential
  }

  deleteCredential(providerId: string): void {
    const db = this.db.getDb()
    db.delete(providerApiKeys)
      .where(eq(providerApiKeys.providerId, normalizeProviderId(providerId)))
      .run()
  }

  getApiKey(providerId: string): string | undefined {
    return this.getStoredCredential(providerId)?.apiKey
  }

  getBaseURL(providerId: string): string | undefined {
    const credential = this.getStoredCredential(providerId)
    if (credential?.baseURL) {
      return credential.baseURL
    }

    const runtimeConfig = getProviderRuntimeConfig(providerId)
    return runtimeConfig?.defaultBaseURL
  }

  isConfigured(providerId: string): boolean {
    const credential = this.getStoredCredential(providerId)
    if (!credential) {
      return false
    }

    if (providerRequiresApiKey(providerId)) {
      return Boolean(credential.apiKey?.trim())
    }

    const runtimeConfig = getProviderRuntimeConfig(providerId)
    if (runtimeConfig?.supportsBaseURL) {
      return Boolean(credential.baseURL?.trim() || runtimeConfig.defaultBaseURL)
    }

    return true
  }
}
