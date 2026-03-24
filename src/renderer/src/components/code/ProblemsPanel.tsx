import { useState, useEffect, useMemo } from 'react'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Diagnostic {
  filePath: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info'
  message: string
  source: string
  code?: string | number
}

interface ProblemsPanelProps {
  diagnostics: Diagnostic[]
  onDiagnosticClick?: (diagnostic: Diagnostic) => void
  onClose?: () => void
}

export function ProblemsPanel({ diagnostics, onDiagnosticClick, onClose }: ProblemsPanelProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  const groupedDiagnostics = useMemo(() => {
    return diagnostics.reduce(
      (acc, diagnostic) => {
        const fileName = diagnostic.filePath.split('/').pop() || diagnostic.filePath
        if (!acc[fileName]) {
          acc[fileName] = []
        }
        acc[fileName].push(diagnostic)
        return acc
      },
      {} as Record<string, Diagnostic[]>
    )
  }, [diagnostics])

  const filteredDiagnostics = useMemo(() => {
    return Object.entries(groupedDiagnostics).reduce(
      (acc, [fileName, items]) => {
        const filtered = items.filter(
          (d) => filterSeverity === 'all' || d.severity === filterSeverity
        )
        if (filtered.length > 0) {
          acc[fileName] = filtered
        }
        return acc
      },
      {} as Record<string, Diagnostic[]>
    )
  }, [groupedDiagnostics, filterSeverity])

  useEffect(() => {
    const fileNames = Object.keys(filteredDiagnostics)
    setExpandedFiles((prev) => {
      const prevFiles = Array.from(prev).sort().join(',')
      const newFiles = fileNames.sort().join(',')

      // 只有在文件列表真正变化时才更新
      if (prevFiles === newFiles) {
        return prev
      }

      return new Set(fileNames)
    })
  }, [filteredDiagnostics])

  const toggleFile = (fileName: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileName)) {
        next.delete(fileName)
      } else {
        next.add(fileName)
      }
      return next
    })
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="size-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="size-4 text-yellow-500" />
      case 'info':
        return <Info className="size-4 text-blue-500" />
      default:
        return null
    }
  }

  const counts = useMemo(
    () => ({
      error: diagnostics.filter((d) => d.severity === 'error').length,
      warning: diagnostics.filter((d) => d.severity === 'warning').length,
      info: diagnostics.filter((d) => d.severity === 'info').length
    }),
    [diagnostics]
  )

  return (
    <div className="flex h-full flex-col border-t border-border/30 bg-background">
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">问题</span>

          <div className="flex items-center gap-2 text-xs">
            <button
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded hover:bg-accent',
                filterSeverity === 'all' && 'bg-accent'
              )}
              onClick={() => setFilterSeverity('all')}
            >
              <span>全部 ({diagnostics.length})</span>
            </button>

            <button
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded hover:bg-accent',
                filterSeverity === 'error' && 'bg-accent'
              )}
              onClick={() => setFilterSeverity('error')}
            >
              <AlertCircle className="size-3 text-red-500" />
              <span>{counts.error}</span>
            </button>

            <button
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded hover:bg-accent',
                filterSeverity === 'warning' && 'bg-accent'
              )}
              onClick={() => setFilterSeverity('warning')}
            >
              <AlertTriangle className="size-3 text-yellow-500" />
              <span>{counts.warning}</span>
            </button>

            <button
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded hover:bg-accent',
                filterSeverity === 'info' && 'bg-accent'
              )}
              onClick={() => setFilterSeverity('info')}
            >
              <Info className="size-3 text-blue-500" />
              <span>{counts.info}</span>
            </button>
          </div>
        </div>

        {onClose && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {Object.keys(filteredDiagnostics).length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {filterSeverity === 'all'
              ? '没有发现问题'
              : `没有发现${filterSeverity === 'error' ? '错误' : filterSeverity === 'warning' ? '警告' : '信息'}`}
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(filteredDiagnostics).map(([fileName, items]) => (
              <div key={fileName} className="mb-2">
                <button
                  className="flex w-full items-center gap-1 px-2 py-1 text-sm hover:bg-accent rounded"
                  onClick={() => toggleFile(fileName)}
                >
                  {expandedFiles.has(fileName) ? (
                    <ChevronDown className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" />
                  )}
                  <span className="font-medium">{fileName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {items.length} 个问题
                  </span>
                </button>

                {expandedFiles.has(fileName) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {items.map((diagnostic, index) => (
                      <button
                        key={index}
                        className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                        onClick={() => onDiagnosticClick?.(diagnostic)}
                      >
                        {getSeverityIcon(diagnostic.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {diagnostic.message}
                            {diagnostic.code && (
                              <span className="ml-1 text-muted-foreground">
                                ({diagnostic.code})
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-muted-foreground">
                            [{diagnostic.line}, {diagnostic.column}] {diagnostic.source}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
