/**
 * Skills IPC handlers
 */

import { ipcMain } from 'electron'
import { SkillsService } from '../services/skills.service'

export function registerSkillsHandlers(): void {
  const skillsService = SkillsService.getInstance()

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

  console.log('[IPC] Skills handlers registered')
}
