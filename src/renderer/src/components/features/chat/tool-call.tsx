import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Trash2,
  Terminal as TerminalIcon,
  ExternalLink,
  Play,
  X,
  SkipForward
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ToolCallDiffViewer } from './tool-call-diff-viewer'
import { useSettings } from '@/contexts/settings-context'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { eventBus } from '@/lib/event-bus'
import { getFileNameFromPath, getLanguageFromFileName } from '@/utils/file-helpers'
import { useTranslation } from 'react-i18next'
// cleanTerminalOutput 已在后端清理，前端不再需要

/**
 * 从 tool result 中提取 edit_file 的内容
 * 支持字符串和对象两种格式
 */
function extractEditContent(result: any): { oldContent: string; newContent: string } {
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result)
      return {
        oldContent: parsed.oldContent || '',
        newContent: parsed.newContent || ''
      }
    } catch {
      return { oldContent: '', newContent: '' }
    }
  }
  
  return {
    oldContent: result?.oldContent || '',
    newContent: result?.newContent || ''
  }
}

export interface ToolCallData {
  id: string
  name: string
  args: any
  result?: any
  isError?: boolean
  isLoading?: boolean
  isCancelled?: boolean
  terminalId?: string
  streamOutput?: string
  isRunning?: boolean
  needsApproval?: boolean
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'skipped'
}

interface ToolCallProps {
  tool: ToolCallData
  className?: string
  onOpenFile?: (filePath: string) => void
  onApprovalDecision?: (toolCallId: string, decision: 'approve' | 'reject' | 'skip') => void
  isLatest?: boolean
}

/**
 * 提取命令中的关键命令名称（Cursor 风格）
 * 支持：管道 |、分号 ;、&& 、|| 等连接符
 */
function extractCommandNames(fullCommand: string): string[] {
  if (!fullCommand) return []

  // 控制结构关键字（需要过滤）
  const controlKeywords = new Set([
    'for',
    'while',
    'if',
    'do',
    'done',
    'then',
    'fi',
    'case',
    'esac',
    'in'
  ])

  // 按分隔符拆分命令（保留管道、分号、&&、||）
  const segments = fullCommand
    .split(/([|;&]+|\&\&|\|\|)/)
    .map((s) => s.trim())
    .filter((s) => s && !['|', '||', '&&', ';', '&'].includes(s))

  const commands: string[] = []
  const seen = new Set<string>()

  for (const segment of segments) {
    // 提取所有单词
    const words = segment.match(/\b[a-zA-Z_][\w-]*\b/g) || []

    for (const word of words) {
      // 跳过控制结构关键字
      if (controlKeywords.has(word)) {
        continue
      }

      // 跳过单字母变量（通常是循环变量如 i, j, x 等）
      if (word.length === 1) {
        continue
      }

      // 添加到命令列表（去重）
      if (!seen.has(word)) {
        commands.push(word)
        seen.add(word)
        break // 每个段落只取第一个有效命令
      }
    }
  }

  return commands.slice(0, 4) // 最多显示 4 个命令
}

