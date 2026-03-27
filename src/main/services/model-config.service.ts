import { eq } from 'drizzle-orm'
import { CircleDatabase } from '../database/db'
import { modelConfigs, ModelConfig } from '../database/schema'
import { nanoid } from 'nanoid'

export class ModelConfigService {
  constructor(private db: CircleDatabase) {}

  // Get all configured models
  async getAllModels(): Promise<ModelConfig[]> {
    const db = this.db.getDb()
    return db.select().from(modelConfigs).all()
  }

  // Get models by provider
  async getModelsByProvider(providerId: string): Promise<ModelConfig[]> {
    const db = this.db.getDb()
    return db.select().from(modelConfigs).where(eq(modelConfigs.providerId, providerId)).all()
  }

  // Get default model
  async getDefaultModel(): Promise<ModelConfig | undefined> {
    const db = this.db.getDb()
    const result = db.select().from(modelConfigs).where(eq(modelConfigs.isDefault, true)).get()
    return result || undefined
  }

  // Add a new model configuration
  async addModel(input: {
    providerId: string
    modelId: string
    displayName?: string
    isDefault?: boolean
  }): Promise<ModelConfig> {
    const db = this.db.getDb()
    const now = new Date()
    
    // If this model should be default, unset other defaults first
    if (input.isDefault) {
      await this.clearAllDefaults()
    }

    const modelConfig: ModelConfig = {
      id: nanoid(),
      providerId: input.providerId,
      modelId: input.modelId,
      displayName: input.displayName || null,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now
    }

    db.insert(modelConfigs).values(modelConfig).run()
    return modelConfig
  }

  // Update model configuration
  async updateModel(
    id: string,
    updates: {
      displayName?: string
      isDefault?: boolean
    }
  ): Promise<void> {
    const db = this.db.getDb()
    
    // If this model should be default, unset other defaults first
    if (updates.isDefault) {
      await this.clearAllDefaults()
    }

    db.update(modelConfigs)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(modelConfigs.id, id))
      .run()
  }

  // Set a model as default
  async setDefault(id: string): Promise<void> {
    const db = this.db.getDb()
    
    // Clear all existing defaults
    await this.clearAllDefaults()
    
    // Set the new default
    db.update(modelConfigs)
      .set({
        isDefault: true,
        updatedAt: new Date()
      })
      .where(eq(modelConfigs.id, id))
      .run()
  }

  // Clear all default flags
  private async clearAllDefaults(): Promise<void> {
    const db = this.db.getDb()
    db.update(modelConfigs)
      .set({
        isDefault: false,
        updatedAt: new Date()
      })
      .where(eq(modelConfigs.isDefault, true))
      .run()
  }

  // Delete a model configuration
  async deleteModel(id: string): Promise<void> {
    const db = this.db.getDb()
    db.delete(modelConfigs).where(eq(modelConfigs.id, id)).run()
  }

  // Check if a model exists
  async modelExists(providerId: string, modelId: string): Promise<boolean> {
    const db = this.db.getDb()
    const result = db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.providerId, providerId))
      .all()
    return result.some(m => m.modelId === modelId)
  }
}
