import { z } from 'zod'
import { CodebaseIndexService } from '../services/codebase-index.service'

/**
 * 代码库语义搜索工具
 * 基于 Cursor 的 codebase_search 设计，集成 Mastra RAG
 */
export const codebaseSearchTool = {
  description: `\`codebase_search\`: semantic search that finds code by meaning, not exact text

### When to Use This Tool

Use \`codebase_search\` when you need to:
- Explore unfamiliar codebases
- Ask "how / where / what" questions to understand behavior
- Find code by meaning rather than exact text

### When NOT to Use

Skip \`codebase_search\` for:
1. Exact text matches (use \`grep\`)
2. Reading known files (use \`read_file\`)
3. Simple symbol lookups (use \`grep\`)
4. Find file by name (use \`file_search\`)`,

  parameters: z.object({
    query: z.string().describe('A complete question about what you want to understand'),
    target_directories: z
      .array(z.string())
      .describe('Prefix directory paths to limit search scope'),
    explanation: z.string().describe('One sentence explanation as to why this tool is being used')
  }),

  execute: async ({
    query,
    target_directories,
    explanation
  }: {
    query: string
    target_directories: string[]
    explanation: string
  }) => {
    try {
      const indexService = CodebaseIndexService.getInstance()
      console.log(`[CodebaseSearch] ${explanation}`)
      console.log(`[CodebaseSearch] Query: "${query}"`)
      console.log(
        `[CodebaseSearch] Target: ${target_directories.length > 0 ? target_directories.join(', ') : 'entire codebase'}`
      )
      const projectPath = target_directories.length > 0 ? target_directories[0] : process.cwd()
      const indexStats = await indexService.getProjectIndex(projectPath)
      if (!indexStats) {
        return {
          success: false,
          error: 'Project not indexed. Please index the codebase first using the indexing service.',
          projectPath,
          suggestion: 'Run codebase indexing from the IDE before using semantic search.'
        }
      }

      const results = await indexService.searchCodebase(projectPath, query, 30)

      return {
        success: true,
        query,
        projectPath,
        results: results.map((r) => ({
          filePath: r.filePath,
          relativePath: r.relativePath,
          text: r.text,
          score: r.score,
          language: r.language
        })),
        totalResults: results.length,
        indexStats: {
          totalFiles: indexStats.totalFiles,
          totalChunks: indexStats.totalChunks,
          indexedAt: new Date(indexStats.indexedAt).toISOString()
        }
      }
    } catch (error: any) {
      console.error('[CodebaseSearch] Error:', error)
      return {
        success: false,
        error: error.message,
        query
      }
    }
  }
}
