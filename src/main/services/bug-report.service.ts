import { app } from 'electron'
import { UserService } from './user.service'
import { MachineIdService } from './machine-id.service'

/**
 * Bug 反馈服务
 * 直接提交到 GitHub Issues，无需数据库存储
 */
export class BugReportService {
  private userService: UserService
  private machineIdService: MachineIdService

  constructor() {
    this.userService = UserService.getInstance()
    this.machineIdService = MachineIdService.getInstance()
  }

  /**
   * 提交 Bug 报告
   */
  async submitReport(title: string, description: string) {
    if (!title || title.trim().length < 5 || title.trim().length > 64) {
      throw new Error('标题长度必须在 5-64 个字符之间')
    }
    if (!description || description.trim().length < 20 || description.trim().length > 500) {
      throw new Error('描述长度必须在 20-500 个字符之间')
    }

    const currentUser = this.userService.getCurrentUser()
    if (!currentUser) {
      throw new Error('用户未登录')
    }

    const deviceId = this.machineIdService.getMachineId()
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      appVersion: app.getVersion()
    }

    const issueBody = `
## 问题描述

${description.trim()}

---

## 系统信息

- **平台**: ${systemInfo.platform}
- **架构**: ${systemInfo.arch}
- **Node版本**: ${systemInfo.version}
- **应用版本**: ${systemInfo.appVersion}
- **设备ID**: ${deviceId}
- **用户**: ${currentUser.displayName} (${currentUser.username})

---

> 此问题由 Circle 应用自动提交
    `.trim()

    const githubRepo = process.env.GITHUB_REPO || 'your-org/circle'
    const githubToken = process.env.GITHUB_TOKEN

    if (!githubToken) {
      console.warn('[BugReport] GitHub Token not configured, skipping GitHub Issues creation')
      console.log('[BugReport] Bug report:', { title, body: issueBody })
      return {
        success: false,
        message: '反馈已记录，但未配置 GitHub Token，无法自动创建 Issue'
      }
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `[Bug] ${title.trim()}`,
          body: issueBody,
          labels: ['bug', 'user-report']
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`GitHub API error: ${response.status} ${error}`)
      }

      const issue = await response.json()
      console.log('[BugReport] ✅ Created GitHub Issue:', issue.html_url)

      return {
        success: true,
        message: '反馈已成功提交到 GitHub Issues',
        issueUrl: issue.html_url,
        issueNumber: issue.number
      }
    } catch (error) {
      console.error('[BugReport] Failed to create GitHub Issue:', error)
      return {
        success: false,
        message: '提交失败，请稍后重试或直接访问 GitHub 提交 Issue',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
