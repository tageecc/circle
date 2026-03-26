/**
 * Skills 服务
 * 文件系统为真相源，数据库仅存启用状态
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import matter from 'gray-matter'
import { getDb } from '../database/db'
import { skillPreferences } from '../database/schema'
import { eq, inArray } from 'drizzle-orm'
import type { SkillDefinition, SkillMetadata, SkillScope, SkillScanResult, FailedSkill } from '../types/skills'
import { ConfigService } from './config.service'
import { DEFAULT_SKILL_SCAN_DIRECTORIES } from '../constants/skills.constants'

export class SkillsService {
  private static instance: SkillsService
  private configService: ConfigService

  private constructor() {
    this.configService = new ConfigService()
  }

  static getInstance(): SkillsService {
    if (!SkillsService.instance) {
      SkillsService.instance = new SkillsService()
    }
    return SkillsService.instance
  }

  async scanSkills(projectPath?: string): Promise<SkillScanResult> {
    const skills: SkillDefinition[] = []
    const failedSkills: FailedSkill[] = []
    const config = this.configService.getSkillsSettings()
    const scanDirs = config?.scanDirectories || [...DEFAULT_SKILL_SCAN_DIRECTORIES]

    // 1. 用户级技能（全局）
    for (const dir of scanDirs) {
      const userDir = path.join(os.homedir(), dir, 'skills')
      const { skills: userSkills, failedSkills: userFailedSkills } = await this.scanDir(userDir, 'user')
      skills.push(...userSkills)
      failedSkills.push(...userFailedSkills)
    }

    // 2. 项目级技能（优先级更高，后扫描）
    if (projectPath) {
      for (const dir of scanDirs) {
        const projectDir = path.join(projectPath, dir, 'skills')
        const { skills: projectSkills, failedSkills: projectFailedSkills } = await this.scanDir(projectDir, 'project')
        skills.push(...projectSkills)
        failedSkills.push(...projectFailedSkills)
      }
    }

    // 去重：保留最后遇到的（即项目级优先）
    // 注意：成功和失败的 skills 需要一起去重，因为同名 skill 可能在不同 scope 有不同状态
    const { deduplicatedSkills, deduplicatedFailedSkills } = this.deduplicateAll(skills, failedSkills)
    
    await this.loadEnabledStates(deduplicatedSkills)
    await this.cleanOrphans(deduplicatedSkills.map((s) => s.skillPath))

    return {
      skills: deduplicatedSkills,
      failedSkills: deduplicatedFailedSkills
    }
  }

  private async scanDir(dirPath: string, scope: SkillScope): Promise<{ skills: SkillDefinition[], failedSkills: FailedSkill[] }> {
    const skills: SkillDefinition[] = []
    const failedSkills: FailedSkill[] = []

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillPath = path.join(dirPath, entry.name)
        const result = await this.parseSkill(skillPath, scope)
        
        if (result.success) {
          skills.push(result.skill)
        } else if (result.error) {
          // error 为 null 表示文件不存在，跳过；否则记录为失败
          failedSkills.push(result.error)
        }
      }
    } catch (error) {
      // 目录不存在是正常的，不需要记录错误
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[Skills] Failed to scan directory ${dirPath}:`, error)
      }
    }

    return { skills, failedSkills }
  }

  private async parseSkill(
    skillPath: string,
    scope: SkillScope
  ): Promise<{ success: true; skill: SkillDefinition } | { success: false; error: FailedSkill | null }> {
    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md')
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const { data, content: instructions } = matter(content)

      if (!data.name || !data.description) {
        console.warn(`[Skills] Invalid skill metadata in ${skillPath}: missing name or description`)
        return {
          success: false,
          error: {
            skillPath,
            scope,
            error: 'Invalid skill metadata',
            errorDetails: 'Missing required fields: name or description'
          }
        }
      }

      return {
        success: true,
        skill: {
          metadata: data as SkillMetadata,
          instructions,
          skillPath,
          scope
        }
      }
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code
      
      // SKILL.md 不存在是正常的（可能是其他文件夹），返回 null 表示跳过
      if (errorCode === 'ENOENT') {
        return { success: false, error: null }
      }

      // 其他错误（如 YAML 解析错误）记录为失败的 skill
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : 'Error'
      
      console.error(`[Skills] Failed to parse skill at ${skillPath}:`, error)
      
      return {
        success: false,
        error: {
          skillPath,
          scope,
          error: errorName === 'YAMLException' ? 'YAML syntax error' : 'Parse error',
          errorDetails: errorMessage
        }
      }
    }
  }

  private async loadEnabledStates(skills: SkillDefinition[]): Promise<void> {
    const db = getDb().getDb()
    const prefs = await db.select().from(skillPreferences).all()
    const prefsMap = new Map(prefs.map((p) => [p.skillPath, p.enabled]))

    for (const skill of skills) {
      skill.enabled = prefsMap.get(skill.skillPath) ?? true
    }
  }

  private async cleanOrphans(validPaths: string[]): Promise<void> {
    const db = getDb().getDb()
    const allPrefs = await db.select().from(skillPreferences).all()
    const validSet = new Set(validPaths)

    const orphanPaths = allPrefs
      .filter((pref) => !validSet.has(pref.skillPath))
      .map((pref) => pref.skillPath)

    if (orphanPaths.length > 0) {
      console.log(`[Skills] Cleaning ${orphanPaths.length} orphaned records`)
      await db.delete(skillPreferences).where(inArray(skillPreferences.skillPath, orphanPaths))
    }
  }

  async getEnabledSkillsMetadata(projectPath?: string) {
    const { skills } = await this.scanSkills(projectPath)
    return skills.filter((s) => s.enabled).map((s) => s.metadata)
  }

  async getSkillByName(skillName: string, projectPath?: string): Promise<SkillDefinition | null> {
    const { skills } = await this.scanSkills(projectPath)
    return skills.find((s) => s.enabled && s.metadata.name === skillName) || null
  }

  async toggleSkill(skillPath: string, enabled: boolean): Promise<void> {
    console.log(`[Skills] Toggle skill: ${skillPath} -> ${enabled}`)
    const db = getDb().getDb()

    await db
      .insert(skillPreferences)
      .values({ skillPath, enabled })
      .onConflictDoUpdate({
        target: skillPreferences.skillPath,
        set: { enabled }
      })
  }

  async deleteSkill(skillPath: string): Promise<void> {
    console.log(`[Skills] Deleting skill: ${skillPath}`)
    await fs.rm(skillPath, { recursive: true, force: true })

    const db = getDb().getDb()
    await db.delete(skillPreferences).where(eq(skillPreferences.skillPath, skillPath))
  }

  private deduplicateAll(
    skills: SkillDefinition[],
    failedSkills: FailedSkill[]
  ): { deduplicatedSkills: SkillDefinition[]; deduplicatedFailedSkills: FailedSkill[] } {
    // 按 skill 名称去重（从路径提取）
    // 规则：项目级优先于用户级，无论成功或失败
    const seenNames = new Map<string, { type: 'success' | 'failed'; data: SkillDefinition | FailedSkill }>()

    // 先处理用户级（全局）
    for (const skill of skills.filter(s => s.scope === 'user')) {
      seenNames.set(skill.metadata.name, { type: 'success', data: skill })
    }
    for (const failedSkill of failedSkills.filter(s => s.scope === 'user')) {
      const skillName = failedSkill.skillPath.split('/').pop() || failedSkill.skillPath
      if (!seenNames.has(skillName)) {
        seenNames.set(skillName, { type: 'failed', data: failedSkill })
      }
    }

    // 再处理项目级（覆盖用户级）
    for (const skill of skills.filter(s => s.scope === 'project')) {
      seenNames.set(skill.metadata.name, { type: 'success', data: skill })
    }
    for (const failedSkill of failedSkills.filter(s => s.scope === 'project')) {
      const skillName = failedSkill.skillPath.split('/').pop() || failedSkill.skillPath
      seenNames.set(skillName, { type: 'failed', data: failedSkill })
    }

    // 分离成功和失败的
    const deduplicatedSkills: SkillDefinition[] = []
    const deduplicatedFailedSkills: FailedSkill[] = []

    for (const { type, data } of seenNames.values()) {
      if (type === 'success') {
        deduplicatedSkills.push(data as SkillDefinition)
      } else {
        deduplicatedFailedSkills.push(data as FailedSkill)
      }
    }

    return { deduplicatedSkills, deduplicatedFailedSkills }
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

}
