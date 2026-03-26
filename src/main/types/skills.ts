/**
 * Agent Skills 类型定义
 */

export interface SkillMetadata {
  name: string
  description: string
  version?: string
  tags?: string[]
  compatibility?: string
  author?: string
  homepage?: string
  [key: string]: unknown
}

export interface SkillDefinition {
  metadata: SkillMetadata
  instructions: string
  skillPath: string
  enabled?: boolean
  scope?: SkillScope
}

export type SkillScope = 'user' | 'project'

/**
 * 解析失败的 Skill
 */
export interface FailedSkill {
  skillPath: string
  scope: SkillScope
  error: string
  errorDetails?: string
}

/**
 * 扫描结果
 */
export interface SkillScanResult {
  skills: SkillDefinition[]
  failedSkills: FailedSkill[]
}
