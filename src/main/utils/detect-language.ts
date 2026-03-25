import { app } from 'electron'

/**
 * 检测系统默认语言
 * 返回支持的语言代码：'en' 或 'zh-CN'
 */
export function detectSystemLanguage(): string {
  try {
    // Electron 的 app.getLocale() 返回系统语言
    const systemLocale = app.getLocale()

    // 支持的语言列表
    const supportedLanguages = ['en', 'zh-CN']

    // 精确匹配
    if (supportedLanguages.includes(systemLocale)) {
      return systemLocale
    }

    // 语言代码匹配（如 zh-TW, zh-HK -> zh-CN）
    const langCode = systemLocale.split('-')[0]
    if (langCode === 'zh') {
      return 'zh-CN'
    }

    // 默认英文
    return 'en'
  } catch (error) {
    console.warn('Failed to detect system language:', error)
    return 'en'
  }
}
