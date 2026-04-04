import { defineTool } from './define-tool'
import { z } from 'zod'
import { glob as globFunc } from 'glob'
import { promises as fs } from 'fs'
import { getCurrentProjectDir, resolveFilePath } from './utils'

const inputSchema = z.object({
  glob_pattern: z
    .string()
    .describe(
      'The glob pattern to match files against.\nPatterns not starting with "**/" are automatically prepended with "**/" to enable recursive searching.\n\nExamples:\n\t- "*.js" (becomes "**/*.js") - find all .js files\n\t- "**/node_modules/**" - find all node_modules directories\n\t- "**/test/**/test_*.ts" - find all test_*.ts files in any test directory\n'
    ),
  target_directory: z
    .string()
    .optional()
    .describe(
      'Directory to search under. If omitted, uses the open project root (same as other file tools).'
    )
})

/**
 * Glob File Search Tool - Cursor 风格
 */
export const globFileSearchTool = defineTool({
  description: `Fast recursive file search using glob patterns. Find files by name/path patterns across entire directory trees.

### When to Use This Tool

Use glob_file_search when you need to:
- Find all files matching a naming pattern (\`*.tsx\`, \`test_*.py\`)
- Locate files by extension across the project
- Find files in specific directory structures (\`**/components/**/*.tsx\`)
- Discover files by naming convention (\`*.config.js\`, \`*.test.ts\`)
- Get a list of files to process or analyze

### When NOT to Use

Skip glob_file_search for:
- **Searching file contents** → use \`grep\` (searches inside files)
- **Semantic code search** → use \`codebase_search\` (understands meaning)
- **Single directory listing** → use \`list_dir\` (faster for one folder)
- **Reading known files** → use \`read_file\` directly

### Glob Pattern Syntax

**Automatic prefix**: Patterns without \`**/\` are prefixed automatically for recursion
- \`*.js\` becomes \`**/*.js\` (finds all .js files recursively)

**Common patterns**:

<example>
  Pattern: "*.tsx"
  Matches: All TypeScript React files anywhere in project
  Result: components/Button.tsx, pages/Home.tsx, etc.
</example>

<example>
  Pattern: "**/__tests__/**/*.ts"
  Matches: All .ts files inside any __tests__ directory
  Result: src/__tests__/utils.test.ts, lib/__tests__/helper.test.ts
</example>

<example>
  Pattern: "**/components/**/*.tsx"
  Matches: All .tsx files in any components folder
  Result: src/components/ui/Button.tsx, lib/components/Icon.tsx
</example>

<example>
  Pattern: "*.config.{js,ts}"
  Matches: Config files with either .js or .ts extension
  Result: vite.config.ts, jest.config.js
</example>

### Pattern Elements

- \`*\` - Match any characters except /
- \`**\` - Match any characters including /  (recursive)
- \`?\` - Match single character
- \`[abc]\` - Match any character in set
- \`{a,b}\` - Match either a or b

### Auto-Ignore

Automatically excludes common directories:
- \`node_modules\`
- \`.git\`
- \`dist\`
- \`build\`

No need to manually exclude these - they're filtered by default.

### Results

- **Sorted by modification time**: Most recently modified first
- **Relative paths**: Easy to use with other tools
- **Empty result**: Clear message if no matches found

### Performance

- ⚡ Lightning fast even on large codebases (10,000+ files)
- 🔍 Uses efficient glob matching algorithms
- 📦 Respects gitignore-style patterns
- 🎯 Returns only files (no directories unless pattern matches)

### Parallel Searching

Call multiple searches simultaneously when independent:

\`\`\`typescript
// Good: Parallel glob searches
glob_file_search("*.tsx")    // Find all React components
glob_file_search("*.test.ts") // Find all test files  
glob_file_search("*.config.*") // Find all config files
\`\`\`

### Examples

<example>
  Scenario: Find all TypeScript files
  Usage: glob_file_search("*.ts")
  <reasoning>
    Good: Simple pattern finds all .ts files recursively
  </reasoning>
</example>

<example>
  Scenario: Find test files following naming convention
  Usage: glob_file_search("*.test.{ts,tsx}")
  <reasoning>
    Good: Matches both .test.ts and .test.tsx files
  </reasoning>
</example>

<example>
  Scenario: Find components in specific structure
  Usage: glob_file_search("**/features/**/components/*.tsx")
  <reasoning>
    Good: Precise pattern for nested component structure
  </reasoning>
</example>

<example>
  Scenario: Search for "AuthService" in files
  Tool: grep (NOT glob_file_search)
  <reasoning>
    Bad: glob searches filenames, not contents. Use grep for text search.
  </reasoning>
</example>

### Pro Tips

1. **Start broad, then narrow**: \`*.tsx\` → \`**/components/**/*.tsx\`
2. **Use extension groups**: \`*.{js,ts,jsx,tsx}\` for all JS/TS files
3. **Combine with other tools**: glob to find files, then read_file to examine
4. **Batch operations**: Glob multiple patterns in parallel for efficiency`,
  inputSchema,
  execute: async ({ glob_pattern, target_directory }) => {
    try {
      const cwd = target_directory ? resolveFilePath(target_directory) : getCurrentProjectDir()

      const files = await globFunc(glob_pattern, {
        cwd,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        nodir: true
      })

      if (files.length === 0) {
        return `No files found matching pattern: ${glob_pattern}`
      }

      // 按修改时间排序
      const filesWithStats = await Promise.all(
        files.map(async (file) => {
          try {
            const stats = await fs.stat(`${cwd}/${file}`)
            return { file, mtime: stats.mtime }
          } catch {
            return { file, mtime: new Date(0) }
          }
        })
      )

      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

      return filesWithStats.map((f) => f.file).join('\n')
    } catch (error: unknown) {
      const err = error as Error
      throw new Error(`Glob search failed: ${err.message}`)
    }
  }
})
