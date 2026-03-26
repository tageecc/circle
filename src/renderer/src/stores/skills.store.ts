import { create } from 'zustand'

interface SkillsState {
  installedSkills: Map<string, string>
  loadInstalledSkills: (projectPath?: string) => Promise<void>
  isInstalled: (skillName: string) => boolean
  getSkillPath: (skillName: string) => string | null
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  installedSkills: new Map(),

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
  }
}))
