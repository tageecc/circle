/**
 * SkillsMP 市场服务
 * 后端服务，负责请求 SkillsMP API
 */

import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { SkillMarketItem } from '../types/skills-market'

const SKILLS_MARKET_API_V1_BASE = 'https://skillsmp.com/api/v1'
// API Key 从环境变量读取，生产环境应配置在 .env 文件
const API_KEY = process.env.SKILLSMP_API_KEY

// 检查 API Key 是否配置
if (!API_KEY) {
  console.warn('[SkillsMarket] SKILLSMP_API_KEY not configured, market features may be limited')
}

// 缓存配置
const CACHE_DIR = path.join(app.getPath('userData'), 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'skills-market.json')
const CACHE_DURATION = 60 * 60 * 1000 // 1 小时

interface CacheData {
  data: SkillMarketItem[]
  timestamp: number
  query: string
}

interface ContentCacheItem {
  content: string
  timestamp: number
}

export class SkillsMarketService {
  private static instance: SkillsMarketService
  private contentCache: Map<string, ContentCacheItem> = new Map()

  private constructor() {
    this.ensureCacheDir()
  }

  static getInstance(): SkillsMarketService {
    if (!SkillsMarketService.instance) {
      SkillsMarketService.instance = new SkillsMarketService()
    }
    return SkillsMarketService.instance
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(CACHE_DIR)
    } catch {
      await fs.mkdir(CACHE_DIR, { recursive: true })
    }
  }

  /**
   * 获取缓存数据
   */
  private async getCache(query: string): Promise<SkillMarketItem[] | null> {
    try {
      const cacheStr = await fs.readFile(CACHE_FILE, 'utf-8')
      const cache: CacheData = JSON.parse(cacheStr)
      const now = Date.now()

      // 检查缓存是否过期或查询不匹配
      if (now - cache.timestamp > CACHE_DURATION || cache.query !== query) {
        return null
      }

      console.log('[SkillsMarket] Using cached data')
      return cache.data
    } catch {
      return null
    }
  }

  /**
   * 设置缓存数据
   */
  private async setCache(query: string, data: SkillMarketItem[]): Promise<void> {
    try {
      const cache: CacheData = {
        data,
        timestamp: Date.now(),
        query
      }
      await fs.writeFile(CACHE_FILE, JSON.stringify(cache), 'utf-8')
      console.log('[SkillsMarket] Cache updated')
    } catch (error) {
      console.error('[SkillsMarket] Cache write error:', error)
    }
  }

  /**
   * 搜索技能
   */
  async searchSkills(params: {
    q: string
    page?: number
    limit?: number
  }): Promise<{
    success: boolean
    data: SkillMarketItem[]
    total: number
    page: number
    limit: number
  }> {
    const { q, page = 1, limit = 20 } = params

    // 检查 API Key
    if (!API_KEY) {
      console.error('[SkillsMarket] Cannot search: API key not configured')
      return {
        success: false,
        data: [],
        total: 0,
        page: 1,
        limit
      }
    }

    // 检查缓存（仅首页）
    if (page === 1) {
      const cachedData = await this.getCache(q)
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          total: cachedData.length,
          page: 1,
          limit
        }
      }
    }

    // 发起网络请求
    const url = new URL(`${SKILLS_MARKET_API_V1_BASE}/skills/search`)
    url.searchParams.set('q', q)
    url.searchParams.set('page', page.toString())
    url.searchParams.set('limit', limit.toString())

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    })

    if (!response.ok) {
      console.error('[SkillsMarket] API error:', response.status, response.statusText)
      throw new Error(`API request failed: ${response.status}`)
    }

    const result = await response.json()
    console.log('[SkillsMarket] API response:', JSON.stringify(result).slice(0, 200))

    if (!result.success) {
      throw new Error(result.error?.message || 'Search failed')
    }

    // 解析返回数据：{ data: { skills: [...] } }
    const skills: SkillMarketItem[] = Array.isArray(result.data?.skills)
      ? result.data.skills
      : []

    console.log(`[SkillsMarket] Parsed ${skills.length} skills`)

    // 缓存首页数据
    if (page === 1 && skills.length > 0) {
      await this.setCache(q, skills)
    }

    return {
      success: true,
      data: skills,
      total: result.total || skills.length,
      page,
      limit
    }
  }

  /**
   * 预加载市场数据
   */
  async preloadMarketData(): Promise<void> {
    try {
      console.log('[SkillsMarket] Preloading market data...')
      await this.searchSkills({ q: 'skill', limit: 20 })
      console.log('[SkillsMarket] Preload complete')
    } catch (error) {
      console.error('[SkillsMarket] Preload failed:', error)
    }
  }

  /**
   * 获取 GitHub 仓库中的 SKILL.md 文件内容（带缓存）
   */
  async fetchSkillContent(githubUrl: string): Promise<string> {
    // 检查缓存
    const cached = this.contentCache.get(githubUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('[SkillsMarket] Using cached content for:', githubUrl)
      return cached.content
    }

    // 解析 GitHub URL
    // 支持格式: https://github.com/user/repo/tree/branch/path 或 https://github.com/user/repo
    const match = githubUrl.replace(/\.git$/, '').match(
      /github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?(.*)$/
    )

    if (!match) {
      throw new Error('Invalid GitHub URL')
    }

    const [, owner, repo, branch = 'main', pathPart = ''] = match
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${pathPart}/SKILL.md`

    console.log('[SkillsMarket] Fetching SKILL.md from:', rawUrl)

    const response = await fetch(rawUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch SKILL.md: HTTP ${response.status}`)
    }

    const content = await response.text()

    // 保存到缓存
    this.contentCache.set(githubUrl, {
      content,
      timestamp: Date.now()
    })

    return content
  }
}
