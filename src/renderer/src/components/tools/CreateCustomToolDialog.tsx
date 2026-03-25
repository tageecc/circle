import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useConfirm } from '../shared/ConfirmProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { MonacoCodeEditor } from '../code/MonacoCodeEditor'
import type { EditorSettings } from '@/contexts/SettingsContext'
import {
  Plus,
  Code,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Save,
  Trash2,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateCustomToolDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: {
    name: string
    description: string
    category: string
    parameters: string
    code: string
  }
  onFormDataChange: (data: {
    name: string
    description: string
    category: string
    parameters: string
    code: string
  }) => void
  onSubmit: () => void
}

type CodeTemplate = {
  name: string
  description: string
  parameters: string
  code: string
}

const TOOL_CATEGORY_VALUES = [
  'Utility',
  'Data',
  'API',
  'File',
  'Text',
  'Math',
  'Network',
  'Database',
  'AI',
  'Automation',
  'Other'
] as const

const DRAFT_KEY = 'custom_tool_draft'
const DRAFT_TIMESTAMP_KEY = 'custom_tool_draft_timestamp'

export function CreateCustomToolDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit
}: CreateCustomToolDialogProps) {
  const { t } = useTranslation('tools')
  const { t: tc } = useTranslation('common')
  const confirm = useConfirm()

  const codeTemplates = useMemo<Record<'basic' | 'api' | 'dataProcess', CodeTemplate>>(
    () => ({
      basic: {
        name: t('customToolCreate.templates.basic.name'),
        description: t('customToolCreate.templates.basic.description'),
        parameters: t('customToolCreate.templates.basic.parameters'),
        code: t('customToolCreate.templates.basic.code')
      },
      api: {
        name: t('customToolCreate.templates.api.name'),
        description: t('customToolCreate.templates.api.description'),
        parameters: t('customToolCreate.templates.api.parameters'),
        code: t('customToolCreate.templates.api.code')
      },
      dataProcess: {
        name: t('customToolCreate.templates.dataProcess.name'),
        description: t('customToolCreate.templates.dataProcess.description'),
        parameters: t('customToolCreate.templates.dataProcess.parameters'),
        code: t('customToolCreate.templates.dataProcess.code')
      }
    }),
    [t]
  )

  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark')
  const [parametersError, setParametersError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'vs-dark' : 'light')
    }

    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY)
    setHasDraft(!!draft)
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const hasContent =
      formData.name ||
      formData.description ||
      formData.code ||
      (formData.parameters && formData.parameters !== '{}')

    if (hasContent) {
      setHasUnsavedChanges(true)

      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
        localStorage.setItem(DRAFT_TIMESTAMP_KEY, new Date().toISOString())
      }, 1000)

      return () => clearTimeout(timer)
    }

    return undefined
  }, [formData, open])

  useEffect(() => {
    if (!formData.parameters.trim()) {
      setParametersError(null)
      return
    }

    try {
      JSON.parse(formData.parameters)
      setParametersError(null)
    } catch (error) {
      setParametersError((error as Error).message)
    }
  }, [formData.parameters])

  useEffect(() => {
    if (!formData.code.trim()) {
      setCodeError(null)
      return
    }

    try {
      new Function('params', formData.code)
      setCodeError(null)
    } catch (error) {
      setCodeError((error as Error).message)
    }
  }, [formData.code])

  const applyTemplate = (template: CodeTemplate) => {
    onFormDataChange({
      ...formData,
      parameters: template.parameters,
      code: template.code
    })
  }

  const loadDraft = () => {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (draft) {
      try {
        const draftData = JSON.parse(draft)
        onFormDataChange(draftData)
        setHasDraft(false)
      } catch (error) {
        console.error('Failed to load draft:', error)
      }
    }
  }

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    localStorage.removeItem(DRAFT_TIMESTAMP_KEY)
    setHasDraft(false)
    setHasUnsavedChanges(false)
  }

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: t('customToolCreate.unsavedTitle'),
        description: t('customToolCreate.unsavedDescription'),
        confirmText: t('customToolCreate.continue'),
        cancelText: tc('button.cancel')
      })
      if (!confirmed) return
    }
    onOpenChange(false)
  }

  const handleSubmit = () => {
    onSubmit()
    clearDraft()
  }

  const isValid =
    formData.name.trim() &&
    formData.description.trim() &&
    !parametersError &&
    !codeError &&
    formData.code.trim()

  const getDraftTime = () => {
    const timestamp = localStorage.getItem(DRAFT_TIMESTAMP_KEY)
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return t('customToolCreate.draftTime.daysAgo', { count: days })
    if (hours > 0) return t('customToolCreate.draftTime.hoursAgo', { count: hours })
    if (minutes > 0) return t('customToolCreate.draftTime.minutesAgo', { count: minutes })
    return t('customToolCreate.draftTime.justNow')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <TooltipProvider>
        <DialogContent
          className="max-w-[95vw]! w-[95vw]! h-[95vh] max-h-[95vh]! flex flex-col p-0 gap-0"
          showCloseButton={false}
        >
          <DialogHeader className="border-b shrink-0 pb-4 pt-5 px-6">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">{t('customToolCreate.title')}</DialogTitle>
                <DialogDescription className="text-sm mt-1.5">
                  {t('customToolCreate.subtitle')}
                </DialogDescription>
              </div>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1">
                  <Save className="size-3.5" />
                  {t('customToolCreate.autoSave')}
                </Badge>
              )}
            </div>

            {hasDraft && (
              <div className="flex items-center justify-between p-3.5 mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="size-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {t('customToolCreate.draftFound')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('customToolCreate.lastEdited', { time: getDraftTime() })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearDraft} className="gap-1.5">
                    <Trash2 className="size-3.5" />
                    {tc('button.delete')}
                  </Button>
                  <Button size="sm" onClick={loadDraft}>
                    {t('customToolCreate.restoreDraft')}
                  </Button>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 flex gap-6 px-6 py-5 overflow-hidden min-h-0">
            <div className="w-[40%] flex flex-col gap-4 overflow-y-auto pr-3 min-h-0">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base">{t('customToolCreate.basicInfo')}</h3>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Label className="text-sm font-medium">
                        {t('customToolCreate.toolNameRequired')}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('customToolCreate.toolNameHint')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      placeholder={t('customToolCreate.toolNamePlaceholder')}
                      value={formData.name}
                      onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="w-[125px]">
                    <Label className="text-sm font-medium mb-2 block">
                      {t('customToolCreate.category')}
                    </Label>
                    <Select
                      value={formData.category || 'Utility'}
                      onValueChange={(value) => onFormDataChange({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('customToolCreate.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TOOL_CATEGORY_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`customToolCreate.categories.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Label className="text-sm font-medium">
                      {t('customToolCreate.toolDescriptionRequired')}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('customToolCreate.toolDescriptionHint')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    placeholder={t('customToolCreate.toolDescriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <Separator className="my-2" />

              <div className="flex-1 flex flex-col gap-3.5 min-h-[300px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Code className="size-4 text-purple-500" />
                    </div>
                    <h3 className="font-semibold text-base">
                      {t('customToolCreate.parametersSection')}
                    </h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('customToolCreate.parametersHint')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {Object.entries(codeTemplates).map(([key, template]) => (
                      <Button
                        key={key}
                        variant="ghost"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                        className="gap-1 h-7 px-2 text-xs"
                      >
                        <Sparkles className="size-3" />
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 border rounded-lg overflow-hidden shadow-sm">
                  <MonacoCodeEditor
                    value={formData.parameters}
                    language="json"
                    height="100%"
                    readOnly={false}
                    enableLanguageService={false}
                    enableGitBlame={false}
                    theme={theme === 'vs-dark' ? 'one-dark-pro' : 'one-light'}
                    editorSettings={
                      {
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        minimap: false,
                        lineNumbers: true,
                        wordWrap: true,
                        tabSize: 2
                      } as Partial<EditorSettings>
                    }
                    onChange={(value) => onFormDataChange({ ...formData, parameters: value || '' })}
                  />
                </div>

                {parametersError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-red-500">
                        {t('customToolCreate.jsonInvalid')}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{parametersError}</p>
                    </div>
                  </div>
                )}

                {!parametersError && formData.parameters.trim() && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {t('customToolCreate.parametersValid')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 min-h-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Code className="size-4 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-base">{t('customToolCreate.codeSection')}</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('customToolCreate.codeHint')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1.5">
                  {codeError && <AlertCircle className="size-4 text-red-500" />}
                  {!codeError && formData.code.trim() && (
                    <CheckCircle2 className="size-4 text-green-500" />
                  )}
                </div>
              </div>

              <div className="flex-1 border rounded-lg overflow-hidden shadow-sm">
                <MonacoCodeEditor
                  value={formData.code}
                  language="javascript"
                  height="100%"
                  readOnly={false}
                  enableLanguageService={false}
                  enableGitBlame={false}
                  theme={theme === 'vs-dark' ? 'one-dark-pro' : 'one-light'}
                  editorSettings={
                    {
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      minimap: true,
                      lineNumbers: true,
                      wordWrap: true,
                      tabSize: 2
                    } as Partial<EditorSettings>
                  }
                  onChange={(value) => onFormDataChange({ ...formData, code: value || '' })}
                />
              </div>

              {codeError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="size-3.5 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-red-500">
                      {t('customToolCreate.codeSyntaxError')}
                    </p>
                    <p className="text-muted-foreground mt-0.5">{codeError}</p>
                  </div>
                </div>
              )}

              {!codeError && formData.code.trim() && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="size-3.5 text-green-500" />
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {t('customToolCreate.codeSyntaxOk')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t shrink-0 px-6 py-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md',
                    isValid
                      ? 'text-green-600 dark:text-green-400 bg-green-500/10'
                      : 'text-muted-foreground bg-muted'
                  )}
                >
                  {isValid ? (
                    <>
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">
                        {t('customToolCreate.validationComplete')}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4" />
                      <span>{t('customToolCreate.validationIncomplete')}</span>
                    </>
                  )}
                </div>
                {isValid && (
                  <p className="text-xs text-muted-foreground">
                    {t('customToolCreate.readyToCreate')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleClose}>
                  {tc('button.cancel')}
                </Button>
                <Button onClick={handleSubmit} disabled={!isValid} className="gap-2" size="default">
                  <Plus className="size-4" />
                  {t('customToolCreate.createTool')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  )
}
