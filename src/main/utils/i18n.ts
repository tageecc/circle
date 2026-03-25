import enTranslations from '../locales/en.json'
import zhCNTranslations from '../locales/zh-CN.json'
import { detectSystemLanguage } from './detect-language'

type Translations = typeof enTranslations
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

type TranslationKey = NestedKeyOf<Translations>

const translations: Record<string, Translations> = {
  en: enTranslations,
  'zh-CN': zhCNTranslations
}

let currentLanguage: string = 'en'

/**
 * 初始化主进程 i18n
 * 应该在应用启动时调用
 */
export function initMainI18n(language?: string): void {
  if (language) {
    currentLanguage = language
  } else {
    currentLanguage = detectSystemLanguage()
  }
}

/**
 * 设置当前语言
 */
export function setLanguage(language: string): void {
  if (translations[language]) {
    currentLanguage = language
  }
}

/**
 * 获取当前语言
 */
export function getLanguage(): string {
  return currentLanguage
}

/**
 * 获取翻译文本
 * @param key - 翻译 key，支持嵌套路径如 'menu.file.open'
 * @param variables - 可选的变量替换对象
 */
export function t(key: TranslationKey, variables?: Record<string, string | number>): string {
  const keys = key.split('.')
  let value: any = translations[currentLanguage]

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      // Fallback to English
      value = translations['en']
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey]
        } else {
          return key // Return key if not found
        }
      }
      break
    }
  }

  if (typeof value !== 'string') {
    return key
  }

  // Replace variables if provided
  if (variables) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return variables[varName]?.toString() ?? `{{${varName}}}`
    })
  }

  return value
}

/**
 * 获取所有支持的语言
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(translations)
}
