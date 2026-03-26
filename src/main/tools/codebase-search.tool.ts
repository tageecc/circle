import { tool } from 'ai'
import { z } from 'zod'
import { CodebaseIndexService } from '../services/codebase-index.service'

const inputSchema = z.object({
  query: z.string().describe('A complete question about what you want to understand'),
  target_directories: z.array(z.string()).describe('Prefix directory paths to limit search scope'),
  explanation: z.string().describe('One sentence explanation as to why this tool is being used')
})

/**
 * 代码库语义搜索工具 - 使用 sqlite-vec 向量检索
 */
export const codebaseSearchTool = tool({
  description: `Semantic vector search that finds code by meaning using embeddings. Powered by sqlite-vec extension.

### When to Use This Tool

Use codebase_search when you need to:
- Explore unfamiliar codebases to understand architecture
- Ask "how/where/what" questions about behavior (e.g., "How is user authentication handled?")
- Find code by concept rather than exact keywords (e.g., "error handling logic")
- Discover related code across multiple files based on semantic similarity
- Understand data flow or component relationships

### When NOT to Use

Skip codebase_search for:
- **Exact text matches** → use \`grep\` (faster and more precise)
- **Reading known files** → use \`read_file\` (no need to search)
- **Simple symbol lookups** → use \`grep\` with exact patterns
- **Find files by name** → use \`glob_file_search\` or \`list_dir\`
- **Project not indexed** → check if index exists first
- **Embedding API not configured** → requires OpenAI/Voyage API key in settings

### How It Works
- Converts query into embeddings (text-embedding-3-small or voyage-code-2)
- Uses cosine similarity to find semantically similar code chunks
- Falls back to text search if embedding generation fails
- Returns results sorted by similarity score (0-1, higher = more similar)

### Key Features
- True semantic search using vector embeddings
- Returns top 15 results with relevance scores (0.5+ threshold)
- Includes file paths, code snippets, and programming language
- Works with 20+ programming languages
- Batched embedding generation for efficient indexing

### Decision Guide

<example>
  Query: "How does the authentication middleware verify tokens?"
  Tool: codebase_search
  <reasoning>
    Good: Semantic question about behavior, will find related auth/token code even with different naming
  </reasoning>
</example>

<example>
  Query: Find all occurrences of "validateUser"
  Tool: grep
  <reasoning>
    Bad for codebase_search: Exact symbol lookup, grep is faster and more accurate
  </reasoning>
</example>

<example>
  Query: "Where are error boundaries implemented?"
  Tool: codebase_search
  <reasoning>
    Good: Conceptual search - will find ErrorBoundary, error handling, fallback UI, etc.
  </reasoning>
</example>

### Important Notes
- Requires project to be indexed first (check with "Index Project" feature)
- Requires embedding API configured in settings (OpenAI or Voyage AI)
- Results ranked by cosine similarity (1 - distance), filtered at 0.5+ threshold
- Indexing generates embeddings for all code chunks (slower but enables semantic search)
- Query time: <100ms for most codebases, including embedding generation`,
  inputSchema,
  execute: async ({ query, target_directories, explanation }) => {
    try {
      const indexService = CodebaseIndexService.getInstance()

      console.log(`[CodebaseSearch] ${explanation}`)
      console.log(`[CodebaseSearch] Query: "${query}"`)
      console.log(
        `[CodebaseSearch] Target: ${target_directories.length > 0 ? target_directories.join(', ') : 'entire codebase'}`
      )

      const projectPath = target_directories.length > 0 ? target_directories[0] : process.cwd()

      const hasIndex = await indexService.hasIndex(projectPath)
      if (!hasIndex) {
        console.warn(`[CodebaseSearch] No index found for project: ${projectPath}`)
        return JSON.stringify({
          success: false,
          error: 'Codebase index not found',
          message: 'Please index the project first using the "Index Project" feature',
          projectPath
        })
      }

      const results = await indexService.search(projectPath, query, {
        limit: 15,
        minScore: 0.5
      })

      console.log(`[CodebaseSearch] Found ${results.length} results`)

      return JSON.stringify({
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
