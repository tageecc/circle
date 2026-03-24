import { useState } from 'react'
import { ChevronRight, CheckCircle2, XCircle, Loader2, FileText, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeDisplay } from './code-display'

export interface FileEditPending {
  filePath: string
  absolutePath: string
  oldContent: string
  newContent: string
  diff: string
  instructions: string
  fileExists: boolean
  stats?: { linesAdded: number; linesDeleted: number; linesTotal: number }
}

export interface ToolCallData {
  id: string
  name: string
  args: any
  result?: any
  isError?: boolean
  isLoading?: boolean
  isPending?: boolean
  pendingData?: any
}

interface ToolCallProps {
  tool: ToolCallData
  className?: string
  onOpenFile?: (filePath: string) => void
  isLatest?: boolean
}

export function ToolCall({ tool, className, onOpenFile, isLatest = false }: ToolCallProps) {
  // 最新的工具默认展开
  const [isExpanded, setIsExpanded] = useState(isLatest)

  const getStatusIcon = () => {
    if (tool.isLoading) {
      return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
    }
    if (tool.isError) {
      return <XCircle className="size-3.5 text-destructive" />
    }
    return <CheckCircle2 className="size-3.5 text-emerald-500" />
  }

  const getFileName = (path: string): string => {
    if (!path) return ''
    const parts = path.split(/[\\/]/)
    return parts[parts.length - 1]
  }

  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      css: 'css',
      html: 'html',
      md: 'markdown',
      sql: 'sql',
      sh: 'shell',
      yaml: 'yaml',
      yml: 'yaml'
    }
    return languageMap[ext || ''] || 'plaintext'
  }

  // read_file：inline button
  if (tool.name === 'read_file') {
    const fileName = getFileName(tool.args?.target_file)
    return (
      <button
        onClick={() => onOpenFile?.(tool.args?.target_file)}
        className={cn('flex cursor-pointer items-center gap-2', className)}
      >
        <FileText className="size-3 shrink-0 text-primary" />
        <span className="text-xs text-primary">读取 {fileName}</span>
      </button>
    )
  }

  // run_terminal_cmd: 可展开的命令卡片（类似 Cursor）
  if (tool.name === 'run_terminal_cmd') {
    const command = tool.args?.command || ''
    const parts = command.split(/\s+/)
    const mainCmd = parts[0] || ''
    const restCmd = parts.slice(1).join(' ')

    // 获取输出内容
    let output = ''
    if (tool.result && typeof tool.result === 'object') {
      const stdout = tool.result.stdout || ''
      const stderr = tool.result.stderr || ''
      output = stdout + (stderr ? '\n' + stderr : '')
    } else if (typeof tool.result === 'string') {
      output = tool.result
    }

    const hasOutput = output.trim().length > 0

    return (
      <div
        className={cn(
          'group rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-border',
          className
        )}
      >
        {/* Header */}
        <button
          onClick={() => hasOutput && setIsExpanded(!isExpanded)}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
            hasOutput ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default'
          )}
        >
          {/* Icon Area */}
          <div className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/80">
            {hasOutput ? (
              <ChevronRight
                className={cn(
                  'size-4 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            ) : (
              <Terminal className="size-4" />
            )}
          </div>

          {/* Command Text */}
          <div className="flex-1 min-w-0 flex items-center gap-2 font-mono text-sm">
            <span className="font-medium text-foreground shrink-0">{mainCmd}</span>
            {restCmd && <span className="text-muted-foreground truncate">{restCmd}</span>}
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 shrink-0">{getStatusIcon()}</div>
        </button>

        {/* Expanded Content - 输出内容 */}
        {isExpanded && hasOutput && (
          <div className="border-t border-border/40 bg-muted/20">
            <div className="max-h-80 overflow-y-auto p-3">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                {output.trim()}
              </pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 如果是 pending 状态（需要用户确认的 edit_file），使用 Monaco diff editor
  if (tool.isPending && tool.pendingData) {
    const pending = tool.pendingData as FileEditPending
    const fileName = getFileName(pending.filePath)

    return (
      <div
        className={cn(
          'rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-border',
          className
        )}
      >
        {/* Header - 可收起的标题栏 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
          <span className="flex-1 truncate text-xs font-medium text-foreground">{fileName}</span>
        </button>

        {/* Diff 预览 - 可展开/收起 */}
        {isExpanded && (
          <div className="border-t border-border/50">
            <CodeDisplay
              originalCode={pending.oldContent}
              code={pending.newContent}
              showDiff={true}
              language={getLanguageFromFileName(pending.filePath)}
              showHeader={false}
              maxHeight="400px"
            />
          </div>
        )}
      </div>
    )
  }

  // edit_file: 可展开查看 diff（类似 Cursor）
  if (tool.name === 'edit_file') {
    const fileName = getFileName(tool.args?.target_file)
    const result = tool.result || {}
    const isNewFile = result.fileExists === false
    const hasDiff = result.diff && result.diff.length > 0
    const stats = result.stats || {}

    return (
      <div
        className={cn(
          'group rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-border',
          className
        )}
      >
        {/* Header */}
        <button
          onClick={() => hasDiff && setIsExpanded(!isExpanded)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
            hasDiff && 'cursor-pointer'
          )}
        >
          {hasDiff && (
            <ChevronRight
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          )}
          {!hasDiff && <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="flex-1 text-xs">
            <span className="text-muted-foreground">{isNewFile ? '创建' : '编辑'}</span>
            <span className="text-foreground font-medium ml-1">{fileName}</span>
            {stats.linesAdded > 0 && (
              <span className="text-green-600 dark:text-green-400 ml-2">+{stats.linesAdded}</span>
            )}
            {stats.linesDeleted > 0 && (
              <span className="text-red-600 dark:text-red-400 ml-1">-{stats.linesDeleted}</span>
            )}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">{getStatusIcon()}</div>
        </button>

        {/* Expanded Content - 显示代码编辑内容 */}
        {isExpanded && hasDiff && (
          <div className="border-t border-border/50">
            <CodeDisplay
              code={result.code_edit || ''}
              language={getLanguageFromFileName(tool.args?.target_file)}
              showHeader={false}
              maxHeight="400px"
            />
          </div>
        )}
      </div>
    )
  }

  // 其他工具：简洁展示，只在出错时显示详情
  const displayTitle = tool.args?.target_file ? getFileName(tool.args.target_file) : tool.name

  return (
    <div
      className={cn(
        'group rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-border',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => tool.isError && setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
          tool.isError && 'cursor-pointer'
        )}
      >
        {tool.isError && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        <span className="flex-1 truncate text-xs font-medium text-foreground">{displayTitle}</span>
        <div className="flex items-center gap-1.5 shrink-0">{getStatusIcon()}</div>
      </button>

      {/* 只在出错且展开时显示错误信息 */}
      {isExpanded && tool.isError && tool.result && (
        <div className="border-t border-border/50 px-3 py-2">
          <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
          </div>
        </div>
      )}
    </div>
  )
}

interface ToolCallListProps {
  tools: ToolCallData[]
  className?: string
  onOpenFile?: (filePath: string) => void
}

export function ToolCallList({ tools, className, onOpenFile }: ToolCallListProps) {
  if (tools.length === 0) return null

  return (
    <div className={cn('space-y-1.5 my-3', className)}>
      {tools.map((tool, index) => (
        <ToolCall
          key={tool.id}
          tool={tool}
          onOpenFile={onOpenFile}
          isLatest={index === tools.length - 1}
        />
      ))}
    </div>
  )
}
