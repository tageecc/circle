import { PanelResizeHandle, Panel } from 'react-resizable-panels'
import { TerminalPanel } from '../terminal/terminal-panel'
import { ProblemsPanel } from '../diagnostics/problems-panel'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useFileManager } from '@/hooks/use-file-manager'
import { useEditorState } from '@/hooks/use-editor-state'

interface BottomPanelProps {
  workspaceRoot: string
}

export function BottomPanel({ workspaceRoot }: BottomPanelProps) {
  // Store - 精确订阅
  const bottomPanel = useWorkspaceUIStore((state) => state.bottomPanel)
  const terminalInitialized = useWorkspaceUIStore((state) => state.terminalInitialized)
  const pendingTerminalCommand = useWorkspaceUIStore((state) => state.pendingTerminalCommand)
  const setBottomPanel = useWorkspaceUIStore((state) => state.setBottomPanel)
  const setTerminalInitialized = useWorkspaceUIStore((state) => state.setTerminalInitialized)
  const setPendingTerminalCommand = useWorkspaceUIStore((state) => state.setPendingTerminalCommand)

  const fileManager = useFileManager(workspaceRoot)
  const allDiagnostics = useWorkspaceStore((state) => state.diagnostics)
  const { handleDiagnosticClick } = useEditorState()

  // 条件渲染而不是 display:none（避免 react-resizable-panels 警告）
  if (!bottomPanel && !terminalInitialized) {
    return null
  }

  // Terminal 组件保活：即使折叠也渲染（用于保持终端会话）
  if (!bottomPanel && terminalInitialized) {
    return (
      <div className="hidden">
        <TerminalPanel
          workspaceRoot={workspaceRoot}
          onClose={() => setBottomPanel(null)}
          pendingCommand={pendingTerminalCommand}
          onCommandHandled={() => setPendingTerminalCommand(null)}
          onInitialized={() => setTerminalInitialized(true)}
        />
      </div>
    )
  }

  return (
    <>
      <PanelResizeHandle className="h-px bg-border/50 hover:bg-primary hover:h-1 transition-all" />
      <Panel id="bottom-panel" defaultSize={30} minSize={15} maxSize={60}>
        {bottomPanel === 'problems' && (
          <ProblemsPanel
            diagnostics={allDiagnostics}
            onDiagnosticClick={(d) =>
              handleDiagnosticClick(d, fileManager.activeFile, fileManager.openFile)
            }
            onClose={() => setBottomPanel(null)}
          />
        )}

        {bottomPanel === 'terminal' && (
          <TerminalPanel
            workspaceRoot={workspaceRoot}
            onClose={() => setBottomPanel(null)}
            pendingCommand={pendingTerminalCommand}
            onCommandHandled={() => setPendingTerminalCommand(null)}
            onInitialized={() => setTerminalInitialized(true)}
          />
        )}
      </Panel>
    </>
  )
}
