/**
 * 代码库向量存储：使用 sqlite-vec + better-sqlite3 的 vec0 虚拟表，
 * 支持按 project_path 分区的 KNN 检索（cosine），与主库 circle.db 分离。
 */
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import * as path from 'path'

const VECTOR_DIMENSION = 1024
const TABLE_NAME = 'vec_codebase'

let vectorDb: Database.Database | null = null

function getDb(): Database.Database {
  if (!vectorDb)
    throw new Error('Vector store not initialized. Call initVectorStore(userDataPath) first.')
  return vectorDb
}

export function initVectorStore(userDataPath: string): void {
  if (vectorDb) return
  const dbPath = path.join(userDataPath, 'circle-vectors.db')
  vectorDb = new Database(dbPath)
  sqliteVec.load(vectorDb)
  const stmt = vectorDb.prepare(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${TABLE_NAME} USING vec0(
      project_path TEXT partition key,
      embedding float[${VECTOR_DIMENSION}] distance_metric=cosine,
      +chunk_id TEXT,
      +metadata TEXT
    )
  `)
  stmt.run()
}

export function closeVectorStore(): void {
  if (vectorDb) {
    vectorDb.close()
    vectorDb = null
  }
}

export interface VectorRow {
  chunk_id: string
  metadata: string
  distance: number
}

/** 批量插入向量；维度必须与 VECTOR_DIMENSION(1024) 一致 */
export function insertVectors(
  projectPath: string,
  vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>
): void {
  if (vectors.length === 0) return
  const db = getDb()
  for (const v of vectors) {
    if (v.values.length !== VECTOR_DIMENSION) {
      throw new Error(
        `代码库向量维度必须为 ${VECTOR_DIMENSION}（与当前 embedding 模型一致），当前为 ${v.values.length}。请在设置中选用 1024 维模型或联系支持。`
      )
    }
  }
  const insert = db.prepare(
    `INSERT INTO ${TABLE_NAME}(project_path, embedding, chunk_id, metadata) VALUES (?, ?, ?, ?)`
  )
  const runMany = db.transaction(
    (rows: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) => {
      for (const v of rows) {
        const embedding = new Float32Array(v.values)
        insert.run(projectPath, embedding, v.id, JSON.stringify(v.metadata))
      }
    }
  )
  runMany(vectors)
}

/** 按 project_path 删除所有向量 */
export function deleteByProjectPath(projectPath: string): void {
  getDb().prepare(`DELETE FROM ${TABLE_NAME} WHERE project_path = ?`).run(projectPath)
}

/** 按 project_path + chunk ids 删除指定向量 */
export function deleteChunkIds(projectPath: string, chunkIds: string[]): void {
  if (chunkIds.length === 0) return
  const db = getDb()
  const placeholders = chunkIds.map(() => '?').join(',')
  db.prepare(
    `DELETE FROM ${TABLE_NAME} WHERE project_path = ? AND chunk_id IN (${placeholders})`
  ).run(projectPath, ...chunkIds)
}

/**
 * KNN 检索：按 project_path 分区，返回 top k，distance 为 cosine distance（0=相同，2=相反）。
 * 调用方将 distance 转为相似度：similarity = 1 - distance。
 */
export function search(projectPath: string, queryEmbedding: number[], k: number): VectorRow[] {
  if (queryEmbedding.length !== VECTOR_DIMENSION) {
    throw new Error(
      `查询向量维度必须为 ${VECTOR_DIMENSION}，当前为 ${queryEmbedding.length}。请使用与索引相同的 embedding 模型。`
    )
  }
  const db = getDb()
  const embedding = new Float32Array(queryEmbedding)
  const rows = db
    .prepare(
      `SELECT chunk_id, metadata, distance FROM ${TABLE_NAME}
       WHERE embedding MATCH ? AND k = ? AND project_path = ?`
    )
    .all(embedding, k, projectPath) as VectorRow[]
  return rows
}