export function ToolCall({
  tool,
  className,
  onOpenFile,
  onApprovalDecision,
  isLatest = false
}: ToolCallProps) {
  // 计算初始展开状态（useState 惰性初始化）
  const [isExpanded, setIsExpanded] = useState(() => {
    if (isLatest) return true
    
    // edit_file 工具：如果有 result（已完成），默认展开
    if (tool.name === 'edit_file' && tool.result) {
      const { oldContent, newContent } = extractEditContent(tool.result)
      return !!(oldContent || newContent)
    }
    
    return false
  })
  
  const { terminalSettings } = useSettings()
  const { t } = useTranslation()

  // 处理审批决策
  const handleApprovalDecision = (decision: 'approve' | 'reject' | 'skip') => {
    if (onApprovalDecision) {
      onApprovalDecision(tool.id, decision)
    }
  }

  const getStatusIcon = () => {
    if (tool.isLoading) {
      return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
    }
    if (tool.isError) {
      return <XCircle className="size-3.5 text-destructive" />
    }
    return <CheckCircle2 className="size-3.5 text-emerald-500" />
  }

  // get_skill_details：技能加载动画（符合项目规范）
  if (tool.name === 'get_skill_details') {
    const skillName = tool.args?.skill_name || 'unknown'
    const hasError = tool.isError
    // ✅ 检查是否是历史消息（已有结果且不在加载中）
    const isHistoryMessage = tool.result !== undefined && tool.isLoading !== true

    // ✨ 使用本地状态实现平滑进度动画，最小展示 1200ms
    const [animationState, setAnimationState] = useState<'init' | 'loading' | 'complete' | 'done'>(
      isHistoryMessage ? 'done' : 'init'  // ✅ 历史消息直接显示完成状态
    )
    const [progress, setProgress] = useState(isHistoryMessage ? 100 : 0)
    const animationStarted = useRef(false)

    useEffect(() => {
      // ✅ 历史消息不播放动画
      if (isHistoryMessage) {
        setAnimationState('done')
        setProgress(100)
        return
      }

      // 如果动画已启动，不重复启动
      if (animationStarted.current) {
        // 但如果加载完成了，需要更新状态
        if (!tool.isLoading && tool.result !== undefined) {
          setProgress(100)
          setAnimationState('complete')
          setTimeout(() => setAnimationState('done'), 500)
        }
        return
      }

      // 首次挂载时，如果正在加载，启动动画
      if (tool.isLoading) {
        animationStarted.current = true
        setAnimationState('loading')
        setProgress(0)

        // 利用 Progress 组件的 CSS 过渡实现平滑动画
        const timers = [
          // 快速增长到 90%，CSS transition 会自动平滑过渡
          setTimeout(() => setProgress(90), 50),
          // 到达 100%
          setTimeout(() => {
            setProgress(100)
            setAnimationState('complete')
          }, 800),
          // 100% 停留 500ms 后显示最终状态
          setTimeout(() => {
            setAnimationState('done')
          }, 1300)
        ]

        return () => timers.forEach(clearTimeout)
      }
      return
    }, [isHistoryMessage, tool.isLoading, tool.result])

    const isLoading = animationState === 'loading' || animationState === 'complete'
    const showProgress = animationState !== 'done'

    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border transition-all duration-300',
          hasError
            ? 'border-destructive/50 bg-destructive/5'
            : isLoading
            ? 'border-primary/20 bg-muted/30'
            : 'border-border/50 bg-muted/20',
          className
        )}
      >
        <div className="relative px-3 py-2.5 space-y-2.5">
          {/* 标题行 */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : hasError ? (
              <XCircle className="size-3.5 text-destructive" />
            ) : (
              <CheckCircle2 className="size-3.5 text-primary" />
            )}
            <span
              className={cn(
                'text-xs font-semibold',
                isLoading && 'text-foreground',
                hasError && 'text-destructive',
                !isLoading && !hasError && 'text-foreground'
              )}
            >
              {isLoading
                ? t('chat.skill_loading')
                : hasError
                  ? t('chat.skill_load_failed')
                  : t('chat.skill_loaded')}
              <span className="text-muted-foreground ml-2">{skillName}</span>
            </span>
            {showProgress && (
              <span className="ml-auto text-xs font-mono text-muted-foreground tabular-nums">
                {progress}%
              </span>
            )}
          </div>

          {/* shadcn/ui Progress 组件（项目规范样式） */}
          {showProgress && (
            <Progress
              value={progress}
              className={cn(
                'h-1.5',
                // 使用项目标准色系，添加平滑过渡
                '[&>[data-slot=progress-indicator]]:transition-all',
                '[&>[data-slot=progress-indicator]]:duration-500',
                '[&>[data-slot=progress-indicator]]:ease-out'
              )}
            />
          )}

          {/* 错误信息 */}
          {hasError && tool.result && (
            <div className="text-xs text-destructive/80">
              {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // read_file：inline button
  if (tool.name === 'read_file') {
    const filePath = tool.args?.file_path || tool.args?.target_file
    const fileName = getFileNameFromPath(filePath)
    return (
      <button
        onClick={() => onOpenFile?.(filePath)}
        className={cn('flex cursor-pointer items-center gap-2', className)}
      >
        <FileText className="size-3 shrink-0 text-primary" />
        <span className="text-xs text-primary">读取 {fileName}</span>
      </button>
    )
  }

  // run_terminal_cmd
  if (tool.name === 'run_terminal_cmd') {
    const fullCommand = tool.args?.command || ''
    const commandNames = extractCommandNames(fullCommand)
    const commandTitle = commandNames.length > 0 ? commandNames.join(', ') : 'command'
    const terminalId = tool.terminalId
    const isRunning = tool.isRunning !== undefined ? tool.isRunning : tool.isLoading
    const isCancelled = tool.isCancelled

    // 解析结果
    let exitCode: number | null = null
    let stdout = ''
    let stderr = ''

    if (tool.result && typeof tool.result === 'string') {
      try {
        const parsed = JSON.parse(tool.result)
        exitCode = parsed.exitCode ?? null
        stdout = parsed.stdout || ''
        stderr = parsed.stderr || ''
      } catch {
        // ignore
      }
    }

    const hasError = tool.isError || (exitCode !== null && exitCode !== 0)
    // 判断是否有流式输出（无论是否有 terminalId）
    const hasStreamOutput = tool.streamOutput !== undefined && tool.streamOutput !== ''
    const isBackgroundTask = terminalId !== undefined // 只有创建了 terminal tab 才算后台任务

    // 后端已清理，前端直接使用
    const cleanedStreamOutput = useMemo(() => {
      return tool.streamOutput || ''
    }, [tool.streamOutput])

    const cleanedFinalOutput = useMemo(() => {
      return stderr || stdout
    }, [stdout, stderr])

    // 提取预览输出（折叠状态下显示最后 3 行）
    const previewOutput = useMemo(() => {
      const output = cleanedStreamOutput || cleanedFinalOutput
      if (!output) return ''

      const lines = output.trim().split('\n')
      if (lines.length <= 3) return output

      return lines.slice(-3).join('\n')
    }, [cleanedStreamOutput, cleanedFinalOutput])

    // 打开 terminal tab
    const handleOpenTerminal = () => {
      if (terminalId) {
        eventBus.emit('terminal:focus', { terminalId })
      }
    }

    // 控制折叠状态
    const [isOpen, setIsOpen] = useState(isLatest)

    return (
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn(
          'w-full min-w-0 rounded-lg border overflow-hidden',
          hasError ? 'border-destructive/30' : 'border-border/50',
          className
        )}
      >
        {/* Header - 根据审批状态动态显示 */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 p-0 hover:bg-background/80">
                <ChevronRight
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <span className="text-xs text-muted-foreground">
              {tool.needsApproval && tool.approvalStatus === 'pending' ? (
                <>
                  需要确认命令:{' '}
                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                    {commandTitle}
                  </span>
                </>
              ) : tool.approvalStatus === 'approved' ? (
                <>
                  已确认执行: <span className="text-foreground font-medium">{commandTitle}</span>
                </>
              ) : tool.approvalStatus === 'rejected' ? (
                <>
                  已拒绝命令: <span className="text-destructive font-medium">{commandTitle}</span>
                </>
              ) : tool.approvalStatus === 'skipped' ? (
                <>
                  已跳过命令:{' '}
                  <span className="text-muted-foreground font-medium">{commandTitle}</span>
                </>
              ) : (
                <>
                  Auto-Ran command:{' '}
                  <span className="text-foreground font-medium">{commandTitle}</span>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {terminalId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 hover:bg-background/80"
                onClick={handleOpenTerminal}
              >
                <TerminalIcon className="size-3" />
                查看终端
                <ExternalLink className="size-2.5" />
              </Button>
            )}
            {isCancelled ? (
              <span className="flex items-center gap-1 text-xs text-orange-500">
                <XCircle className="size-3.5" />
                <span>已取消</span>
              </span>
            ) : isRunning ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : exitCode === 130 ? (
              <span className="flex items-center gap-1 text-xs text-orange-500">
                <XCircle className="size-3.5" />
                <span>已停止</span>
              </span>
            ) : hasError ? (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <XCircle className="size-3.5" />
                <span>Failed</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 className="size-3.5" />
                <span>Success</span>
              </span>
            )}
          </div>
        </div>

        {/* 预览输出（折叠状态下显示） */}
        {!isOpen && previewOutput && (
          <div className="px-3 pb-2 bg-muted/30">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap line-clamp-3">
                {previewOutput}
              </pre>
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <CollapsibleContent>
          <div className="bg-background/50 overflow-hidden px-3 py-3">
            {/* 命令行 - 带 $ 前缀，增强视觉效果 */}
            <div
              className="flex items-start gap-2 text-xs mb-3 px-3 py-2 rounded-md bg-muted/50 border border-border/30"
              style={{
                fontFamily: terminalSettings.fontFamily || 'Monaco, Consolas, monospace',
                fontSize: `${(terminalSettings.fontSize || 14) - 2}px`
              }}
            >
              <span className="text-amber-500 dark:text-amber-400 shrink-0 font-bold">$</span>
              <span className="text-foreground font-semibold break-all">{fullCommand}</span>
            </div>

            {/* 审批状态提示（只显示拒绝和跳过） */}
            {tool.needsApproval &&
              tool.approvalStatus !== 'pending' &&
              tool.approvalStatus !== 'approved' && (
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium mb-3',
                    tool.approvalStatus === 'rejected' && 'bg-destructive/10 text-destructive',
                    tool.approvalStatus === 'skipped' && 'bg-muted text-muted-foreground'
                  )}
                >
                  {tool.approvalStatus === 'rejected' && (
                    <>
                      <XCircle className="size-3.5" />
                      <span>已拒绝执行</span>
                    </>
                  )}
                  {tool.approvalStatus === 'skipped' && (
                    <>
                      <SkipForward className="size-3.5" />
                      <span>已跳过</span>
                    </>
                  )}
                </div>
              )}

            {/* 流式输出：优先显示（同步任务和后台任务都适用） */}
            {hasStreamOutput ? (
              <div className="mt-3 rounded-md bg-muted/30 p-3">
                <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto">
                  {cleanedStreamOutput}
                </pre>
              </div>
            ) : isBackgroundTask ? (
              <></>
            ) : (
              /* 同步任务模式：显示完整结果 */
              <>
                {/* 输出结果 */}
                {(stdout || stderr) && (
                  <div className="mt-3 rounded-md bg-muted/30 p-3">
                    <pre
                      className={cn(
                        'text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto',
                        exitCode === 130 ? 'text-orange-500' : hasError ? 'text-destructive' : 'text-foreground/80'
                      )}
                    >
                      {cleanedFinalOutput}
                    </pre>
                  </div>
                )}

                {/* 状态信息 */}
                {!stdout && !stderr && (
                  <div className="flex items-center gap-2 text-xs mt-2">
                    {isCancelled ? (
                      <>
                        <XCircle className="size-3 text-orange-500" />
                        <span className="text-orange-500">命令已取消</span>
                      </>
                    ) : isRunning ? (
                      <>
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">正在执行...</span>
                      </>
                    ) : exitCode === 130 ? (
                      <>
                        <XCircle className="size-3 text-orange-500" />
                        <span className="text-orange-500">命令已停止</span>
                      </>
                    ) : hasError ? (
                      <>
                        <XCircle className="size-3 text-destructive" />
                        <span className="text-destructive">
                          执行失败 {exitCode !== null && `(exit code ${exitCode})`}
                        </span>
                      </>
                    ) : exitCode !== null ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        <span className="text-muted-foreground">执行成功</span>
                      </>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {/* 审批按钮（右下角显示） */}
            {tool.needsApproval && tool.approvalStatus === 'pending' && (
              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50"
                      onClick={() => handleApprovalDecision('reject')}
                    >
                      <X className="size-3" />
                      拒绝
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>停止会话，不执行后续命令</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs hover:bg-muted"
                      onClick={() => handleApprovalDecision('skip')}
                    >
                      <SkipForward className="size-3" />
                      跳过
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>跳过此命令，AI 将继续下一个任务</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      onClick={() => handleApprovalDecision('approve')}
                    >
                      <Play className="size-3" />
                      同意
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>执行此命令</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // 终端风格工具：list_dir / grep / glob_file_search
  if (tool.name === 'list_dir' || tool.name === 'grep' || tool.name === 'glob_file_search') {
    // 获取命令名称（用于标题）
    let commandName = ''
    let fullCommand = ''

    if (tool.name === 'list_dir') {
      commandName = 'ls'
      fullCommand = `ls ${tool.args?.target_directory || '.'}`
    } else if (tool.name === 'grep') {
      commandName = 'grep'
      fullCommand = `grep "${tool.args?.pattern || ''}" ${tool.args?.path || '.'}`
    } else if (tool.name === 'glob_file_search') {
      commandName = 'find'
      fullCommand = `find ${tool.args?.glob_pattern || ''}`
    }

    // 解析输出内容
    let output = ''
    let hasError = tool.isError

    if (tool.result) {
      if (typeof tool.result === 'string') {
        try {
          const parsed = JSON.parse(tool.result)
          if (parsed.stdout !== undefined) {
            output = parsed.stdout + (parsed.stderr ? '\n' + parsed.stderr : '')
            hasError = hasError || parsed.exitCode !== 0
          } else {
            output = tool.result
          }
        } catch {
          output = tool.result
        }
      } else if (typeof tool.result === 'object') {
        output = JSON.stringify(tool.result, null, 2)
      }
    }

    return (
      <div
        className={cn(
          'w-full min-w-0 rounded-lg border overflow-hidden',
          hasError ? 'border-destructive/30' : 'border-border/50',
          className
        )}
      >
        {/* Header - Cursor 风格：Auto-Ran command: xxx */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
          <span className="text-xs text-muted-foreground truncate">
            Auto-Ran command: <span className="text-foreground font-medium">{commandName}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {tool.isLoading ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : hasError ? (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <XCircle className="size-3.5" />
                <span>Failed</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 className="size-3.5" />
                <span>Success</span>
              </span>
            )}
          </div>
        </div>

        {/* 内容区域 - 始终展开，包含命令行和输出 */}
        <div className="bg-background/50 overflow-hidden">
          <div className="max-h-80 overflow-y-auto overflow-x-auto p-3">
            {/* 命令行 - 带 $ 前缀 */}
            <div className="flex items-start gap-2 text-xs font-mono mb-2 whitespace-nowrap">
              <span className="text-amber-500 shrink-0">$</span>
              <span>
                <span className="text-emerald-400">{commandName}</span>
                <span className="text-muted-foreground">
                  {fullCommand.slice(commandName.length)}
                </span>
              </span>
            </div>
            {/* 执行结果 */}
            {output.trim() && (
              <pre
                className={cn(
                  'text-xs font-mono leading-relaxed whitespace-pre',
                  hasError ? 'text-destructive' : 'text-foreground/80'
                )}
              >
                {output.trim()}
              </pre>
            )}
          </div>
        </div>
      </div>
    )
  }

  // delete_file: 删除确认卡片（类似 Cursor）
  if (tool.name === 'delete_file') {
    const filePathForDelete = tool.args?.file_path || tool.args?.target_file

    // Pre-Approval 现在通过 ApprovalDialog 统一处理

    // 已执行完成或失败的删除操作
    const fileName = getFileNameFromPath(filePathForDelete)
    const result = tool.result || {}
    const isDirectory = result.isDirectory || false

    return (
      <div
        className={cn(
          'group rounded-lg border transition-colors',
          tool.isError
            ? 'border-destructive/50 bg-destructive/10 hover:border-destructive'
            : 'border-border/40 bg-muted/10 hover:border-border/80',
          className
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <Trash2
            className={cn(
              'size-3.5 shrink-0',
              tool.isError ? 'text-destructive' : 'text-muted-foreground'
            )}
          />
          <span className="flex-1 text-xs">
            <span className="text-muted-foreground">删除</span>
            <span className="text-foreground font-medium ml-1">{fileName}</span>
            {isDirectory && <span className="text-muted-foreground ml-1">(目录)</span>}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">{getStatusIcon()}</div>
        </div>
      </div>
    )
  }

  // Cursor 风格：已应用的文件编辑，显示简洁状态
  // 不需要在工具卡片中显示 diff（文件已写入磁盘，在底部统一显示 pending edits 卡片）

  // edit_file: Cursor 风格 - 显示代码片段
  if (tool.name === 'edit_file') {
    const filePath = tool.args?.file_path || tool.args?.target_file
    const fileName = getFileNameFromPath(filePath)
    const result = tool.result || {}
    
    // 提取内容
    const { oldContent: oldString, newContent: newString } = extractEditContent(result)
    const hasCodeSnippet = !!(oldString || newString)
    
    // 从 result.stats 获取准确的统计信息（后端已计算）
    const stats = typeof result === 'object' && result.stats ? result.stats : { linesAdded: 0, linesRemoved: 0 }

    return (
      <div
        className={cn(
          'group rounded-lg border transition-colors',
          tool.isError
            ? 'border-destructive/50 bg-destructive/10'
            : 'border-border/50 bg-muted/20 hover:border-border',
          className
        )}
      >
        {/* Header */}
        <button
          onClick={() => hasCodeSnippet && setIsExpanded(!isExpanded)}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
            hasCodeSnippet ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default'
          )}
        >
          {hasCodeSnippet && (
            <ChevronRight
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          )}
          {!hasCodeSnippet && <FileText className="size-3.5 shrink-0 text-muted-foreground" />}

          <span className="flex-1 text-xs flex items-center gap-2">
            <span className="text-foreground font-medium">{fileName}</span>
            {hasCodeSnippet && (stats.linesAdded > 0 || stats.linesRemoved > 0) && (
              <span className="flex items-center gap-1 font-mono text-[11px]">
                {stats.linesAdded > 0 && (
                  <span className="text-green-600 dark:text-green-400">+{stats.linesAdded}</span>
                )}
                {stats.linesRemoved > 0 && (
                  <span className="text-red-600 dark:text-red-400">-{stats.linesRemoved}</span>
                )}
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">{getStatusIcon()}</div>
        </button>

        {/* Expanded Content - Cursor 风格：使用轻量 Diff Viewer */}
        {isExpanded && hasCodeSnippet && (
          <div className="border-t border-border/50">
            <div className="overflow-hidden pb-2">
              <ToolCallDiffViewer
                original={oldString}
                modified={newString}
                language={getLanguageFromFileName(filePath)}
              />
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {isExpanded && tool.isError && tool.result && (
          <div className="px-3 py-2 border-t border-destructive/20 bg-destructive/5">
            <div className="text-xs text-destructive font-mono">
              {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 其他工具 & MCP 工具：统一展示逻辑（Auto-Ran）
  const filePath = tool.args?.file_path || tool.args?.target_file

  // 解析工具名称：MCP 工具格式为 serverName__toolName
  const isMCPTool = tool.name.includes('__')
  const displayToolName = isMCPTool ? tool.name.split('__')[1] : tool.name
  const serverName = isMCPTool ? tool.name.split('__')[0] : null

  const displayTitle = filePath ? getFileNameFromPath(filePath) : displayToolName
  const hasError = tool.isError

  // 解析结果内容
  let resultOutput = ''
  if (tool.result) {
    if (typeof tool.result === 'string') {
      resultOutput = tool.result
    } else {
      resultOutput = JSON.stringify(tool.result, null, 2)
    }
  }

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        'w-full min-w-0 rounded-lg border overflow-hidden',
        hasError ? 'border-destructive/30' : 'border-border/50',
        className
      )}
    >
      {/* Header - Cursor 风格：Auto-Ran tool */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 p-0 hover:bg-background/80 shrink-0"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <span className="text-xs text-muted-foreground truncate">
            Auto-Ran tool: <span className="text-foreground font-medium">{displayTitle}</span>
            {serverName && <span className="text-muted-foreground/60 ml-1">({serverName})</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tool.isLoading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : hasError ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="size-3.5" />
              <span>Failed</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <CheckCircle2 className="size-3.5" />
              <span>Success</span>
            </span>
          )}
        </div>
      </div>

      {/* Content - 可展开查看参数和结果 */}
      <CollapsibleContent>
        <div className="bg-background/50 overflow-hidden px-3 py-3 space-y-3">
          {/* 输入参数 */}
          {tool.args && Object.keys(tool.args).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Parameters:</div>
              <div className="rounded-md bg-muted/50 p-3 border border-border/30">
                <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(tool.args, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* 执行结果 */}
          {resultOutput && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                {hasError ? 'Error:' : 'Result:'}
              </div>
              <div
                className={cn(
                  'rounded-md p-3 border',
                  hasError
                    ? 'bg-destructive/10 border-destructive/30'
                    : 'bg-muted/50 border-border/30'
                )}
              >
                <pre
                  className={cn(
                    'text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto',
                    hasError ? 'text-destructive' : 'text-foreground/80'
                  )}
                >
                  {resultOutput}
                </pre>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
