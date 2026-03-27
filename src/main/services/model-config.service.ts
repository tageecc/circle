import { eq, and } from 'drizzle-orm'
import { CircleDatabase } from '../database/db'
import { modelConfigs, ModelConfig } from '../database/schema'
import { nanoid } from 'nanoid'

export class ModelConfigService {
  constructor(private db: CircleDatabase) {}

  async getAllModels(): Promise<ModelConfig[]> {
    const db = this.db.getDb()
    return db.select().from(modelConfigs).all()
  }

  async getModelsByProvider(providerId: string): Promise<ModelConfig[]> {
    const db = this.db.getDb()
    return db.select().from(modelConfigs).where(eq(modelConfigs.providerId, providerId)).all()
  }

  async getDefaultModel(): Promise<ModelConfig | undefined> {
    const db = this.db.getDb()
    return db.select().from(modelConfigs).where(eq(modelConfigs.isDefault, true)).get()
  }

  async addModel(input: {
    providerId: string
    modelId: string
    displayName?: string
    isDefault?: boolean
  }): Promise<ModelConfig> {
    const db = this.db.getDb()
    const now = new Date()

    if (input.isDefault) {
      db.update(modelConfigs)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(modelConfigs.isDefault, true))
        .run()
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

  async updateModel(id: string, displayName: string): Promise<void> {
    const db = this.db.getDb()
    db.update(modelConfigs)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(modelConfigs.id, id))
      .run()
  }

  async setDefault(id: string): Promise<void> {
    const db = this.db.getDb()
    const now = new Date()

    db.update(modelConfigs)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(modelConfigs.isDefault, true))
      .run()

    db.update(modelConfigs)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(modelConfigs.id, id))
      .run()
  }

  async deleteModel(id: string): Promise<void> {
    const db = this.db.getDb()
    db.delete(modelConfigs).where(eq(modelConfigs.id, id)).run()
  }

  async modelExists(providerId: string, modelId: string): Promise<boolean> {
    const db = this.db.getDb()
    const result = db
      .select({ id: modelConfigs.id })
      .from(modelConfigs)
      .where(and(eq(modelConfigs.providerId, providerId), eq(modelConfigs.modelId, modelId)))
      .get()
    return result !== undefined
  }
}
