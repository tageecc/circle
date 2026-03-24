import { createClient } from '@libsql/client/node'
import { drizzle } from 'drizzle-orm/libsql/node'
import * as path from 'path'
import * as schema from './schema.sqlite'
import { initVectorStore, closeVectorStore } from './vector-store'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export type DbInstance = ReturnType<typeof drizzle<typeof schema>>

export function getDatabase(): DbInstance {
  if (!db) throw new Error('Database not initialized. Call initDatabase(userDataPath) first.')
  return db as DbInstance
}

export function getSchema(): typeof schema {
  return schema
}

export async function closeDatabase(): Promise<void> {
  closeVectorStore()
  db = null
}

export async function initDatabase(userDataPathArg: string): Promise<boolean> {
  try {
    const { runSqliteMigrations } = await import('./migrate.sqlite')
    const dbPath = path.join(userDataPathArg, 'circle.db')
    const client = createClient({ url: `file:${dbPath}` })
    await runSqliteMigrations((sql: string) => client.execute(sql))
    db = drizzle(client, { schema })
    initVectorStore(userDataPathArg)
    return true
  } catch (error) {
    console.error('Database init failed:', error)
    return false
  }
}
