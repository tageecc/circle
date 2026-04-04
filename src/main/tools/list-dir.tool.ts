import { defineTool } from './define-tool'
import { z } from 'zod'
import { promises as fs } from 'fs'
import { minimatch } from 'minimatch'
import { resolveFilePath } from './utils'

const inputSchema = z.object({
  target_directory: z
    .string()
    .optional()
    .default('.')
    .describe(
      'Path to directory to list (relative to open project, or absolute). Defaults to workspace root.'
    ),
  ignore_globs: z
    .array(z.string())
    .optional()
    .describe(
      'Optional array of glob patterns to ignore.\nAll patterns match anywhere in the target directory. Patterns not starting with "**/" are automatically prepended with "**/".\n\nExamples:\n\t- "*.js" (becomes "**/*.js") - ignore all .js files\n\t- "**/node_modules/**" - ignore all node_modules directories\n\t- "**/test/**/test_*.ts" - ignore all test_*.ts files in any test directory\n'
    )
})

/**
 * List Directory Tool - Cursor 风格
 */
export const listDirTool = defineTool({
  description: `List files and directories in a given path. Fast directory exploration tool.

### When to Use This Tool

Use list_dir when you need to:
- Explore directory structure (see what files/folders exist)
- Check what's inside a specific folder before reading files
- Understand project organization
- Find which subdirectories exist
- Quickly scan a directory's contents

### When NOT to Use

Skip list_dir for:
- **Finding files by name pattern** → use \`glob_file_search\` (faster for patterns)
- **Searching for text in files** → use \`grep\` or \`codebase_search\`
- **Reading file contents** → use \`read_file\`
- **Deep recursive search** → use \`glob_file_search\` with patterns

### Output Format

Results show type prefix + name:
\`\`\`
d components    (directory)
d utils         (directory)
f App.tsx       (file)
f index.ts      (file)
\`\`\`

- \`d\` = directory
- \`f\` = file
- Hidden files (starting with \`.\`) are automatically filtered out

### Exploration Strategy

**Top-down exploration**:
1. Start with root: \`list_dir(".")\`
2. Identify interesting directories
3. Drill down: \`list_dir("src/components")\`
4. Read specific files when found

**Parallel exploration**:
Call list_dir on multiple directories simultaneously when independent:
\`\`\`typescript
// Good: Parallel calls
list_dir("src/components")
list_dir("src/utils")
list_dir("src/services")
\`\`\`

### Examples

<example>
  Scenario: User says "show me the project structure"
  Approach: list_dir(".") then explore subdirectories
  <reasoning>
    Good: Start broad, then drill down into interesting folders
  </reasoning>
</example>

<example>
  Scenario: Need to find all component files
  Tool: glob_file_search (NOT list_dir)
  Pattern: "**/*.tsx"
  <reasoning>
    Bad for list_dir: Need recursive search, glob is better
  </reasoning>
</example>

<example>
  Scenario: Check what's in the utils folder
  Action: list_dir("src/utils")
  <reasoning>
    Good: Quick directory scan to see available utilities
  </reasoning>
</example>

### Features

- **Fast**: Only scans single directory level (not recursive)
- **Clean output**: Hides dot-files/folders automatically
- **Flexible paths**: Accepts absolute or relative paths
- **Optional filtering**: Use ignore_globs to exclude patterns

### Parameters

- **target_directory** (optional, defaults to dot = project-relative root): Path to list; relative to open project or absolute
- **ignore_globs** (optional): Patterns to exclude (e.g., ["*.test.ts", "**/__tests__/**"])

### Important Notes
- Does NOT recurse into subdirectories (single level only)
- Hidden files (.*) and folders are automatically excluded
- Returns "(empty directory)" if folder has no visible contents
- Use glob_file_search for deep recursive searches`,
  inputSchema,
  execute: async ({ target_directory, ignore_globs }) => {
    try {
      const absolutePath = resolveFilePath(target_directory)

      const entries = await fs.readdir(absolutePath, { withFileTypes: true })
      // 过滤 dot-files 和 dot-directories
      const filtered = entries.filter((entry) => {
        if (entry.name.startsWith('.')) return false
        if (!ignore_globs?.length) return true
        const name = entry.name
        return !ignore_globs.some((raw) => {
          const pattern = raw.startsWith('**/') ? raw : `**/${raw}`
          return minimatch(name, pattern) || minimatch(`**/${name}`, pattern)
        })
      })

      // 格式化输出：目录用 d，文件用 f
      const formatted = filtered
        .map((entry) => {
          const type = entry.isDirectory() ? 'd' : 'f'
          return `${type} ${entry.name}`
        })
        .join('\n')

      return formatted || '(empty directory)'
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        throw new Error(`Directory not found: ${target_directory}`)
      }
      throw new Error(`Failed to list directory: ${err.message}`)
    }
  }
})
