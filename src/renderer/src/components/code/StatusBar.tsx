import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Terminal, Circle } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { EditorDiagnostic } from './MonacoCodeEditor'
import { CodebaseIndexStatus } from './CodebaseIndexStatus'
import { GitBranchSwitcher } from '@/features/ide/components/project-bar/git-branch-switcher'
import { ProjectSwitcher } from '@/features/ide/components/project-bar/project-switcher'
import { RecentProject } from '@/features/ide/types'

interface StatusBarProps {
  currentFile?: string | null
  projectPath?: string | null
  cursorPosition?: { line: number; column: number }
  fileEncoding?: string
  lineEnding?: 'LF' | 'CRLF' | 'CR'
  language?: string
  bottomPanel?: 'terminal' | 'problems' | null
  onBottomPanelChange?: (panel: 'terminal' | 'problems' | null) => void
  diagnostics?: EditorDiagnostic[]
  /** Project switcher (bottom bar). */
  projectSwitcher?: {
    workspaceRoot: string
    recentProjects: RecentProject[]
    onNewProject: () => void
    onOpenProject: () => void
    onCloneRepository: () => void
    onOpenRecentProject: (path: string) => void
  } | null
  /** Git branch switcher. */
  gitBranch?: {
    workspaceRoot: string
    currentBranch: string
    onUpdate: () => void
    onCommit: () => void
    onPush: () => void
    onPull: () => void
    onFetch: () => void
    onNewBranch: () => void
    onCheckoutBranch: (branchName: string) => void
    onRefresh: () => void
  } | null
}

