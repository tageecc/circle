/**
 * Agent Skills IPC Handlers
 */

import { ipcMain } from 'electron'
import { SkillsService } from '../services/skills.service'
import { SkillsMarketService } from '../services/skills-market.service'

export function registerSkillsHandlers(): void {
  const skillsService = SkillsService.getInstance()
  const skillsMarketService = SkillsMarketService.getInstance()

  ipcMain.handle('skills:scan', async (_, projectPath?: string) => {
    return await skillsService.scanSkills(projectPath)
  })

  ipcMain.handle('skills:toggle', async (_, skillPath: string, enabled: boolean) => {
    await skillsService.toggleSkill(skillPath, enabled)
    return { success: true }
  })

  ipcMain.handle('skills:delete', async (_, skillPath: string) => {
    await skillsService.deleteSkill(skillPath)
    return { success: true }
  })

  ipcMain.handle(
    'skills:installFromGit',
    async (
      _,
      repoUrl: string,
      skillName: string,
      scope: 'user' | 'project' = 'project',
      projectPath?: string
    ) => {
      await skillsService.installFromGit(repoUrl, skillName, scope, projectPath)
      return { success: true }
    }
  )

  // 市场 API
  ipcMain.handle(
    'skills:search',
    async (_, params: { q: string; page?: number; limit?: number }) => {
      return await skillsMarketService.searchSkills(params)
    }
  )

  ipcMain.handle('skills:fetchContent', async (_, githubUrl: string) => {
    return await skillsMarketService.fetchSkillContent(githubUrl)
  })

  // 应用启动时预加载市场数据
  skillsMarketService.preloadMarketData()

  console.log('[IPC] Skills handlers registered')
}
