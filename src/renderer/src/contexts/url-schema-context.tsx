import { createContext, useContext, useEffect, useCallback, ReactNode } from 'react'

type UrlSchemaHandler = (url: string) => void

interface UrlSchemaContextValue {
  registerHandler: (handler: UrlSchemaHandler) => () => void
}

const UrlSchemaContext = createContext<UrlSchemaContextValue | undefined>(undefined)

export function UrlSchemaProvider({ children }: { children: ReactNode }) {
  const handlers = new Set<UrlSchemaHandler>()

  const registerHandler = useCallback((handler: UrlSchemaHandler) => {
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }, [])

  useEffect(() => {
    const handleOpenUrl = (url: string) => {
      console.log('🔗 URL Schema received:', url)
      handlers.forEach((handler) => handler(url))
    }

    const removeListener = window.api.app?.onOpenUrl(handleOpenUrl)
    return () => {
      removeListener?.()
    }
  }, [])

  return (
    <UrlSchemaContext.Provider value={{ registerHandler }}>{children}</UrlSchemaContext.Provider>
  )
}

export function useUrlSchema(handler: UrlSchemaHandler) {
  const context = useContext(UrlSchemaContext)
  if (!context) {
    throw new Error('useUrlSchema must be used within UrlSchemaProvider')
  }

  useEffect(() => {
    const unregister = context.registerHandler(handler)
    return unregister
  }, [context, handler])
}
