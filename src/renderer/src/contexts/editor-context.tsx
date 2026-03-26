import { createContext, useContext, ReactNode } from 'react'
import type { FileManager } from '@/types/ide'

interface EditorContextType {
  activeFile: string | null
  cursorPosition: { line: number; column: number }
  language: string
  fileEncoding: string
  lineEnding: 'LF' | 'CRLF' | 'CR'
  fileManager: FileManager
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

interface EditorProviderProps {
  children: ReactNode
  value: EditorContextType
}

export function EditorProvider({ children, value }: EditorProviderProps) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider')
  }
  return context
}
