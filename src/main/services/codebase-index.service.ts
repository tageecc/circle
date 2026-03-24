import { FileService } from './file.service'
import { MDocument } from '@mastra/rag'
import { embed, embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import * as path from 'path'
import * as crypto from 'crypto'
import { getDatabase, getSchema } from '../database/client'
import { eq, and } from 'drizzle-orm'
import * as vectorStore from '../database/vector-store'
import { getConfigService } from '../index'

function getEmbeddingConfig(): { client: ReturnType<typeof createOpenAI>; model: string } {
  const settings = getConfigService().getEmbeddingSettings() ?? {
    provider: 'dashscope' as const,
    model: 'text-embedding-v4',
    apiKey: ''
  }
  const { provider, model, apiKey } = settings
  if (!apiKey?.trim()) {
    throw new Error('请在 设置 → 模型 中配置代码库索引的 Embedding 提供商与 API Key')
  }
  const client =
    provider === 'dashscope'
      ? createOpenAI({ baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey })
      : createOpenAI({ apiKey })
  return {
    client,
    model: model || (provider === 'dashscope' ? 'text-embedding-v4' : 'text-embedding-3-small')
  }
}

interface SearchResult {
  filePath: string
  relativePath: string
  text: string
  score: number
  language: string
}

interface IndexStats {
  projectPath: string
  projectName: string
  totalFiles: number
  totalChunks: number
  totalSize: number
  indexedAt: number

  // 增量更新统计
  newFiles?: number
  modifiedFiles?: number
  deletedFiles?: number
  unchangedFiles?: number
}

interface FileMetadata {
  filePath: string
  relativePath: string
  contentHash: string
  fileSize: number
  language: string
  chunkIds: string[]
  chunkCount: number
}

export class CodebaseIndexService {
  private static instance: CodebaseIndexService | null = null
  private get db() {
    return getDatabase()
  }

  private readonly MAX_FILE_SIZE = 1024 * 1024
  private readonly CHUNK_MAX_SIZE = 512
  private readonly CHUNK_OVERLAP = 50
  private readonly BATCH_SIZE = 10
  private readonly DB_BATCH_SIZE = 100
  /** 语义检索最低相似度，低于此值的 chunk 不返回，避免无关片段干扰 */
  private readonly MIN_SIMILARITY = 0.35

  private readonly SUPPORTED_EXTS = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.go',
    '.rs',
    '.rb',
    '.php',
    '.swift',
    '.kt',
    '.cs',
    '.vue',
    '.svelte',
    '.html',
    '.css',
    '.scss',
    '.md',
    '.sql',
    '.sh'
  ]

  private readonly IGNORE_DIRS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    'coverage',
    '__pycache__',
    'venv',
    'target',
    'vendor'
  ]

  private readonly LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.cs': 'csharp',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'shell'
  }

  private constructor() {}

  static getInstance(): CodebaseIndexService {
    if (this.instance) return this.instance
    this.instance = new CodebaseIndexService()
    return this.instance
  }

  /**
   * 根据 chunk 数量动态计算最优并发度
   */
  private calculateOptimalConcurrency(chunkCount: number): number {
    if (chunkCount < 500) return 8
    if (chunkCount < 2000) return 12
    if (chunkCount < 5000) return 16
    return 20
  }

  /**
   * 增量索引项目（核心方法）
   */
  async indexProject(
    projectPath: string,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<IndexStats> {
    console.log('[CodebaseIndex] Starting incremental indexing:', projectPath)

    // 1. 加载现有文件元数据
    const existingFiles = await this.loadFileMetadata(projectPath)
    console.log(`[CodebaseIndex] Found ${existingFiles.size} existing files in database`)

    // 2. 扫描文件系统，计算哈希
    const currentFiles = await this.scanFiles(projectPath, onProgress)
    console.log(`[CodebaseIndex] Scanned ${currentFiles.size} files in filesystem`)

    // 3. 检测变化：新增、修改、删除
    const changes = this.detectChanges(existingFiles, currentFiles)
    console.log('[CodebaseIndex] File changes detected:', {
      new: changes.newFiles.length,
      modified: changes.modifiedFiles.length,
      deleted: changes.deletedFiles.length,
      unchanged: changes.unchangedFiles.length
    })

    // 4. 处理删除的文件
    await this.handleDeletedFiles(projectPath, existingFiles, changes.deletedFiles, onProgress)

    // 5. 处理新增和修改的文件
    const filesToIndex = [...changes.newFiles, ...changes.modifiedFiles]

    if (filesToIndex.length === 0) {
      console.log('[CodebaseIndex] ✅ No files to index, project is up-to-date')
      onProgress?.(100, 100, '✅ 索引已是最新')
      const schema = getSchema()
      const indexesTable = schema.codebaseIndexes
      const [existingIndex] = await (this.db as any)
        .select()
        .from(indexesTable)
        .where(eq(indexesTable.projectPath, projectPath))
        .limit(1)
      return {
        projectPath,
        projectName: path.basename(projectPath),
        totalFiles: currentFiles.size,
        totalChunks: existingIndex?.totalChunks || 0,
        totalSize: Array.from(currentFiles.values()).reduce((sum, f) => sum + f.fileSize, 0),
        indexedAt: Date.now(),
        newFiles: 0,
        modifiedFiles: 0,
        deletedFiles: changes.deletedFiles.length,
        unchangedFiles: changes.unchangedFiles.length
      }
    }

    // 6. 索引变化的文件
    const indexedFiles = await this.indexFiles(
      projectPath,
      filesToIndex,
      existingFiles,
      currentFiles,
      onProgress
    )

    // 7. 更新数据库统计
    const stats = await this.updateIndexStats(projectPath, currentFiles, indexedFiles, changes)

    console.log('[CodebaseIndex] ✅ Incremental indexing complete:', stats)
    return stats
  }

  /**
   * 加载项目的现有文件元数据
   */
  private async loadFileMetadata(projectPath: string): Promise<Map<string, FileMetadata>> {
    const schema = getSchema()
    const filesTable = schema.codebaseFiles
    const files = await (this.db as any)
      .select()
      .from(filesTable)
      .where(eq(filesTable.projectPath, projectPath))

    const metadata = new Map<string, FileMetadata>()
    for (const file of files) {
      const chunkIds =
        typeof file.chunkIds === 'string'
          ? (JSON.parse(file.chunkIds) as string[])
          : (file.chunkIds as string[])
      metadata.set(file.filePath, {
        filePath: file.filePath,
        relativePath: file.relativePath,
        contentHash: file.contentHash,
        fileSize: file.fileSize,
        language: file.language,
        chunkIds,
        chunkCount: file.chunkCount
      })
    }

    return metadata
  }

  /**
   * 扫描文件系统并计算哈希
   */
  private async scanFiles(
    projectPath: string,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<Map<string, FileMetadata>> {
    const allFiles = await this.collectFiles(projectPath)
    const fileMetadata = new Map<string, FileMetadata>()

    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i]
      const relativePath = path.relative(projectPath, filePath)

      // 文件扫描阶段占总进度的 10%
      onProgress?.((i * 10) / allFiles.length, 100, `📁 扫描文件: ${relativePath}`)

      try {
        const content = await FileService.readFile(filePath)
        const stat = await FileService.getFileInfo(filePath)

        // 跳过大文件
        if (stat.size > this.MAX_FILE_SIZE) continue

        // 计算文件哈希
        const contentHash = crypto.createHash('md5').update(content).digest('hex')

        fileMetadata.set(filePath, {
          filePath,
          relativePath,
          contentHash,
          fileSize: stat.size,
          language: this.getLanguage(filePath),
          chunkIds: [], // 将在索引时填充
          chunkCount: 0
        })
      } catch (error) {
        console.error(`[CodebaseIndex] Failed to scan ${relativePath}:`, error)
      }
    }

    return fileMetadata
  }

  /**
   * 检测文件变化
   */
  private detectChanges(
    existingFiles: Map<string, FileMetadata>,
    currentFiles: Map<string, FileMetadata>
  ) {
    const newFiles: string[] = []
    const modifiedFiles: string[] = []
    const unchangedFiles: string[] = []
    const deletedFiles: string[] = []

    // 检测新增和修改
    for (const [filePath, currentMeta] of currentFiles) {
      const existingMeta = existingFiles.get(filePath)

      if (!existingMeta) {
        newFiles.push(filePath)
      } else if (existingMeta.contentHash !== currentMeta.contentHash) {
        modifiedFiles.push(filePath)
      } else {
        unchangedFiles.push(filePath)
      }
    }

    // 检测删除
    for (const filePath of existingFiles.keys()) {
      if (!currentFiles.has(filePath)) {
        deletedFiles.push(filePath)
      }
    }

    return { newFiles, modifiedFiles, unchangedFiles, deletedFiles }
  }

  /**
   * 处理删除的文件（批量处理）
   */
  private async handleDeletedFiles(
    projectPath: string,
    existingFiles: Map<string, FileMetadata>,
    deletedFiles: string[],
    _onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<void> {
    if (deletedFiles.length === 0) return

    console.log(`[CodebaseIndex] Deleting ${deletedFiles.length} removed files...`)

    // 收集所有需要删除的 chunk IDs（从已加载的元数据中获取）
    const allChunkIds: string[] = []
    for (const filePath of deletedFiles) {
      const fileRecord = existingFiles.get(filePath)
      if (fileRecord && fileRecord.chunkIds.length > 0) {
        allChunkIds.push(...fileRecord.chunkIds)
      }
    }

    const { codebaseFiles } = getSchema()
    if (allChunkIds.length > 0) vectorStore.deleteChunkIds(projectPath, allChunkIds)
    for (const filePath of deletedFiles)
      await (this.db as any)
        .delete(codebaseFiles)
        .where(
          and(eq(codebaseFiles.projectPath, projectPath), eq(codebaseFiles.filePath, filePath))
        )
  }

  /**
   * 索引文件列表
   */
  private async indexFiles(
    projectPath: string,
    filesToIndex: string[],
    existingFiles: Map<string, FileMetadata>,
    currentFiles: Map<string, FileMetadata>,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<Map<string, FileMetadata>> {
    const chunks: Array<{
      text: string
      filePath: string
      relativePath: string
      language: string
    }> = []

    // 1. 收集所有代码块（进度 10-20%）
    for (let i = 0; i < filesToIndex.length; i++) {
      const filePath = filesToIndex[i]
      const meta = currentFiles.get(filePath)
      if (!meta) continue

      const progressPercent = 10 + (i * 10) / filesToIndex.length
      onProgress?.(progressPercent, 100, `📄 处理文件: ${meta.relativePath}`)

      try {
        const existingFile = existingFiles.get(filePath)
        if (existingFile && existingFile.chunkIds.length > 0) {
          vectorStore.deleteChunkIds(projectPath, existingFile.chunkIds)
        }

        // 读取并分块
        const content = await FileService.readFile(filePath)
        const doc = MDocument.fromText(content)
        const docChunks = await doc.chunk({
          strategy: 'recursive',
          maxSize: this.CHUNK_MAX_SIZE,
          overlap: this.CHUNK_OVERLAP
        })

        docChunks.forEach((chunk) => {
          chunks.push({
            text: chunk.text,
            filePath,
            relativePath: meta.relativePath,
            language: meta.language
          })
        })
      } catch (error) {
        console.error(`[CodebaseIndex] Failed to process ${meta.relativePath}:`, error)
      }
    }

    console.log(
      `[CodebaseIndex] Collected ${chunks.length} chunks from ${filesToIndex.length} files`
    )

    if (chunks.length === 0) {
      return new Map()
    }

    // 2. 生成 embeddings（进度 20-90%）
    const allVectors = await this.generateEmbeddings(chunks, projectPath, onProgress)

    // 3. 存储到数据库（进度 90-100%）
    await this.storeVectors(projectPath, allVectors, onProgress)

    // 4. 更新文件元数据
    const indexedFiles = await this.updateFileMetadata(
      projectPath,
      filesToIndex,
      currentFiles,
      chunks,
      allVectors
    )

    return indexedFiles
  }

  /**
   * 生成 embeddings
   */
  private async generateEmbeddings(
    chunks: Array<{ text: string; filePath: string; relativePath: string; language: string }>,
    projectPath: string,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<any[]> {
    const CONCURRENT_BATCHES = this.calculateOptimalConcurrency(chunks.length)
    const allVectors: any[] = []

    // 创建所有批次
    const batches: Array<{ startIdx: number; chunks: typeof chunks }> = []
    for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
      batches.push({
        startIdx: i,
        chunks: chunks.slice(i, i + this.BATCH_SIZE)
      })
    }

    console.log(
      `[CodebaseIndex] Processing ${batches.length} batches with ${CONCURRENT_BATCHES} concurrent requests...`
    )

    // 并发处理批次（进度 20-90%）
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES)
      const batchPromises = concurrentBatches.map(async ({ startIdx, chunks: batchChunks }) => {
        const texts = batchChunks.map((c) => c.text)

        const { client, model } = getEmbeddingConfig()
        const result = await embedMany({
          model: client.embedding(model) as any,
          values: texts
        })

        return result.embeddings.map((embedding, batchIdx) => {
          const chunkIdx = startIdx + batchIdx
          return {
            id: this.generateId(projectPath, chunks[chunkIdx].relativePath, chunkIdx),
            values: [...embedding] as number[],
            metadata: {
              text: chunks[chunkIdx].text,
              filePath: chunks[chunkIdx].filePath,
              relativePath: chunks[chunkIdx].relativePath,
              language: chunks[chunkIdx].language,
              projectPath
            }
          }
        })
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach((vectors) => allVectors.push(...vectors))

      // 更新进度：embedding 生成占 20-90%
      const embeddingProgress = 20 + (allVectors.length / chunks.length) * 70
      const lastChunk = chunks[allVectors.length - 1]
      onProgress?.(
        Math.round(embeddingProgress),
        100,
        `🔄 生成向量: ${allVectors.length}/${chunks.length} (${lastChunk?.relativePath || ''})`
      )

      const progress = Math.min(i + CONCURRENT_BATCHES, batches.length)
      console.log(
        `[CodebaseIndex] Progress: ${progress}/${batches.length} batches (${allVectors.length}/${chunks.length} chunks)`
      )
    }

    return allVectors
  }

  /**
   * 存储向量到 sqlite-vec（circle-vectors.db）
   */
  private async storeVectors(
    projectPath: string,
    allVectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<void> {
    onProgress?.(90, 100, '💾 存储向量...')
    for (let i = 0; i < allVectors.length; i += this.DB_BATCH_SIZE) {
      const batch = allVectors.slice(i, i + this.DB_BATCH_SIZE)
      vectorStore.insertVectors(projectPath, batch)
      const p = 90 + ((i + batch.length) / allVectors.length) * 10
      onProgress?.(
        Math.round(p),
        100,
        `💾 存储: ${Math.min(i + batch.length, allVectors.length)}/${allVectors.length}`
      )
    }
  }

  /**
   * 更新文件元数据
   */
  private async updateFileMetadata(
    projectPath: string,
    filesToIndex: string[],
    currentFiles: Map<string, FileMetadata>,
    _chunks: Array<{ filePath: string }>,
    allVectors: Array<{ id: string; metadata: Record<string, unknown> }>
  ): Promise<Map<string, FileMetadata>> {
    const indexedFiles = new Map<string, FileMetadata>()
    const schema = getSchema()
    const indexesTable = schema.codebaseIndexes
    const filesTable = schema.codebaseFiles
    const now = new Date().toISOString()

    await (this.db as any)
      .insert(indexesTable)
      .values({
        projectPath,
        projectName: path.basename(projectPath),
        indexName: projectPath,
        totalFiles: 0,
        totalChunks: 0,
        totalSize: 0,
        indexedAt: now as never
      })
      .onConflictDoNothing()

    const fileChunkMap = new Map<string, string[]>()
    allVectors.forEach((vector) => {
      const filePath = (vector.metadata.filePath as string) || ''
      if (!fileChunkMap.has(filePath)) fileChunkMap.set(filePath, [])
      fileChunkMap.get(filePath)!.push(vector.id)
    })

    for (const filePath of filesToIndex) {
      const meta = currentFiles.get(filePath)
      if (!meta) continue
      const chunkIds = fileChunkMap.get(filePath) || []
      const updatedMeta = { ...meta, chunkIds, chunkCount: chunkIds.length }
      const row = {
        projectPath,
        filePath: meta.filePath,
        relativePath: meta.relativePath,
        contentHash: meta.contentHash,
        fileSize: meta.fileSize,
        language: meta.language,
        chunkCount: chunkIds.length,
        chunkIds: JSON.stringify(chunkIds),
        indexedAt: now as never
      }
      await (this.db as any)
        .insert(filesTable)
        .values(row as never)
        .onConflictDoUpdate({
          target: [filesTable.projectPath, filesTable.filePath],
          set: {
            relativePath: meta.relativePath,
            contentHash: meta.contentHash,
            fileSize: meta.fileSize,
            language: meta.language,
            chunkCount: chunkIds.length,
            chunkIds: JSON.stringify(chunkIds),
            indexedAt: now as never,
            updatedAt: now as never
          }
        })
      indexedFiles.set(filePath, updatedMeta)
    }
    return indexedFiles
  }

  /**
   * 更新索引统计信息
   */
  private async updateIndexStats(
    projectPath: string,
    currentFiles: Map<string, FileMetadata>,
    _indexedFiles: Map<string, FileMetadata>,
    changes: {
      newFiles: unknown[]
      modifiedFiles: unknown[]
      deletedFiles: unknown[]
      unchangedFiles: unknown[]
    }
  ): Promise<IndexStats> {
    const schema = getSchema()
    const indexesTable = schema.codebaseIndexes
    const filesTable = schema.codebaseFiles
    const totalFiles = currentFiles.size
    const totalSize = Array.from(currentFiles.values()).reduce((sum, f) => sum + f.fileSize, 0)
    const allFiles = await (this.db as any)
      .select()
      .from(filesTable)
      .where(eq(filesTable.projectPath, projectPath))
    const totalChunks = allFiles.reduce(
      (sum: number, f: { chunkCount: number }) => sum + f.chunkCount,
      0
    )
    const now = new Date().toISOString()
    const stats: IndexStats = {
      projectPath,
      projectName: path.basename(projectPath),
      totalFiles,
      totalChunks,
      totalSize,
      indexedAt: Date.now(),
      newFiles: changes.newFiles.length,
      modifiedFiles: changes.modifiedFiles.length,
      deletedFiles: changes.deletedFiles.length,
      unchangedFiles: changes.unchangedFiles.length
    }
    await (this.db as any)
      .insert(indexesTable)
      .values({
        projectPath,
        projectName: stats.projectName,
        indexName: projectPath,
        totalFiles,
        totalChunks,
        totalSize,
        indexedAt: now as never
      })
      .onConflictDoUpdate({
        target: indexesTable.projectPath,
        set: {
          projectName: stats.projectName,
          totalFiles,
          totalChunks,
          totalSize,
          indexedAt: now as never,
          updatedAt: now as never
        }
      })
    return stats
  }

  async searchCodebase(projectPath: string, query: string, limit = 20): Promise<SearchResult[]> {
    const { client, model } = getEmbeddingConfig()
    const result = await embed({
      model: client.embedding(model) as any,
      value: query
    })
    const queryVec = result.embedding as number[]
    const rows = vectorStore.search(projectPath, queryVec, Math.max(limit, 50))
    // sqlite-vec cosine distance: 0 = 相同，2 = 相反 → similarity = 1 - distance
    const withScore = rows.map((row) => {
      const meta = JSON.parse(row.metadata) as Record<string, string>
      const score = 1 - (row.distance ?? 0)
      return { score, metadata: meta }
    })
    const filtered = withScore.filter((r) => r.score >= this.MIN_SIMILARITY)
    return filtered.slice(0, limit).map((r) => ({
      filePath: r.metadata?.filePath || '',
      relativePath: r.metadata?.relativePath || '',
      text: r.metadata?.text || '',
      score: r.score,
      language: r.metadata?.language || 'text'
    }))
  }

  async getProjectIndex(projectPath: string): Promise<IndexStats | null> {
    const schema = getSchema()
    const indexesTable = schema.codebaseIndexes
    const [record] = await (this.db as any)
      .select()
      .from(indexesTable)
      .where(eq(indexesTable.projectPath, projectPath))
      .limit(1)
    if (!record) return null
    const indexedAt =
      typeof record.indexedAt === 'string'
        ? new Date(record.indexedAt).getTime()
        : (record.indexedAt as Date).getTime()
    return {
      projectPath: record.projectPath,
      projectName: record.projectName,
      totalFiles: record.totalFiles,
      totalChunks: record.totalChunks,
      totalSize: record.totalSize,
      indexedAt
    }
  }

  async deleteIndex(projectPath: string): Promise<void> {
    const schema = getSchema()
    try {
      vectorStore.deleteByProjectPath(projectPath)
      await (this.db as any)
        .delete(schema.codebaseFiles)
        .where(eq(schema.codebaseFiles.projectPath, projectPath))
      await (this.db as any)
        .delete(schema.codebaseIndexes)
        .where(eq(schema.codebaseIndexes.projectPath, projectPath))
    } catch (error) {
      console.error('[CodebaseIndex] Delete failed:', error)
      throw error
    }
  }

  private async collectFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    const walk = async (currentPath: string) => {
      const items = await FileService.listDirectory(currentPath)

      for (const item of items) {
        if (this.IGNORE_DIRS.includes(item.name)) continue

        const fullPath = path.join(currentPath, item.name)

        if (item.type === 'directory') {
          await walk(fullPath)
        } else if (item.type === 'file') {
          const ext = path.extname(item.name).toLowerCase()
          if (this.SUPPORTED_EXTS.includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    await walk(dir)
    return files
  }

  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    return this.LANGUAGE_MAP[ext] || 'plaintext'
  }

  private generateId(projectPath: string, relativePath: string, index: number): string {
    return crypto.createHash('md5').update(`${projectPath}:${relativePath}:${index}`).digest('hex')
  }
}