export function StatusBar({
  currentFile,
  projectPath,
  cursorPosition = { line: 1, column: 1 },
  fileEncoding = 'UTF-8',
  lineEnding = 'LF',
  language = 'plaintext',
  bottomPanel = null,
  onBottomPanelChange,
  diagnostics = [],
  projectSwitcher = null,
  gitBranch = null
}: StatusBarProps) {
  const { t } = useTranslation('editor')
  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics]
  )
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics]
  )

  const languageDisplayName = (lang: string): string => {
    const map: Record<string, string> = {
      javascript: 'JavaScript',
      javascriptreact: 'JavaScript React',
      typescript: 'TypeScript',
      typescriptreact: 'TypeScript React',
      python: 'Python',
      json: 'JSON',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      less: 'LESS',
      markdown: 'Markdown',
      yaml: 'YAML',
      xml: 'XML',
      sql: 'SQL',
      shell: 'Shell',
      plaintext: 'Plain Text'
    }
    return map[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
  }

  const handleTogglePanel = (panel: 'terminal' | 'problems') => {
    if (bottomPanel === panel) {
      onBottomPanelChange?.(null)
    } else {
      onBottomPanelChange?.(panel)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border/50 bg-muted/30 px-3 py-2 text-xs select-none">
      <div className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden">
        {projectSwitcher && (
          <div className="shrink-0 [&_button]:text-xs">
            <ProjectSwitcher
              workspaceRoot={projectSwitcher.workspaceRoot}
              recentProjects={projectSwitcher.recentProjects}
              onNewProject={projectSwitcher.onNewProject}
              onOpenProject={projectSwitcher.onOpenProject}
              onCloneRepository={projectSwitcher.onCloneRepository}
              onOpenRecentProject={projectSwitcher.onOpenRecentProject}
            />
          </div>
        )}

        {gitBranch && (
          <div className="shrink-0 [&_button]:text-xs">
            <GitBranchSwitcher
              workspaceRoot={gitBranch.workspaceRoot}
              currentBranch={gitBranch.currentBranch}
              onUpdate={gitBranch.onUpdate}
              onCommit={gitBranch.onCommit}
              onPush={gitBranch.onPush}
              onPull={gitBranch.onPull}
              onFetch={gitBranch.onFetch}
              onNewBranch={gitBranch.onNewBranch}
              onCheckoutBranch={gitBranch.onCheckoutBranch}
              onRefresh={gitBranch.onRefresh}
            />
          </div>
        )}

        {(projectSwitcher || gitBranch) && <div className="h-4 w-px shrink-0 bg-border/50" />}

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 gap-1.5 px-2 text-xs hover:bg-accent/50',
            bottomPanel === 'problems' && 'bg-accent'
          )}
          onClick={() => handleTogglePanel('problems')}
          title={t('statusBar.toggleProblemsPanel')}
        >
          <AlertCircle className="size-3.5" />
          {errorCount > 0 && (
            <div className="flex items-center gap-0.5 text-red-500">
              <span>{errorCount}</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-0.5 text-yellow-500">
              {errorCount > 0 && <span className="text-muted-foreground">/</span>}
              <span>{warningCount}</span>
            </div>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 gap-1.5 px-2 text-xs hover:bg-accent/50',
            bottomPanel === 'terminal' && 'bg-accent'
          )}
          onClick={() => handleTogglePanel('terminal')}
          title={t('statusBar.toggleTerminalPanel')}
        >
          <Terminal className="size-3.5" />
          <span>{t('statusBar.terminal')}</span>
        </Button>

        {currentFile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1.5 px-2 text-xs hover:bg-accent/50"
                title={t('statusBar.languageServiceTooltip')}
              >
                <Circle className="size-2.5 fill-green-500 text-green-500" />
                <span className="text-muted-foreground">
                  {t('statusBar.languageServicesLabel')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="px-2 py-1.5">
                <div className="text-xs font-semibold mb-2">
                  {t('statusBar.runningLanguageServices')}
                </div>
                <div className="space-y-1">
                  {(language === 'typescript' ||
                    language === 'typescriptreact' ||
                    language === 'javascript' ||
                    language === 'javascriptreact') && (
                    <>
                      <div className="flex items-center gap-2 text-xs py-1">
                        <Circle className="size-2 fill-green-500 text-green-500" />
                        <span className="font-mono">
                          TypeScript {language.includes('typescript') ? '5.9.2' : '(JS)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs py-1">
                        <Circle className="size-2 fill-green-500 text-green-500" />
                        <span className="font-mono">ESLint 9.34.0</span>
                      </div>
                    </>
                  )}
                  {(language === 'css' || language === 'scss' || language === 'less') && (
                    <div className="flex items-center gap-2 text-xs py-1">
                      <Circle className="size-2 fill-green-500 text-green-500" />
                      <span className="font-mono">CSS Language Service</span>
                    </div>
                  )}
                  {language === 'html' && (
                    <div className="flex items-center gap-2 text-xs py-1">
                      <Circle className="size-2 fill-green-500 text-green-500" />
                      <span className="font-mono">HTML Language Service</span>
                    </div>
                  )}
                  {language === 'json' && (
                    <div className="flex items-center gap-2 text-xs py-1">
                      <Circle className="size-2 fill-green-500 text-green-500" />
                      <span className="font-mono">JSON Language Service</span>
                    </div>
                  )}
                  {language === 'yaml' && (
                    <div className="flex items-center gap-2 text-xs py-1">
                      <Circle className="size-2 fill-green-500 text-green-500" />
                      <span className="font-mono">YAML Diagnostics</span>
                    </div>
                  )}
                  {language === 'markdown' && (
                    <div className="flex items-center gap-2 text-xs py-1">
                      <Circle className="size-2 fill-green-500 text-green-500" />
                      <span className="font-mono">Markdown Lint</span>
                    </div>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 pl-2">
        <CodebaseIndexStatus projectPath={projectPath ?? null} />

        {currentFile && (
          <div className="px-1 text-xs text-muted-foreground">{languageDisplayName(language)}</div>
        )}

        {currentFile && <div className="px-1 text-xs text-muted-foreground">{fileEncoding}</div>}

        {currentFile && <div className="px-1 text-xs text-muted-foreground">{lineEnding}</div>}

        {currentFile && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs font-mono hover:bg-accent/50"
            disabled
          >
            {t('statusBar.cursorPosition', {
              line: cursorPosition.line,
              column: cursorPosition.column
            })}
          </Button>
        )}
      </div>
    </div>
  )
}
