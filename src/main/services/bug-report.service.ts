import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

/**
 * Saves bug reports as local markdown files under userData (no network).
 */
export class BugReportService {
  async submitReport(title: string, description: string) {
    if (!title || title.trim().length < 5 || title.trim().length > 64) {
      throw new Error('标题长度必须在 5-64 个字符之间')
    }
    if (!description || description.trim().length < 20 || description.trim().length > 500) {
      throw new Error('描述长度必须在 20-500 个字符之间')
    }

    const dir = path.join(app.getPath('userData'), 'feedback')
    await fs.mkdir(dir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeTitle = title
      .trim()
      .replace(/[^\w\u4e00-\u9fa5\-]+/g, '_')
      .slice(0, 48)
    const filePath = path.join(dir, `${stamp}_${safeTitle}.md`)

    const body = `---
created: ${new Date().toISOString()}
appVersion: ${app.getVersion()}
platform: ${process.platform}
arch: ${process.arch}
---

# ${title.trim()}

${description.trim()}
`
    await fs.writeFile(filePath, body, 'utf-8')
    console.log('[BugReport] Saved:', filePath)

    return {
      success: true,
      message: `反馈已保存到本地：${filePath}`,
      filePath
    }
  }
}
