import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

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
  
  const Backend = (await import('i18next-electron-fs-backend')).default
  
  await i18n
    // @ts-ignore - i18next-electron-fs-backend type definitions are incomplete
    .use(Backend)
    .use(initReactI18next)
    .init({
      backend: {
        loadPath: isDev ? './locales/{{lng}}/{{ns}}.json' : '../locales/{{lng}}/{{ns}}.json',
        ipcRenderer: window.api.i18nextElectronBackend
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
      react: {
        useSuspense: true
      }
    })

  return i18n
}

export default i18n
