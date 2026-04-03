import { defineTool } from './define-tool'
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
export const codebaseSearchTool = defineTool({
  description: `Semantic code search - finds code by meaning (vector search) or text (LIKE search).

### Mode Selection

- **Vector search enabled**: Uses AI embeddings for true semantic search
- **Vector search disabled**: Uses simple text LIKE matching

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
