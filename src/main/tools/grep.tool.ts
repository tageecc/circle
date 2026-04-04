import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ToolCallOptions } from '@ai-sdk/provider-utils'
import { defineTool } from './define-tool'
import { z } from 'zod'
import { getToolContext } from '../services/tool-context'
import { resolveRipgrepExecutable } from './ripgrep-path'
import { getCurrentProjectDir, resolveFilePath } from './utils'

const execFileAsync = promisify(execFile)

const inputSchema = z.object({
  pattern: z.string().describe('The regular expression pattern to search for'),
  path: z.string().optional().describe('File or directory to search in'),
  output_mode: z
    .enum(['content', 'files_with_matches', 'count'])
    .optional()
    .describe('Output format'),
  head_limit: z.number().optional().describe('Limit output to first N lines')
})

/**
 * Grep Search Tool
 */
export const grepTool = defineTool({
  description: `Fast exact-text search powered by ripgrep. Finds code by literal strings or regex patterns.

### When to Use This Tool

Use grep when you need to:
- Find exact symbol names (functions, classes, variables)
- Search for literal strings (error messages, URLs, IDs)
- Use regex patterns for structured matches
- List all files containing a specific text
- Count occurrences of a pattern

### When NOT to Use

Skip grep for:
- **Semantic/conceptual searches** → use \`codebase_search\` (understands meaning)
- **Reading known files** → use \`read_file\` (no need to search)
- **Finding files by name** → use \`glob_file_search\` (faster for filenames)

### Key Features
- Lightning fast (ripgrep; Circle bundles a binary via \`@vscode/ripgrep\`, with PATH \`rg\` as fallback)
- Full regex support (capture groups, lookaheads, etc.)
- Auto-ignores node_modules, .git, dist directories
- Multiple output modes for different use cases
- Respects .gitignore automatically

### Output Modes

- **content** (default): Shows matching lines with context
- **files_with_matches**: Lists only file paths (useful for "which files have X?")
- **count**: Shows match count per file (useful for statistics)

### Pattern Syntax

Ripgrep uses Rust regex syntax. Common patterns:

<example>
  Pattern: "function\\s+\\w+"
  Matches: Function declarations (function myFunc)
  <reasoning>
    Good: \\s+ matches whitespace, \\w+ matches identifier
  </reasoning>
</example>

<example>
  Pattern: "import.*from ['\"]react['\"]"
  Matches: React imports
  <reasoning>
    Good: .* matches anything, ['\"] matches either quote type
  </reasoning>
</example>

<example>
  Pattern: "TODO:|FIXME:"
  Matches: Comment annotations
  <reasoning>
    Good: Literal match with alternation
  </reasoning>
</example>

### Special Characters to Escape

Escape these in patterns: \`. * + ? ^ $ { } ( ) [ ] | \\\`

### Decision Guide

<example>
  Query: Find where "ConfigService" is imported
  Tool: grep
  Pattern: "import.*ConfigService"
  <reasoning>
    Perfect: Exact symbol lookup with pattern matching
  </reasoning>
</example>

<example>
  Query: Find all TypeScript files that use "useState"
  Tool: grep
  Pattern: "useState"
  Output: files_with_matches
  <reasoning>
    Good: Want file list, not all occurrences. Exact symbol search.
  </reasoning>
</example>

<example>
  Query: How is authentication implemented?
  Tool: codebase_search (NOT grep)
  <reasoning>
    Bad for grep: This is a semantic question, need understanding not text match
  </reasoning>
</example>

### Performance Tips
- Use specific patterns to reduce false positives
- Use files_with_matches mode when you only need file lists
- Combine with head_limit for large result sets

### Examples

\`\`\`typescript
// Find function definitions
grep(pattern="export function \\w+", output_mode="content")

// Find which files import React
grep(pattern="from ['\"]react['\"]", output_mode="files_with_matches")

// Count TODO comments
grep(pattern="TODO:", output_mode="count")

// Find error handling
grep(pattern="catch\\s*\\(", output_mode="content")
\`\`\``,
  inputSchema,
  execute: async ({ pattern, path, output_mode, head_limit }, options: ToolCallOptions) => {
    try {
      const { workspaceRoot } = getToolContext(options)
      const searchPath = path ? resolveFilePath(path) : workspaceRoot || getCurrentProjectDir()
      const mode = output_mode || 'content'

      const args = [
        '--color',
        'never',
        '--glob',
        '!node_modules/**',
        '--glob',
        '!.git/**',
        '--glob',
        '!dist/**'
      ]
      if (mode === 'files_with_matches') {
        args.push('-l')
      } else if (mode === 'count') {
        args.push('-c')
      }
      args.push(pattern, searchPath)

      try {
        const rgBin = resolveRipgrepExecutable()
        const { stdout } = await execFileAsync(rgBin, args, { maxBuffer: 1024 * 1024 * 10 })
        let out = stdout.toString()
        if (head_limit !== undefined && head_limit > 0) {
          const lines = out.split('\n')
          out = lines.slice(0, head_limit).join('\n')
        }
        return out || 'No matches found'
      } catch (error: unknown) {
        const err = error as { code?: number }
        if (err.code === 1) {
          return 'No matches found'
        }
        throw error
      }
    } catch (error: unknown) {
      const err = error as Error
      throw new Error(`Grep search failed: ${err.message}`)
    }
  }
})
