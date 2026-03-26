/**
 * 工具函数的通用辅助方法
 */

import * as path from 'path'
import { getConfigService } from '../index'

/**
 * 获取当前项目目录
 * 🔒 安全：所有文件操作必须在项目目录内
 */
export function getCurrentProjectDir(): string {
  const configService = getConfigService()
  const projectPath = configService.getCurrentProject()

  if (!projectPath) {
    throw new Error('No project is currently open. Please open a project first.')
  }

  return projectPath
}

/**
 * 将相对路径解析为绝对路径
 * 🔒 安全：相对路径基于项目目录，不是 process.cwd()
 */
export function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }

  const projectDir = getCurrentProjectDir()
  return path.resolve(projectDir, filePath)
}
