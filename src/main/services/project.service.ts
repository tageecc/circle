/**
 * Project Service
 *
 * 管理项目标识符和元数据
 *
 * 职责:
 * 1. 生成项目唯一标识符(跨设备/本地)
 * 2. 项目元数据管理
 */

import { GitService } from './git.service'
import { GitUtils } from './git.utils'

export class ProjectService {
  /**
   * 生成项目唯一标识符
   *
   * 策略:
   * 1. 优先:使用 Git 远程 URL(跨设备唯一)
   * 2. 降级:项目名称 + 设备 ID(本地唯一)
   */
  static async getProjectIdentifier(projectPath: string, deviceId: string): Promise<string> {
    // 尝试获取 Git 远程 URL
    const gitUrl = await GitService.getRemoteUrl(projectPath)
    if (gitUrl) {
      const normalizedUrl = GitUtils.normalizeGitUrl(gitUrl)
      return `git:${normalizedUrl}`
    }

    // 降级:本地项目标识符(项目名称 + 设备 ID 前缀)
    const projectName = projectPath.split('/').pop() || 'unknown'
    const devicePrefix = deviceId.substring(0, 8)
    return `local:${projectName}:${devicePrefix}`
  }

  /**
   * 检查是否为 Git 项目
   */
  static async isGitProject(projectPath: string): Promise<boolean> {
    return await GitService.isGitRepository(projectPath)
  }

  /**
   * 获取项目名称
   */
  static getProjectName(projectPath: string): string {
    return projectPath.split('/').pop() || 'unknown'
  }
}
