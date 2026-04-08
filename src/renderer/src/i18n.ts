import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../../../locales/en/translation.json'
import zh from '../../../locales/zh/translation.json'

const isDev = import.meta.env.DEV

async function getInitialLanguage(): Promise<string> {
  try {
    const config = await window.api.config.get()
    if (config?.language) {
      return config.language === 'zh-CN' ? 'zh' : 'en'
    }

    const systemLocale = await window.api.getSystemLocale()
    return systemLocale.startsWith('zh') ? 'zh' : 'en'
  } catch (error) {
    console.error('Failed to get initial language:', error)
    return ''
  }
}

export async function initI18n() {
  const initialLanguage = await getInitialLanguage()

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      zh: { translation: zh }
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: ['zh', 'en'],
    ns: ['translation'],
    defaultNS: 'translation',
    debug: isDev,
    interpolation: {
      escapeValue: false
    },
    returnNull: false,
    returnEmptyString: false,
    initImmediate: false,
    react: {
      useSuspense: true
    }
  })

  return i18n
}

export default i18n
