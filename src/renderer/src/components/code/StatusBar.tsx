import { useMemo } from 'react'
import { AlertCircle, Terminal, Circle } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { EditorDiagnostic } from './MonacoCodeEditor'
import { CodebaseIndexStatus } from './CodebaseIndexStatus'
import { GitBranchSwitcher } from '@/features/ide/components/project-bar/git-branch-switcher'

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
  /** 分支切换（参考 Codex：放到底部 status bar） */
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
  gitBranch = null
}: StatusBarProps) {
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
    <div className="flex h-6 items-center justify-between border-t border-border/50 bg-muted/30 px-2 text-xs select-none">
      {/* 左侧信息 */}
      <div className="flex items-center gap-2">
        {/* 问题面板按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-5 gap-1.5 px-1.5 text-xs hover:bg-accent/50',
            bottomPanel === 'problems' && 'bg-accent'
          )}
          onClick={() => handleTogglePanel('problems')}
          title="切换问题面板"
        >
          <AlertCircle className="size-3" />
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

        {/* 终端面板按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-5 gap-1 px-1.5 text-xs hover:bg-accent/50',
            bottomPanel === 'terminal' && 'bg-accent'
          )}
          onClick={() => handleTogglePanel('terminal')}
          title="切换终端面板"
        >
          <Terminal className="size-3" />
          <span>终端</span>
        </Button>

        {/* Language Services 状态 */}
        {currentFile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-xs hover:bg-accent/50"
                title="语言服务"
              >
                <Circle className="size-2 fill-green-500 text-green-500" />
                <span className="text-muted-foreground">Language Services</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="px-2 py-1.5">
                <div className="text-xs font-semibold mb-2">运行中的语言服务</div>
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

      {/* 右侧信息 */}
      <div className="flex items-center gap-3">
        {/* 代码库索引状态 */}
        <CodebaseIndexStatus projectPath={projectPath ?? null} />

        {/* 分支切换（底部 status bar，参考 Codex） */}
        {gitBranch && (
          <div className="[&_button]:h-5 [&_button]:min-h-5 [&_button]:text-xs">
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

        {/* 语言模式 */}
        {currentFile && (
          <div className="px-1.5 text-xs text-muted-foreground">
            {languageDisplayName(language)}
          </div>
        )}

        {/* 文件编码 */}
        {currentFile && <div className="px-1.5 text-xs text-muted-foreground">{fileEncoding}</div>}

        {/* 行尾符 */}
        {currentFile && <div className="px-1.5 text-xs text-muted-foreground">{lineEnding}</div>}

        {/* 光标位置 */}
        {currentFile && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs font-mono hover:bg-accent/50"
            disabled
          >
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </Button>
        )}
      </div>
    </div>
  )
}
