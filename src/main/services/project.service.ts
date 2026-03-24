import { getDatabase } from '../database/client'
import { projects, type Project } from '../database/schema.sqlite'
import { eq, and } from 'drizzle-orm'
import * as path from 'path'
import { promises as fs } from 'fs'
import { dialog } from 'electron'
import type { ConfigService } from './config.service'

function getDb() {
  return getDatabase()
}

/**
 * 项目管理服务
 * 负责项目创建、查询、索引状态管理
 */
export class ProjectService {
  private static instance: ProjectService

  private constructor() {}

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService()
    }
    return ProjectService.instance
  }

  // ========== 静态方法：桥接到 ConfigService ==========

  /**
   * 获取当前项目路径（从配置文件）
   */
  static getCurrentProject(configService: ConfigService): string | null | undefined {
    return configService.getCurrentProject()
  }

  /**
   * 设置当前项目路径（保存到配置文件）
   */
  static setCurrentProject(projectPath: string | null, configService: ConfigService): void {
    configService.setCurrentProject(projectPath)
  }

  /**
   * 获取最近项目列表（从配置文件）
   */
  static getRecentProjects(configService: ConfigService) {
    return configService.getRecentProjects()
  }

  /**
   * 添加到最近项目列表（保存到配置文件）
   */
  static async addRecentProject(projectPath: string, configService: ConfigService): Promise<void> {
    const recentProjects = configService.getRecentProjects()

    // 移除已存在的相同路径
    const filtered = recentProjects.filter((p) => p.path !== projectPath)

    // 添加到开头
    const projectName = path.basename(projectPath)
    filtered.unshift({
      path: projectPath,
      name: projectName,
      lastOpened: Date.now().toString()
    })

    // 最多保留 10 个
    const limited = filtered.slice(0, 10)

    // 保存
    configService.setConfig({ recentProjects: limited })
  }

  /**
   * 从项目路径获取项目名称
   */
  static getProjectName(projectPath: string): string {
    return path.basename(projectPath)
  }

  /**
   * 打开项目选择对话框
   */
  static async openProjectDialog(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目文件夹',
      buttonLabel: '选择项目'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  }

  // ========== 实例方法：数据库操作 ==========

  /**
   * 获取或创建项目
   */
  async getOrCreateProject(userId: string, projectPath: string): Promise<Project> {
    // 检查项目是否已存在
    const [existing] = await getDb()
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.path, projectPath)))
      .limit(1)

    if (existing) {
      // 更新最后打开时间
      const [updated] = await getDb()
        .update(projects)
        .set({ lastOpenedAt: new Date().toISOString() })
        .where(eq(projects.id, existing.id))
        .returning()

      return updated
    }

    // 创建新项目
    const projectName = path.basename(projectPath)
    const projectInfo = await this.detectProjectType(projectPath)

    const [project] = await getDb()
      .insert(projects)
      .values({
        userId,
        path: projectPath,
        name: projectName,
        projectType: projectInfo.type,
        framework: projectInfo.framework,
        language: projectInfo.language,
        lastOpenedAt: new Date().toISOString()
      })
      .returning()

    console.log('[ProjectService] Project created:', project.id, projectPath)
    return project
  }

  /**
   * 检测项目类型
   */
  private async detectProjectType(projectPath: string): Promise<{
    type: string | null
    framework: string | null
    language: string | null
  }> {
    try {
      // 检查 package.json
      const packageJsonPath = path.join(projectPath, 'package.json')
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(content)

        // 检测框架
        let framework: string | null = null
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

        if (deps['next']) framework = 'nextjs'
        else if (deps['react']) framework = 'react'
        else if (deps['vue']) framework = 'vue'
        else if (deps['@angular/core']) framework = 'angular'
        else if (deps['svelte']) framework = 'svelte'

        return {
          type: 'nodejs',
          framework,
          language: 'javascript'
        }
      } catch {}

      // 检查 Cargo.toml
      const cargoPath = path.join(projectPath, 'Cargo.toml')
      try {
        await fs.access(cargoPath)
        return { type: 'rust', framework: null, language: 'rust' }
      } catch {}

      // 检查 go.mod
      const goModPath = path.join(projectPath, 'go.mod')
      try {
        await fs.access(goModPath)
        return { type: 'go', framework: null, language: 'go' }
      } catch {}

      // 检查 requirements.txt 或 pyproject.toml
      const requirementsPath = path.join(projectPath, 'requirements.txt')
      const pyprojectPath = path.join(projectPath, 'pyproject.toml')
      try {
        await fs.access(requirementsPath)
        return { type: 'python', framework: null, language: 'python' }
      } catch {}
      try {
        await fs.access(pyprojectPath)
        return { type: 'python', framework: null, language: 'python' }
      } catch {}

      return { type: null, framework: null, language: null }
    } catch (error) {
      console.error('[ProjectService] Error detecting project type:', error)
      return { type: null, framework: null, language: null }
    }
  }

  /**
   * 更新项目索引状态
   */
  async updateIndexStatus(
    projectId: string,
    status: 'idle' | 'indexing' | 'indexed' | 'error',
    indexed: boolean = false
  ): Promise<void> {
    await getDb()
      .update(projects)
      .set({
        indexStatus: status,
        isIndexed: indexed ? 1 : 0,
        lastIndexedAt: indexed ? new Date().toISOString() : undefined
      })
      .where(eq(projects.id, projectId))

    console.log('[ProjectService] Project index status updated:', projectId, status)
  }

  /**
   * 获取用户的所有项目
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    const userProjects = await getDb()
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.lastOpenedAt)

    return userProjects
  }

  /**
   * 通过路径获取项目
   */
  async getProjectByPath(userId: string, projectPath: string): Promise<Project | null> {
    const [project] = await getDb()
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.path, projectPath)))
      .limit(1)

    return project || null
  }
}
