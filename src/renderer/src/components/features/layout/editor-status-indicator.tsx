import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Circle, Check, FileText, Hash, Type, FolderOpen } from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { useEditor } from '@/contexts/editor-context'

export function EditorStatusIndicator() {
  const { t } = useTranslation()
  const { activeFile, cursorPosition, language, fileEncoding, lineEnding, fileManager } =
    useEditor()

  const [showEncodingMenu, setShowEncodingMenu] = useState(false)
  const [showLineEndingMenu, setShowLineEndingMenu] = useState(false)

  const encodings = ['UTF-8', 'UTF-8 with BOM', 'UTF-16 LE', 'UTF-16 BE', 'GBK', 'GB2312']
  const lineEndings: Array<'LF' | 'CRLF' | 'CR'> = ['LF', 'CRLF', 'CR']
  const lineEndingLabels = useMemo(
    () => ({
      LF: t('editor_status.line_ending_unix'),
      CRLF: t('editor_status.line_ending_windows'),
      CR: t('editor_status.line_ending_classic_mac')
    }),
    [t]
  )

  // 处理编码更改（VSCode 风格：区分预览和保存）
  const handleSetFileEncoding = useCallback(
    async (action: 'reopen' | 'save-as', encoding: string) => {
      if (!activeFile || encoding === fileEncoding) {
        return
      }

      try {
        if (action === 'reopen') {
          await fileManager.reopenFileWithEncoding(activeFile, encoding)
          toast.success(
            <div className="flex flex-col gap-1">
              <div className="font-medium">
                {t('editor_status.reopened_with_encoding', { encoding })}
              </div>
              <div className="text-xs text-muted-foreground">{t('editor_status.reopen_save_hint')}</div>
            </div>
          )
        } else if (action === 'save-as') {
          fileManager.setFileSaveEncoding(activeFile, encoding)
          toast.success(
            <div className="flex flex-col gap-1">
              <div className="font-medium">
                {t('editor_status.set_save_encoding_title', { encoding })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('editor_status.save_will_use_encoding', { encoding })}
              </div>
            </div>
          )
        }
      } catch (error) {
        toast.error(t('editor_status.open_encoding_failed', { encoding }))
      }
    },
    [activeFile, fileEncoding, fileManager, t]
  )

  // 处理行尾符更改（立即转换）
  const handleSetLineEnding = useCallback(
    (ending: 'LF' | 'CRLF' | 'CR') => {
      if (activeFile) {
        fileManager.updateFileLineEnding(activeFile, ending)
        toast.success(t('editor_status.line_ending_converted', { ending }))
      }
    },
    [activeFile, fileManager, t]
  )

  // 在文件管理器中显示文件
  const handleRevealInFinder = useCallback(async () => {
    if (!activeFile) return

    try {
      await window.api.files.revealInFinder?.(activeFile)
    } catch (error) {
      toast.error(t('editor_status.reveal_in_finder_failed'), {
        description: error instanceof Error ? error.message : t('errors.unknown_error')
      })
    }
  }, [activeFile, t])

  const languageDisplayName = useCallback((lang: string): string => {
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
  }, [])

  // 判断是否支持 LSP
  const hasLanguageService = useMemo(() => {
    const supportedLanguages = [
      'typescript',
      'typescriptreact',
      'javascript',
      'javascriptreact',
      'css',
      'scss',
      'less',
      'html',
      'json',
      'yaml',
      'markdown'
    ]
    return supportedLanguages.includes(language)
  }, [language])

  // 获取当前文件信息
  const currentFile = useMemo(() => {
    if (!activeFile) return null
    const file = fileManager.getCurrentFile()
    return file
  }, [activeFile, fileManager])

  // 计算文件统计信息
  const fileStats = useMemo(() => {
    if (!currentFile || !activeFile) return null

    const content = currentFile.content
    const bytes = new Blob([content]).size

    // 行数和字符数
    const lines = content.split('\n').length
    const chars = content.length

    // 文件大小格式化
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }

    // 获取文件名
    const fileName = currentFile.name

    return {
      fileName,
      size: formatSize(bytes),
      bytes,
      lines,
      chars,
      isDirty: currentFile.isDirty
    }
  }, [currentFile, activeFile])

  if (!activeFile) return null

  return (
    <>
      {/* 语言模式 */}
      {hasLanguageService ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs hover:bg-accent/50"
              title={t('editor_status.language_service')}
            >
              <Circle className="size-2 fill-green-500 text-green-500" />
              <span className="text-muted-foreground">{languageDisplayName(language)}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5">
              <div className="text-xs font-semibold mb-2">
                {t('editor_status.running_language_services')}
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
      ) : (
        <div className="px-2 text-xs text-muted-foreground">{languageDisplayName(language)}</div>
      )}

      {/* 文件编码（VSCode 风格交互） */}
      <DropdownMenu open={showEncodingMenu} onOpenChange={setShowEncodingMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-accent/50"
            title={t('editor_status.change_encoding')}
          >
            <span className="text-muted-foreground">{fileEncoding}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <div className="text-xs font-semibold mb-1">
              {t('editor_status.change_encoding_heading')}
            </div>
          </div>
          <DropdownMenuSeparator />

          {/* 用编码重新打开（只改变显示） */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <div className="flex flex-col items-start">
                <span>{t('editor_status.reopen_with_encoding')}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t('editor_status.reopen_with_encoding_hint')}
                </span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {encodings.map((enc) => (
                  <DropdownMenuItem
                    key={enc}
                    className="text-xs"
                    onClick={() => {
                      handleSetFileEncoding('reopen', enc)
                      setShowEncodingMenu(false)
                    }}
                  >
                    <Check
                      className={fileEncoding === enc ? 'size-3 mr-2' : 'size-3 mr-2 opacity-0'}
                    />
                    {enc}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* 保存为编码（下次保存时转换） */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <div className="flex flex-col items-start">
                <span>{t('editor_status.save_with_encoding')}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t('editor_status.save_with_encoding_hint')}
                </span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {encodings.map((enc) => (
                  <DropdownMenuItem
                    key={enc}
                    className="text-xs"
                    onClick={() => {
                      handleSetFileEncoding('save-as', enc)
                      setShowEncodingMenu(false)
                    }}
                  >
                    <Check
                      className={fileEncoding === enc ? 'size-3 mr-2' : 'size-3 mr-2 opacity-0'}
                    />
                    {enc}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 行尾符（立即转换） */}
      <DropdownMenu open={showLineEndingMenu} onOpenChange={setShowLineEndingMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-accent/50"
            title={t('editor_status.select_line_ending_tooltip')}
          >
            <span className="text-muted-foreground">{lineEnding}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <div className="text-xs font-semibold mb-1">{t('editor_status.select_line_ending')}</div>
            <div className="text-[10px] text-muted-foreground">
              {t('editor_status.line_ending_convert_now')}
            </div>
          </div>
          <DropdownMenuSeparator />
          {lineEndings.map((ending) => (
            <DropdownMenuItem
              key={ending}
              className="text-xs"
              onClick={() => {
                handleSetLineEnding(ending)
                setShowLineEndingMenu(false)
              }}
            >
              <Check className={lineEnding === ending ? 'size-3 mr-2' : 'size-3 mr-2 opacity-0'} />
              {ending}
              <span className="ml-auto text-muted-foreground text-[10px]">
                {lineEndingLabels[ending]}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 光标位置（可点击跳转到行） */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs font-mono hover:bg-accent/50"
        title={t('editor_status.goto_line_col')}
      >
        <span className="text-muted-foreground">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
      </Button>

      {/* 文件统计信息 */}
      {fileStats && (
        <TooltipProvider delayDuration={300}>
          <Tooltip disableHoverableContent={false}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-accent/50">
                <FileText className="size-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="w-64 p-0">
              <div className="p-3">
                {/* 文件名 */}
                <div className="flex items-start gap-2 pb-2 mb-2 border-b border-border/50">
                  <FileText className="size-4 shrink-0 mt-0.5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{fileStats.fileName}</div>
                    {fileStats.isDirty && (
                      <div className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">
                        {t('editor_status.unsaved_modifications')}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={handleRevealInFinder}
                    title={t('editor_status.show_in_file_manager')}
                  >
                    <FolderOpen className="size-3.5" />
                  </Button>
                </div>

                {/* 统计信息 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="size-3" />
                      <span>{t('editor_status.stat_file_size')}</span>
                    </div>
                    <span className="font-mono text-xs font-medium">{fileStats.size}</span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash className="size-3" />
                      <span>{t('editor_status.stat_lines')}</span>
                    </div>
                    <span className="font-mono text-xs font-medium">
                      {fileStats.lines.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Type className="size-3" />
                      <span>{t('editor_status.stat_chars')}</span>
                    </div>
                    <span className="font-mono text-xs font-medium">
                      {fileStats.chars.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  )
}
