import { useState, useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { SettingsProvider } from './contexts/settings-context'
import { UrlSchemaProvider } from './contexts/url-schema-context'
import { NotificationProvider } from './contexts/notification-context'
import { ConfirmProvider } from './components/features/common/confirm-provider'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'
import { IDEPage } from './pages/ide'

function App(): React.JSX.Element {
  const [activeItem, setActiveItem] = useState('code')
  const [isStateLoaded, setIsStateLoaded] = useState(false)

  // 加载保存的 UI 状态
  useEffect(() => {
    const loadUIState = async (): Promise<void> => {
      try {
        const uiState = await window.api.config.getUIState()
        console.log('📂 Loading UI state:', uiState)

        if (uiState.activeView) {
          setActiveItem(uiState.activeView)
        }

        setIsStateLoaded(true)
      } catch (error) {
        console.error('Failed to load UI state:', error)
        setIsStateLoaded(true)
      }
    }

    loadUIState()
  }, [])

  // 保存主视图状态
  useEffect(() => {
    if (!isStateLoaded) return

    const saveState = async (): Promise<void> => {
      try {
        await window.api.config.updateUIState({
          activeView: activeItem
        })
        console.log('💾 Saved active view:', activeItem)
      } catch (error) {
        console.error('Failed to save active view:', error)
      }
    }

    saveState()
  }, [activeItem, isStateLoaded])

  return (
    <I18nextProvider i18n={i18n}>
      <SettingsProvider>
        <UrlSchemaProvider>
          <NotificationProvider>
            <TooltipProvider delayDuration={300}>
              <ConfirmProvider>
                <IDEPage />
                <Toaster />
              </ConfirmProvider>
            </TooltipProvider>
          </NotificationProvider>
        </UrlSchemaProvider>
      </SettingsProvider>
    </I18nextProvider>
  )
}

export default App
