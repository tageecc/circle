/**
 * Codebase Index Service
 * 代码库索引服务 - 使用 SQLite + sqlite-vec 向量搜索
 */

import { FileService } from './file.service'
import { EmbeddingService } from './embedding.service'
import { getDb } from '../database/db'
import * as schema from '../database/schema'
import * as path from 'path'
import * as crypto from 'crypto'
import { eq, and, sql, isNotNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

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
}

export class CodebaseIndexService {
  private static instance: CodebaseIndexService
  private db = getDb()
  private embeddingService = EmbeddingService.getInstance()

  private readonly MAX_FILE_SIZE = 1024 * 1024
  private readonly CHUNK_MAX_SIZE = 512
  private readonly CHUNK_OVERLAP = 50

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
    if (!this.instance) {
      this.instance = new CodebaseIndexService()
    }
    return this.instance
  }

  async indexProject(
    projectPath: string,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<IndexStats> {
    console.log('[CodebaseIndex] Starting indexing:', projectPath)

    const vectorEnabled = this.embeddingService.isEnabled()
    const db = this.db.getDb()
    
    if (vectorEnabled) {
      if (!this.embeddingService.isConfigured()) {
        throw new Error('Vector search enabled but embedding API not configured. Configure in Settings → API Keys')
      }

      const embeddingConfig = this.embeddingService.getConfig()!
      console.log(`[CodebaseIndex] Vector search enabled: ${embeddingConfig.model} (${embeddingConfig.dimensions}d)`)

      // Check dimension mismatch
      const existingVector = db
        .select({ embedding: schema.codebaseVectors.embedding })
        .from(schema.codebaseVectors)
        .where(eq(schema.codebaseVectors.projectPath, projectPath))
        .limit(1)
        .get()

      if (existingVector?.embedding && existingVector.embedding.length / 4 !== embeddingConfig.dimensions) {
        console.warn('[CodebaseIndex] Dimension mismatch, deleting old index...')
        await this.deleteProject(projectPath)
      }
    } else {
      console.log('[CodebaseIndex] Vector search disabled, using text-only index')
    }

    const existingFiles = await this.loadFileMetadata(projectPath)
    const currentFiles = await this.scanFiles(projectPath, onProgress)

    const changes = this.detectChanges(existingFiles, currentFiles)
    console.log('[CodebaseIndex] File changes:', {
      new: changes.newFiles.length,
      modified: changes.modifiedFiles.length,
      deleted: changes.deletedFiles.length,
      unchanged: changes.unchangedFiles.length
    })

    await this.handleDeletedFiles(projectPath, changes.deletedFiles)

    const filesToIndex = [...changes.newFiles, ...changes.modifiedFiles]

    if (filesToIndex.length === 0) {
      console.log('[CodebaseIndex] ✅ No files to index')
      onProgress?.(100, 100, '✅ 索引已是最新')

      const [existingIndex] = db
        .select()
        .from(schema.codebaseIndexes)
        .where(eq(schema.codebaseIndexes.projectPath, projectPath))
        .limit(1)
        .all()

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

    db.insert(schema.codebaseIndexes)
      .values({
        projectPath,
        projectName: path.basename(projectPath),
        totalFiles: 0,
        totalChunks: 0,
        totalSize: 0,
        indexedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoNothing()
      .run()

    await this.indexFiles(projectPath, filesToIndex, currentFiles, onProgress)

    const stats = await this.updateIndexStats(projectPath, currentFiles, changes)

    console.log('[CodebaseIndex] ✅ Indexing complete:', stats)
    return stats
  }

  private async loadFileMetadata(projectPath: string): Promise<Map<string, FileMetadata>> {
    const db = this.db.getDb()
    const files = db
      .select()
      .from(schema.codebaseFiles)
      .where(eq(schema.codebaseFiles.projectPath, projectPath))
      .all()

    const metadata = new Map<string, FileMetadata>()
    for (const file of files) {
      metadata.set(file.filePath, {
        filePath: file.filePath,
        relativePath: file.relativePath,
        contentHash: file.contentHash,
        fileSize: file.fileSize,
        language: file.language
      })
    }

    return metadata
  }

  private async scanFiles(
    projectPath: string,
    onProgress?: (progress: number, total: number, message: string) => void
  ): Promise<Map<string, FileMetadata>> {
    const allFiles = await this.collectFiles(projectPath)
    const fileMetadata = new Map<string, FileMetadata>()

    let processed = 0
    const total = allFiles.length

    for (const filePath of allFiles) {
      try {
        const content = await FileService.readFile(filePath)
        const contentHash = crypto.createHash('md5').update(content).digest('hex')
        const fileSize = Buffer.byteLength(content, 'utf-8')
        const ext = path.extname(filePath).toLowerCase()
        const language = this.LANGUAGE_MAP[ext] || 'unknown'
        const relativePath = path.relative(projectPath, filePath)

        fileMetadata.set(filePath, {
          filePath,
          relativePath,
          contentHash,
          fileSize,
          language
        })

        processed++
        if (processed % 50 === 0 || processed === total) {
          const progress = Math.floor((processed / total) * 10)
          onProgress?.(progress, 100, `扫描文件: ${processed}/${total}`)
        }
      } catch (error) {
        console.error(`[CodebaseIndex] Failed to scan ${filePath}:`, error)
      }
    }

    return fileMetadata
  }

  private async collectFiles(dirPath: string): Promise<string[]> {
    const files: string[] = []

    const walk = async (currentPath: string) => {
      const fs = await import('fs/promises')
      const items = await fs.readdir(currentPath, { withFileTypes: true })

      for (const item of items) {
        if (item.name.startsWith('.') || this.IGNORE_DIRS.includes(item.name)) {
          continue
        }

        const fullPath = path.join(currentPath, item.name)

        if (item.isDirectory()) {
          await walk(fullPath)
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase()
          if (this.SUPPORTED_EXTS.includes(ext)) {
            const stats = await fs.stat(fullPath)
            if (stats.size <= this.MAX_FILE_SIZE) {
              files.push(fullPath)
            }
          }
        }
      }
    }

    await walk(dirPath)
    return files
  }

  private detectChanges(
    existingFiles: Map<string, FileMetadata>,
    currentFiles: Map<string, FileMetadata>
  ) {
    const newFiles: string[] = []
    const modifiedFiles: string[] = []
    const unchangedFiles: string[] = []
    const deletedFiles: string[] = []

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

    for (const filePath of existingFiles.keys()) {
      if (!currentFiles.has(filePath)) {
        deletedFiles.push(filePath)
      }
    }

    return { newFiles, modifiedFiles, unchangedFiles, deletedFiles }
  }

  private async handleDeletedFiles(projectPath: string, deletedFiles: string[]) {
    if (deletedFiles.length === 0) return

    console.log(`[CodebaseIndex] Deleting ${deletedFiles.length} removed files...`)
    const db = this.db.getDb()

    for (const filePath of deletedFiles) {
      db.delete(schema.codebaseVectors)
        .where(
          and(
            eq(schema.codebaseVectors.projectPath, projectPath),
            eq(schema.codebaseVectors.filePath, filePath)
          )
        )
        .run()

      db.delete(schema.codebaseFiles)
        .where(
          and(
            eq(schema.codebaseFiles.projectPath, projectPath),
            eq(schema.codebaseFiles.filePath, filePath)
          )
        )
        .run()
    }

    console.log(`[CodebaseIndex] ✅ Deleted ${deletedFiles.length} files`)
  }

  private async indexFiles(
    projectPath: string,
    filesToIndex: string[],
    currentFiles: Map<string, FileMetadata>,
    onProgress?: (progress: number, total: number, message: string) => void
  ) {
    const db = this.db.getDb()
    let processed = 0
    const total = filesToIndex.length

    for (const filePath of filesToIndex) {
      const meta = currentFiles.get(filePath)!

      try {
        db.delete(schema.codebaseVectors)
          .where(
            and(
              eq(schema.codebaseVectors.projectPath, projectPath),
              eq(schema.codebaseVectors.filePath, filePath)
            )
          )
          .run()

        const content = await FileService.readFile(filePath)
        const chunks = this.chunkText(content)

        // Generate embeddings if vector search is enabled
        let embeddings: Float32Array[] = []
        if (this.embeddingService.isEnabled()) {
          embeddings = await this.embeddingService.generateEmbeddings(chunks)
        }

        for (let i = 0; i < chunks.length; i++) {
          const chunkText = chunks[i]
          const embedding = embeddings[i]
          const now = new Date()

          db.insert(schema.codebaseVectors)
            .values({
              id: nanoid(),
              projectPath,
              filePath,
              relativePath: meta.relativePath,
              text: chunkText,
              language: meta.language,
              embedding: embedding ? Buffer.from(embedding.buffer) : null,
              createdAt: now
            })
            .run()
        }

        const now = new Date()
        db.insert(schema.codebaseFiles)
          .values({
            id: nanoid(),
            projectPath,
            filePath,
            relativePath: meta.relativePath,
            contentHash: meta.contentHash,
            fileSize: meta.fileSize,
            language: meta.language,
            indexedAt: now,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [schema.codebaseFiles.projectPath, schema.codebaseFiles.filePath],
            set: {
              contentHash: meta.contentHash,
              fileSize: meta.fileSize,
              indexedAt: now,
              updatedAt: now
            }
          })
          .run()

        processed++
        const progress = 10 + Math.floor((processed / total) * 80)
        const message = this.embeddingService.isEnabled() 
          ? `索引文件 (含向量化): ${processed}/${total}` 
          : `索引文件: ${processed}/${total}`
        onProgress?.(progress, 100, message)
      } catch (error) {
        console.error(`[CodebaseIndex] Failed to index ${meta.relativePath}:`, error)
      }
    }
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = []
    const lines = text.split('\n')
    let currentChunk = ''
    let currentSize = 0

    for (const line of lines) {
      const lineSize = Math.ceil(line.length / 4)

      if (lineSize > this.CHUNK_MAX_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
          currentSize = 0
        }

        const words = line.split(/\s+/)
        let longLineChunk = ''
        let longLineSize = 0

        for (const word of words) {
          const wordSize = Math.ceil(word.length / 4)
          if (longLineSize + wordSize > this.CHUNK_MAX_SIZE) {
            if (longLineChunk) {
              chunks.push(longLineChunk.trim())
            }
            longLineChunk = word
            longLineSize = wordSize
          } else {
            longLineChunk += (longLineChunk ? ' ' : '') + word
            longLineSize += wordSize
          }
        }

        if (longLineChunk) {
          chunks.push(longLineChunk.trim())
        }
        continue
      }

      if (currentSize + lineSize > this.CHUNK_MAX_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }

        if (this.CHUNK_OVERLAP > 0 && chunks.length > 0) {
          const prevLines = currentChunk.split('\n')
          const overlapLines = prevLines.slice(-Math.ceil(this.CHUNK_OVERLAP / 10))
          currentChunk = overlapLines.join('\n') + '\n' + line
          currentSize = Math.ceil(currentChunk.length / 4)
        } else {
          currentChunk = line
          currentSize = lineSize
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line
        currentSize += lineSize
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    return chunks.length > 0 ? chunks : [text]
  }

  private async updateIndexStats(
    projectPath: string,
    currentFiles: Map<string, FileMetadata>,
    changes: {
      newFiles: string[]
      modifiedFiles: string[]
      deletedFiles: string[]
      unchangedFiles: string[]
    }
  ): Promise<IndexStats> {
    const db = this.db.getDb()

    const totalChunks = db
      .select()
      .from(schema.codebaseVectors)
      .where(eq(schema.codebaseVectors.projectPath, projectPath))
      .all().length

    const totalSize = Array.from(currentFiles.values()).reduce((sum, f) => sum + f.fileSize, 0)
    const now = new Date()

    db.insert(schema.codebaseIndexes)
      .values({
        projectPath,
        projectName: path.basename(projectPath),
        totalFiles: currentFiles.size,
        totalChunks,
        totalSize,
        indexedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.codebaseIndexes.projectPath],
        set: {
          projectName: path.basename(projectPath),
          totalFiles: currentFiles.size,
          totalChunks,
          totalSize,
          indexedAt: now,
          updatedAt: now
        }
      })
      .run()

    return {
      projectPath,
      projectName: path.basename(projectPath),
      totalFiles: currentFiles.size,
      totalChunks,
      totalSize,
      indexedAt: Date.now(),
      newFiles: changes.newFiles.length,
      modifiedFiles: changes.modifiedFiles.length,
      deletedFiles: changes.deletedFiles.length,
      unchangedFiles: changes.unchangedFiles.length
    }
  }

  async hasIndex(projectPath: string): Promise<boolean> {
    const db = this.db.getDb()
    const [index] = db
      .select()
      .from(schema.codebaseIndexes)
      .where(eq(schema.codebaseIndexes.projectPath, projectPath))
      .limit(1)
      .all()
    return !!index
  }

  async getProjectIndex(projectPath: string) {
    const db = this.db.getDb()
    const [index] = db
      .select()
      .from(schema.codebaseIndexes)
      .where(eq(schema.codebaseIndexes.projectPath, projectPath))
      .limit(1)
      .all()

    if (!index) {
      return null
    }

    return {
      projectName: index.projectName,
      totalFiles: index.totalFiles,
      totalChunks: index.totalChunks,
      totalSize: index.totalSize,
      indexedAt: new Date(index.indexedAt)
    }
  }

  async search(
    projectPath: string,
    query: string,
    options?: { limit?: number; minScore?: number }
  ): Promise<SearchResult[]> {
    return this.searchCodebase(projectPath, query, options)
  }

  async searchCodebase(
    projectPath: string,
    query: string,
    options?: { limit?: number; minScore?: number }
  ): Promise<SearchResult[]> {
    const db = this.db.getDb()
    const { limit = 15, minScore = 0.5 } = options || {}

    // If vector search is disabled, use text LIKE search
    if (!this.embeddingService.isEnabled()) {
      const results = db
        .select()
        .from(schema.codebaseVectors)
        .where(
          and(
            eq(schema.codebaseVectors.projectPath, projectPath),
            sql`${schema.codebaseVectors.text} LIKE ${'%' + query + '%'}`
          )
        )
        .limit(limit)
        .all()

      return results.map((row) => ({
        filePath: row.filePath,
        relativePath: row.relativePath,
        text: row.text,
        score: 1.0,
        language: row.language
      }))
    }

    // Vector search enabled
    const queryEmbedding = await this.embeddingService.generateEmbedding(query)
    const queryBuffer = Buffer.from(queryEmbedding.buffer)

    const results = db
      .select({
        id: schema.codebaseVectors.id,
        filePath: schema.codebaseVectors.filePath,
        relativePath: schema.codebaseVectors.relativePath,
        text: schema.codebaseVectors.text,
        language: schema.codebaseVectors.language,
        embedding: schema.codebaseVectors.embedding,
        distance: sql<number>`vec_distance_cosine(${schema.codebaseVectors.embedding}, ${queryBuffer})`
      })
      .from(schema.codebaseVectors)
      .where(
        and(
          eq(schema.codebaseVectors.projectPath, projectPath),
          isNotNull(schema.codebaseVectors.embedding)
        )
      )
      .orderBy(sql`vec_distance_cosine(${schema.codebaseVectors.embedding}, ${queryBuffer})`)
      .limit(limit)
      .all()

    // Filter by minimum similarity score (1 - distance for cosine)
    return results
      .map((row) => ({
        filePath: row.filePath,
        relativePath: row.relativePath,
        text: row.text,
        score: 1 - row.distance,
        language: row.language
      }))
      .filter((result) => result.score >= minScore)
  }

  async deleteProject(projectPath: string): Promise<void> {
    console.log(`[CodebaseIndex] Deleting index for project: ${projectPath}`)
    const db = this.db.getDb()

    db.delete(schema.codebaseVectors)
      .where(eq(schema.codebaseVectors.projectPath, projectPath))
      .run()

    db.delete(schema.codebaseFiles).where(eq(schema.codebaseFiles.projectPath, projectPath)).run()

    db.delete(schema.codebaseIndexes)
      .where(eq(schema.codebaseIndexes.projectPath, projectPath))
      .run()

    console.log(`[CodebaseIndex] ✅ Deleted index for ${projectPath}`)
  }
}
