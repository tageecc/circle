import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
const Backend = require('i18next-electron-fs-backend')

const isDev = import.meta.env.DEV

// Get system locale or use saved language setting
async function getInitialLanguage(): Promise<string> {
  try {
    // Try to get saved language from settings
    const config = await window.api.config.get()
    if (config?.language) {
      return config.language === 'zh-CN' ? 'zh' : 'en'
    }
    
    // Fallback to system locale
    const systemLocale = await window.api.getSystemLocale()
    // Map system locale to supported language (zh-CN, zh-TW, zh-HK → zh, en-US, en-GB → en)
    if (systemLocale.startsWith('zh')) {
      return 'zh'
    }
    return 'en'
  } catch (error) {
    console.error('Failed to get initial language:', error)
    return 'zh' // Fallback to Chinese
  }
}

export async function initI18n() {
  const initialLanguage = await getInitialLanguage()
  
  await i18n
    .use(Backend)
    .use(initReactI18next)
    .init({
      backend: {
        loadPath: isDev
          ? './locales/{{lng}}/{{ns}}.json' // Development: relative to root
          : '../locales/{{lng}}/{{ns}}.json', // Production: relative to renderer
        addPath: isDev
          ? './locales/{{lng}}/{{ns}}.missing.json'
          : '../locales/{{lng}}/{{ns}}.missing.json',
        ipcRenderer: window.api.i18nextElectronBackend
      },
      lng: initialLanguage,
      fallbackLng: 'en',
      supportedLngs: ['zh', 'en'],
      ns: ['translation'],
      defaultNS: 'translation',
      debug: isDev,
      interpolation: {
        escapeValue: false // React already escapes
      },
      react: {
        useSuspense: true
      }
    })

  return i18n
}

export default i18n
