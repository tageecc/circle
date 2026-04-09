import { defineTool } from './define-tool'
import { z } from 'zod'
import { CodebaseIndexService } from '../services/codebase-index.service'
import { getCurrentProjectDir, resolveFilePath } from './utils'

const inputSchema = z.object({
  query: z.string().describe('A complete question about what you want to understand'),
  target_directories: z
    .array(z.string())
    .describe(
      'Directory paths to search (each resolved against the open project). Multiple entries are merged and deduplicated by file path.'
    ),
  explanation: z.string().describe('One sentence explanation as to why this tool is being used')
})

/**
 * 代码库语义搜索工具 - 使用 sqlite-vec 向量检索
 */
export const codebaseSearchTool = defineTool({
  description: `Semantic code search powered by embeddings and sqlite-vec.

### Mode Selection

- Requires vector search to be enabled and configured in Settings → Model Configuration.
- Uses AI embeddings for true semantic search across the indexed codebase.

### When to Use

Use for:
- "How/where/what" questions about code behavior
- Finding code by concept (e.g., "error handling", "authentication")
- Exploring unfamiliar codebases

### When NOT to Use

- Exact text matches → use grep (faster)
- Reading known files → use read_file
- Finding files by name → use glob

<example>
  Query: "How does authentication work?"
  <reasoning>Good: Semantic question, benefits from vector search</reasoning>
</example>

<example>
  Query: Find all "validateUser"
  <reasoning>Bad: Exact match, use grep instead</reasoning>
</example>`,
  inputSchema,
  execute: async ({ query, target_directories, explanation }) => {
    try {
      const indexService = CodebaseIndexService.getInstance()

      console.log(`[CodebaseSearch] ${explanation}`)
      console.log(`[CodebaseSearch] Query: "${query}"`)
      console.log(
        `[CodebaseSearch] Target: ${target_directories.length > 0 ? target_directories.join(', ') : 'entire codebase'}`
      )

      const roots =
        target_directories.length > 0
          ? [...new Set(target_directories.map((d) => resolveFilePath(d)))]
          : [getCurrentProjectDir()]

      const indexedRoots: string[] = []
      for (const p of roots) {
        if (await indexService.hasIndex(p)) indexedRoots.push(p)
      }

      if (indexedRoots.length === 0) {
        console.warn(`[CodebaseSearch] No index for roots: ${roots.join(', ')}`)
        return JSON.stringify({
          success: false,
          error: 'Codebase index not found',
          message:
            'Index the project first after enabling vector search in Settings → Model Configuration.',
          projectPaths: roots
        })
      }

      const limit = 15
      const minScore = 0.5
      const byFile = new Map<
        string,
        { filePath: string; relativePath: string; text: string; score: number; language: string }
      >()

      for (const projectPath of indexedRoots) {
        const batch = await indexService.search(projectPath, query, {
          limit,
          minScore
        })
        for (const r of batch) {
          const prev = byFile.get(r.filePath)
          if (!prev || r.score > prev.score) {
            byFile.set(r.filePath, {
              filePath: r.filePath,
              relativePath: r.relativePath,
              text: r.text,
              score: r.score,
              language: r.language
            })
          }
        }
      }

      const results = [...byFile.values()].sort((a, b) => b.score - a.score).slice(0, limit)

      console.log(`[CodebaseSearch] Found ${results.length} results`)

      return JSON.stringify({
        success: true,
        query,
        explanation,
        projectPaths: indexedRoots,
        results: results.map((r) => ({
          filePath: r.filePath,
          relativePath: r.relativePath,
          text: r.text,
          score: r.score,
          language: r.language
        })),
        count: results.length
      })
    } catch (error: unknown) {
      const err = error as Error
      console.error('[CodebaseSearch] Error:', err)
      return JSON.stringify({
        success: false,
        error: err.message,
        query
      })
    }
  }
})
