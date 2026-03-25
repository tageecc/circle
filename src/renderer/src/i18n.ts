import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './locales/en'
import zhCNTranslation from './locales/zh-CN'

export const defaultNS = 'common'
export const resources = {
  en: enTranslation,
  'zh-CN': zhCNTranslation
} as const

// 获取系统语言
export function getSystemLanguage(): string {
  const systemLang = navigator.language
  // 支持的语言列表
  const supportedLanguages = ['en', 'zh-CN']

  // 精确匹配
  if (supportedLanguages.includes(systemLang)) {
    return systemLang
  }

  // 语言代码匹配（如 zh-TW -> zh-CN）
  const langCode = systemLang.split('-')[0]
  if (langCode === 'zh') {
    return 'zh-CN'
  }

  // 默认英文
  return 'en'
}

// 初始化函数，支持从配置加载语言
async function initializeI18n() {
  let savedLanguage = getSystemLanguage()

  try {
    // 尝试从配置服务获取保存的语言
    const config = await window.api.config.get()
    if (config.language) {
      savedLanguage = config.language
    }
  } catch (error) {
    console.warn('Failed to load language from config, using system language:', error)
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    defaultNS,
    ns: [
      'common',
      'project',
      'git',
      'settings',
      'chat',
      'editor',
      'terminal',
      'dialogs',
      'tools',
      'agent'
    ],
    interpolation: {
      escapeValue: false // React 已经处理了 XSS
    },
    react: {
      useSuspense: true
    }
  })
}

// 立即初始化
initializeI18n()

export default i18n
