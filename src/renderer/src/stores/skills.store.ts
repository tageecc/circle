import { create } from 'zustand'
import type { SkillMarketItem } from '@/types/skills-market'

interface SkillsMarketCache {
  skills: SkillMarketItem[]
  total: number
  lastQuery: string
  isLoading: boolean
  isLoaded: boolean
}

interface SkillsState {
  /**
   * 已安装的 Skills（从本地扫描获取）
   * Map<skillName, skillPath>
   */
  installedSkills: Map<string, string>

  /**
   * 当前激活的 tab
   */
  activeTab: 'marketplace' | 'installed'

  /**
   * 市场数据缓存
   */
  marketCache: SkillsMarketCache

  /**
   * 加载已安装的 skills 列表
   */
  loadInstalledSkills: (projectPath?: string) => Promise<void>

  /**
   * 检查 skill 是否已安装
   */
  isInstalled: (skillName: string) => boolean

  /**
   * 获取已安装 skill 的路径
   */
  getSkillPath: (skillName: string) => string | null

  /**
   * 设置当前激活的 tab
   */
  setActiveTab: (tab: 'marketplace' | 'installed') => void

  /**
   * 加载市场数据（使用关键字搜索）
   */
  loadMarketData: (options?: { query?: string; reset?: boolean }) => Promise<void>
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  installedSkills: new Map(),
  activeTab: 'marketplace',
  marketCache: {
    skills: [],
    total: 0,
    lastQuery: '',
    isLoading: false,
    isLoaded: false
  },

  loadInstalledSkills: async (projectPath?: string) => {
    try {
      const result = await window.api.skills.scan(projectPath)
      const map = new Map<string, string>()
      const skills = result?.skills || []
      skills.forEach((skill) => {
        map.set(skill.metadata.name, skill.skillPath)
      })
      set({ installedSkills: map })
    } catch (error) {
      console.error('[SkillsStore] Failed to load installed skills:', error)
    }
  },

  isInstalled: (skillName: string) => {
    return get().installedSkills.has(skillName)
  },

  getSkillPath: (skillName: string) => {
    return get().installedSkills.get(skillName) || null
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab })
  },

  loadMarketData: async (options = {}) => {
    const { query = 'skill', reset = false } = options
    const { marketCache } = get()

    // 判断是否需要重置
    const shouldReset = reset || query !== marketCache.lastQuery

    if (shouldReset) {
      set({
        marketCache: {
          skills: [],
          total: 0,
          lastQuery: query,
          isLoading: true,
          isLoaded: false
        }
      })
    } else {
      set({
        marketCache: {
          ...marketCache,
          isLoading: true
        }
      })
    }

    try {
      const response = await window.api.skills.search({
        q: query,
        limit: 50 // 一次加载更多
      })

      // 确保 data 是数组
      const skills = Array.isArray(response.data) ? response.data : []

      set({
        marketCache: {
          skills,
          total: response.total || 0,
          lastQuery: query,
          isLoading: false,
          isLoaded: true
        }
      })
    } catch (error) {
      console.error('[SkillsStore] Failed to load market data:', error)
      set({
        marketCache: {
          skills: [], // 错误时确保是空数组
          total: 0,
          lastQuery: query,
          isLoading: false,
          isLoaded: false
        }
      })
      throw error
    }
  }
}))
