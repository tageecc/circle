import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { ConfirmDialog } from './confirm-dialog'

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    options: ConfirmOptions | null
    resolve: ((value: boolean) => void) | null
  }>({
    open: false,
    options: null,
    resolve: null
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        options,
        resolve
      })
    })
  }, [])

  const handleClose = useCallback(
    (confirmed: boolean) => {
      if (dialogState.resolve) {
        dialogState.resolve(confirmed)
      }
      setDialogState({
        open: false,
        options: null,
        resolve: null
      })
    },
    [dialogState.resolve]
  )

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialogState.options && (
        <ConfirmDialog
          open={dialogState.open}
          onOpenChange={(open) => {
            if (!open) {
              handleClose(false)
            }
          }}
          title={dialogState.options.title}
          description={dialogState.options.description}
          confirmText={dialogState.options.confirmText || '确认'}
          cancelText={dialogState.options.cancelText || '取消'}
          variant={dialogState.options.variant || 'default'}
          onConfirm={() => handleClose(true)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}
