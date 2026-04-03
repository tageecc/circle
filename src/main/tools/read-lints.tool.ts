import { defineTool } from './define-tool'
import { z } from 'zod'
import { DiagnosticsService } from '../services/diagnostics.service'
import * as path from 'path'
import * as fs from 'fs/promises'

const inputSchema = z.object({
  paths: z
    .array(z.string())
    .optional()
    .describe('Optional array of paths to files or directories to read linter errors for')
})

interface DiagnosticItem {
  line: number
  column: number
  severity: string
  message: string
  source?: string
  code?: string | number
}

interface DiagnosticResult {
  filePath: string
  diagnostics: DiagnosticItem[]
}

/**
 * 读取 Linter 错误工具
 */
export const readLintsTool = defineTool({
  description: `Read linter errors and warnings from the workspace. Checks TypeScript, JavaScript, YAML, and Markdown files.

### When to Use This Tool

Use read_lints when you need to:
- **After editing files**: Check if your changes introduced errors
- **Before committing**: Verify code quality
- **Debugging issues**: See if linter catches the problem
- **Reviewing specific files**: Check errors in files you're working on

### When NOT to Use

Avoid read_lints for:
- **Files you haven't edited** → wastes time, may show pre-existing errors
- **Entire workspace scan** → very slow, overwhelming output
- **Exploratory browsing** → only use when actively fixing code
- **Before making any edits** → unnecessary, check after editing

### Critical Rules

⚠️ **ONLY call this tool on files you've edited or are about to edit**

Why:
- Returns errors that existed BEFORE your changes
- Checking unchanged files creates noise
- Can be slow for large directories
- Confuses which errors are yours vs pre-existing

### Supported File Types

Automatically checks:
- TypeScript: \`.ts\`, \`.tsx\`
- JavaScript: \`.js\`, \`.jsx\`
- YAML: \`.yml\`, \`.yaml\`
- Markdown: \`.md\`, \`.markdown\`

### Output Format

Returns JSON with:
\`\`\`json
{
  "success": true,
  "files": [
    {
      "filePath": "src/utils/helper.ts",
      "diagnostics": [
        {
          "line": 15,
          "column": 10,
          "severity": "error",
          "message": "Type 'string' is not assignable to type 'number'",
          "source": "typescript",
          "code": 2322
        }
      ]
    }
  ],
  "summary": {
    "totalFiles": 1,
    "totalErrors": 1,
    "totalWarnings": 0,
    "totalIssues": 1
  }
}
\`\`\`

### Best Practices

**✅ Good Usage**:
\`\`\`typescript
// After editing a file
edit_file("src/components/Button.tsx", ...)
read_lints(["src/components/Button.tsx"])

// Checking multiple edited files
edit_file("src/utils/helper.ts", ...)
edit_file("src/utils/formatter.ts", ...)
read_lints(["src/utils/helper.ts", "src/utils/formatter.ts"])
\`\`\`

**❌ Bad Usage**:
\`\`\`typescript
// DON'T: Check entire workspace
read_lints()  // Slow, returns all errors

// DON'T: Check unedited files
read_lints(["src/entire/codebase"])  // Noise

// DON'T: Check before editing
read_lints(["file.ts"])  // Premature
edit_file("file.ts", ...)
\`\`\`

### Workflow Integration

**Recommended flow**:
1. Make your edits with \`edit_file\`
2. Call \`read_lints\` on those specific files
3. If errors found, fix them with another \`edit_file\`
4. Re-check with \`read_lints\` until clean
5. Move to next task

### Examples

<example>
  Scenario: Just edited Button.tsx, want to verify
  Usage: read_lints(["src/components/Button.tsx"])
  <reasoning>
    Good: Checking your own edits, specific file only
  </reasoning>
</example>

<example>
  Scenario: Refactored 3 related files
  Usage: read_lints(["src/utils/a.ts", "src/utils/b.ts", "src/utils/c.ts"])
  <reasoning>
    Good: Checking all files you touched, focused scope
  </reasoning>
</example>

<example>
  Scenario: User reports error, haven't looked at code yet
  Action: read_file first, DON'T read_lints yet
  <reasoning>
    Bad: Should understand code before checking lints
  </reasoning>
</example>

<example>
  Scenario: General code review request
  Usage: read_lints() with no paths
  <reasoning>
    Bad: Too broad, will return all workspace errors
  </reasoning>
</example>

### Performance Notes

- Single file check: ~100ms
- Directory with 10 files: ~500ms
- Entire workspace: 5-30 seconds (DON'T DO THIS)

### Auto-Ignore

Skips these directories:
- \`node_modules\`
- \`.git\`
- \`dist\`
- \`build\`

### Error Severity Levels

- **error**: Must fix before commit
- **warning**: Should review but not blocking
- **info**: Suggestions for improvement

### Important Notes
- Always provide specific paths parameter (array of files you edited)
- Empty paths parameter triggers warning - requires explicit file list
- Pre-existing errors may appear - focus on ones from your edits
- Fix errors immediately after detection - don't accumulate technical debt`,
  inputSchema,
  execute: async ({ paths }) => {
    try {
      const diagnosticsService = DiagnosticsService.getInstance()
      const allDiagnostics: DiagnosticResult[] = []

      if (!paths || paths.length === 0) {
        console.warn(
          '[ReadLints] No paths provided - this operation can be slow for large projects'
        )
        return JSON.stringify({
          success: true,
          message: 'Please provide specific file paths to check for linter errors',
          diagnostics: [],
          warning: 'Checking entire workspace is not recommended'
        })
      }

      for (const targetPath of paths) {
        const absolutePath = path.isAbsolute(targetPath)
          ? targetPath
          : path.resolve(process.cwd(), targetPath)

        try {
          const stat = await fs.stat(absolutePath)

          if (stat.isFile()) {
            const diagnostics = await diagnosticsService.getDiagnostics(absolutePath)
            allDiagnostics.push({
              filePath: targetPath,
              diagnostics: diagnostics.map((d) => ({
                line: d.line,
                column: d.column,
                severity: d.severity,
                message: d.message,
                source: d.source,
                code: d.code
              }))
            })
          } else if (stat.isDirectory()) {
            const files = await scanDirectory(absolutePath)
            for (const filePath of files) {
              const diagnostics = await diagnosticsService.getDiagnostics(filePath)
              if (diagnostics.length > 0) {
                allDiagnostics.push({
                  filePath: path.relative(process.cwd(), filePath),
                  diagnostics: diagnostics.map((d) => ({
                    line: d.line,
                    column: d.column,
                    severity: d.severity,
                    message: d.message,
                    source: d.source,
                    code: d.code
                  }))
                })
              }
            }
          }
        } catch (error: unknown) {
          const err = error as Error
          console.error(`[ReadLints] Error processing ${targetPath}:`, err.message)
        }
      }

      const totalErrors = allDiagnostics.reduce(
        (sum, f) => sum + f.diagnostics.filter((d) => d.severity === 'error').length,
        0
      )
      const totalWarnings = allDiagnostics.reduce(
        (sum, f) => sum + f.diagnostics.filter((d) => d.severity === 'warning').length,
        0
      )

      return JSON.stringify({
        success: true,
        files: allDiagnostics,
        summary: {
          totalFiles: allDiagnostics.length,
          totalErrors,
          totalWarnings,
          totalIssues: totalErrors + totalWarnings
        }
      })
    } catch (error: unknown) {
      const err = error as Error
      console.error('[ReadLints] Error:', err)
      return JSON.stringify({
        success: false,
        error: err.message,
        diagnostics: []
      })
    }
  }
})

async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = []
  const supportedExts = ['.ts', '.tsx', '.js', '.jsx', '.yml', '.yaml', '.md', '.markdown']

  const walk = async (currentPath: string) => {
    const items = await fs.readdir(currentPath, { withFileTypes: true })

    for (const item of items) {
      if (
        item.name.startsWith('.') ||
        item.name === 'node_modules' ||
        item.name === 'dist' ||
        item.name === 'build'
      ) {
        continue
      }

      const fullPath = path.join(currentPath, item.name)

      if (item.isDirectory()) {
        await walk(fullPath)
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (supportedExts.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  await walk(dir)
  return files
}
