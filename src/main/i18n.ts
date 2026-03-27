import i18next from 'i18next'
import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { ConfigService } from './services/config.service'

function resolveLocalesRoot(): string {
  try {
    const fromApp = join(app.getAppPath(), 'locales')
    if (existsSync(fromApp)) {
      return fromApp
    }
  } catch {
    // app.getAppPath may throw before ready in edge cases
  }
  const devPath = join(__dirname, '../../locales')
  if (existsSync(devPath)) {
    return devPath
  }
  return join(__dirname, '../locales')
}

function loadTranslation(lang: 'en' | 'zh'): Record<string, unknown> {
  const file = join(resolveLocalesRoot(), lang, 'translation.json')
  const raw = readFileSync(file, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

function mapConfigLanguageToI18n(
  configLanguage: string | undefined,
  systemLocale: string
): 'en' | 'zh' {
  if (configLanguage === 'zh-CN' || configLanguage === 'zh') {
    return 'zh'
  }
  if (configLanguage === 'en' || configLanguage === 'en-US') {
    return 'en'
  }
  if (configLanguage && configLanguage.toLowerCase().startsWith('zh')) {
    return 'zh'
  }
  if (configLanguage) {
    return 'en'
  }
  const loc = systemLocale.toLowerCase()
  return loc.startsWith('zh') ? 'zh' : 'en'
}

function resolveLanguage(configService: ConfigService): 'en' | 'zh' {
  const cfg = configService.getConfig()
  return mapConfigLanguageToI18n(cfg.language, app.getLocale())
}

/** Dedicated main-process i18n instance (renderer uses its own). */
export const mainI18n = i18next.createInstance()

export async function initMainI18n(configService: ConfigService): Promise<void> {
  const lng = resolveLanguage(configService)
  const en = loadTranslation('en')
  const zh = loadTranslation('zh')

  if (!mainI18n.isInitialized) {
    await mainI18n.init({
      lng,
      fallbackLng: 'en',
      supportedLngs: ['en', 'zh'],
      resources: {
        en: { translation: en },
        zh: { translation: zh }
      },
      interpolation: { escapeValue: false },
      returnNull: false,
      returnEmptyString: false
    })
  } else {
    await mainI18n.changeLanguage(lng)
  }
}

export async function syncMainI18nFromConfig(configService: ConfigService): Promise<void> {
  const lng = resolveLanguage(configService)
  await mainI18n.changeLanguage(lng)
}

export const i18n = mainI18n
