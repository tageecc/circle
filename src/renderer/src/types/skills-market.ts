/**
 * SkillsMP 市场相关类型定义（渲染进程）
 */

export interface SkillMarketItem {
  id: string
  name: string
  description: string
  author?: string
  githubUrl?: string
  skillUrl?: string
  stars?: number
  updatedAt?: number
  [key: string]: unknown
}

export interface SkillSearchResponse {
  success: boolean
  data: SkillMarketItem[]
  total: number
  page: number
  limit: number
}
