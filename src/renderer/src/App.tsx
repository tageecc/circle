import { useState, useEffect } from 'react'
import { IDEPage } from './pages/ide-page'
import { Toaster } from './components/ui/sonner'
import { SettingsProvider } from './contexts/SettingsContext'
import { SettingsDialog } from './components/dialogs/SettingsDialog'
import { ConfirmProvider } from './components/shared/ConfirmProvider'

function App(): React.JSX.Element {
  const [isStateLoaded, setIsStateLoaded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    window.api.config
      .getUIState()
      .then(() => setIsStateLoaded(true))
      .catch(console.error)
  }, [])

  // 监听快捷键 Cmd+, 打开设置
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 监听 URL Schema 唤起（仅用于唤起时聚焦窗口，协议逻辑在 main 进程）
  useEffect(() => {
    const handleOpenUrl = (url: string) => {
      window.dispatchEvent(new CustomEvent('app:open-url', { detail: url }))
    }
    const removeListener = window.api.app?.onOpenUrl(handleOpenUrl)
    return () => removeListener?.()
  }, [])

  return (
    <SettingsProvider>
      <ConfirmProvider>
        {!isStateLoaded ? (
          <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
            Loading…
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden bg-background">
            <IDEPage onOpenSettings={() => setSettingsOpen(true)} />
            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
            <Toaster />
          </div>
        )}
      </ConfirmProvider>
    </SettingsProvider>
  )
}

export default App
