import { ProjectService } from './project.service'
import { FileService } from './file.service'
import { getConfigService } from '../index'
import * as path from 'path'

export interface ProjectContext {
  projectPath: string
  projectName: string
  fileTree: string
  summary: string
}

export class ProjectContextService {
  private static instance: ProjectContextService
  private cachedContext: { context: ProjectContext; timestamp: number } | null = null
  private readonly CACHE_TTL = 30000 // 30秒缓存

  private constructor() {}

  static getInstance(): ProjectContextService {
    if (!ProjectContextService.instance) {
      ProjectContextService.instance = new ProjectContextService()
    }
    return ProjectContextService.instance
  }

  async getProjectContext(): Promise<ProjectContext | null> {
    const now = Date.now()

    if (this.cachedContext && now - this.cachedContext.timestamp < this.CACHE_TTL) {
      return this.cachedContext.context
    }

    const configService = getConfigService()
    const currentProject = ProjectService.getCurrentProject(configService)

    if (!currentProject) {
      this.cachedContext = null
      return null
    }

    const projectName = ProjectService.getProjectName(currentProject)
    const fileTree = await this.generateFileTree(currentProject)
    const summary = await this.generateProjectSummary(currentProject)

    const context: ProjectContext = {
      projectPath: currentProject,
      projectName,
      fileTree,
      summary
    }

    this.cachedContext = { context, timestamp: now }
    return context
  }

  invalidateCache(): void {
    this.cachedContext = null
  }

  private async generateFileTree(projectPath: string, maxDepth: number = 3): Promise<string> {
    const ignorePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'out',
      '.next',
      'coverage',
      '.DS_Store',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      '.vscode',
      '.idea',
      '__pycache__',
      '.pytest_cache',
      '.mypy_cache',
      'venv',
      '.env'
    ]

    const buildTree = async (
      dir: string,
      prefix: string = '',
      depth: number = 0
    ): Promise<string[]> => {
      if (depth > maxDepth) return []

      try {
        const items = await FileService.listDirectory(dir)
        const filtered = items
          .filter((item) => !ignorePatterns.includes(item.name))
          .sort((a, b) => {
            // 目录在前，文件在后
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1
            }
            return a.name.localeCompare(b.name)
          })

        const lines: string[] = []

        for (let i = 0; i < filtered.length && i < 100; i++) {
          const item = filtered[i]
          const isLast = i === filtered.length - 1
          const connector = isLast ? '└── ' : '├── '
          const newPrefix = prefix + (isLast ? '    ' : '│   ')

          lines.push(`${prefix}${connector}${item.name}${item.type === 'directory' ? '/' : ''}`)

          if (item.type === 'directory' && depth < maxDepth) {
            const subPath = path.join(dir, item.name)
            const subTree = await buildTree(subPath, newPrefix, depth + 1)
            lines.push(...subTree)
          }
        }

        if (filtered.length > 100) {
          lines.push(`${prefix}... (${filtered.length - 100} more items)`)
        }

        return lines
      } catch {
        return []
      }
    }

    const tree = await buildTree(projectPath)
    return tree.length > 0 ? tree.join('\n') : '(empty project)'
  }

  private async generateProjectSummary(projectPath: string): Promise<string> {
    const summaryParts: string[] = []

    const packageJsonPath = path.join(projectPath, 'package.json')
    const requirementsTxtPath = path.join(projectPath, 'requirements.txt')
    const cargoTomlPath = path.join(projectPath, 'Cargo.toml')
    const goModPath = path.join(projectPath, 'go.mod')
    const pyprojectTomlPath = path.join(projectPath, 'pyproject.toml')

    try {
      if (await FileService.exists(packageJsonPath)) {
        const content = await FileService.readFile(packageJsonPath)
        const pkg = JSON.parse(content)
        summaryParts.push(`语言: JavaScript/TypeScript`)
        if (pkg.name) summaryParts.push(`包名: ${pkg.name}`)
        if (pkg.version) summaryParts.push(`版本: ${pkg.version}`)
        if (pkg.description) summaryParts.push(`描述: ${pkg.description}`)

        if (pkg.dependencies) {
          const deps = Object.keys(pkg.dependencies).slice(0, 8)
          summaryParts.push(
            `主要依赖: ${deps.join(', ')}${Object.keys(pkg.dependencies).length > 8 ? '...' : ''}`
          )
        }

        const frameworkIndicators = [
          { dep: 'next', name: 'Next.js' },
          { dep: 'react', name: 'React' },
          { dep: 'vue', name: 'Vue' },
          { dep: '@angular/core', name: 'Angular' },
          { dep: 'svelte', name: 'Svelte' },
          { dep: 'electron', name: 'Electron' },
          { dep: 'express', name: 'Express' },
          { dep: 'nestjs', name: 'NestJS' }
        ]

        const detectedFrameworks = frameworkIndicators
          .filter(({ dep }) => pkg.dependencies?.[dep] || pkg.devDependencies?.[dep])
          .map(({ name }) => name)

        if (detectedFrameworks.length > 0) {
          summaryParts.push(`框架: ${detectedFrameworks.join(', ')}`)
        }
      } else if (await FileService.exists(requirementsTxtPath)) {
        summaryParts.push('语言: Python')
        summaryParts.push('包管理: requirements.txt')
      } else if (await FileService.exists(pyprojectTomlPath)) {
        summaryParts.push('语言: Python')
        summaryParts.push('包管理: pyproject.toml (Poetry/PDM)')
      } else if (await FileService.exists(cargoTomlPath)) {
        summaryParts.push('语言: Rust')
        summaryParts.push('包管理: Cargo')
      } else if (await FileService.exists(goModPath)) {
        summaryParts.push('语言: Go')
        summaryParts.push('包管理: Go Modules')
      }

      const configFiles = [
        { file: 'tsconfig.json', info: 'TypeScript 配置' },
        { file: '.eslintrc.js', info: 'ESLint 配置' },
        { file: '.prettierrc', info: 'Prettier 配置' },
        { file: 'vite.config.ts', info: 'Vite 构建工具' },
        { file: 'webpack.config.js', info: 'Webpack 构建工具' },
        { file: 'tailwind.config.js', info: 'Tailwind CSS' }
      ]

      const detectedConfigs: any = []
      for (const { file, info } of configFiles) {
        if (await FileService.exists(path.join(projectPath, file))) {
          detectedConfigs.push(info)
        }
      }

      if (detectedConfigs.length > 0) {
        summaryParts.push(`配置: ${detectedConfigs.join(', ')}`)
      }
    } catch (error) {
      console.error('Failed to generate project summary:', error)
    }

    return summaryParts.length > 0
      ? summaryParts.join('\n')
      : '无法检测项目类型 - 可能是新项目或不支持的项目类型'
  }

  injectProjectContext(baseInstructions: string, context: ProjectContext): string {
    const contextSection = `

## 📁 当前项目上下文

### 项目信息
- **项目名称**: ${context.projectName}
- **项目路径**: \`${context.projectPath}\`

### 项目概况
${context.summary}

### 文件结构预览
\`\`\`
${context.projectPath}/
${context.fileTree}
\`\`\`

### 🎯 重要提示
1. **路径处理**: 所有文件操作都应基于项目根目录 \`${context.projectPath}\`
2. **探索代码**: 在修改代码前，务必使用 \`grep\` 或 \`codebase_search\` 充分了解现有代码
3. **代码风格**: 遵循项目现有的代码风格和架构模式
4. **依赖管理**: 添加新依赖时注意项目使用的包管理器
`

    return baseInstructions + contextSection
  }
}
