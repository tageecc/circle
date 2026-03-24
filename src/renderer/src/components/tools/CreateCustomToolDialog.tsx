import { useState, useEffect } from 'react'
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

// 常见工具分类
const TOOL_CATEGORIES = [
  { value: 'Utility', label: '🔧 实用工具' },
  { value: 'Data', label: '📊 数据处理' },
  { value: 'API', label: '🌐 API 调用' },
  { value: 'File', label: '📁 文件操作' },
  { value: 'Text', label: '📝 文本处理' },
  { value: 'Math', label: '🔢 数学计算' },
  { value: 'Network', label: '🌍 网络请求' },
  { value: 'Database', label: '💾 数据库' },
  { value: 'AI', label: '🤖 AI 工具' },
  { value: 'Automation', label: '⚡ 自动化' },
  { value: 'Other', label: '📦 其他' }
]

// 代码模板
const CODE_TEMPLATES = {
  basic: {
    name: '基础模板',
    description: '简单的输入输出示例',
    parameters: `{
  "type": "object",
  "properties": {
    "input": {
      "type": "string",
      "description": "输入内容"
    }
  },
  "required": ["input"]
}`,
    code: `// 参数通过 params 对象传入
const { input } = params

// 执行你的逻辑
const result = input.toUpperCase()

// 返回结果
return result`
  },
  api: {
    name: 'API 调用',
    description: 'HTTP 请求示例',
    parameters: `{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "API URL"
    },
    "method": {
      "type": "string",
      "enum": ["GET", "POST"],
      "description": "请求方法"
    }
  },
  "required": ["url"]
}`,
    code: `// 使用 fetch 进行 API 调用（异步函数）
return (async () => {
  const { url, method = 'GET' } = params

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    return data
  } catch (error) {
    throw new Error(\`API 请求失败: \${error.message}\`)
  }
})()`
  },
  dataProcess: {
    name: '数据处理',
    description: 'JSON 数据转换示例',
    parameters: `{
  "type": "object",
  "properties": {
    "data": {
      "type": "array",
      "description": "要处理的数据数组"
    },
    "operation": {
      "type": "string",
      "enum": ["filter", "map", "reduce"],
      "description": "操作类型"
    }
  },
  "required": ["data", "operation"]
}`,
    code: `// 数据处理示例
const { data, operation } = params

switch (operation) {
  case 'filter':
    // 过滤数据
    return data.filter(item => item.active === true)
    
  case 'map':
    // 转换数据
    return data.map(item => ({
      id: item.id,
      name: item.name
    }))
    
  case 'reduce':
    // 聚合数据
    return data.reduce((acc, item) => acc + item.value, 0)
    
  default:
    throw new Error('未知操作类型')
}`
  }
}

// 草稿存储 key
const DRAFT_KEY = 'custom_tool_draft'
const DRAFT_TIMESTAMP_KEY = 'custom_tool_draft_timestamp'

export function CreateCustomToolDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit
}: CreateCustomToolDialogProps) {
  const confirm = useConfirm()
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark')
  const [parametersError, setParametersError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  // 监听主题变化
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

  // 检查是否有草稿
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY)
    setHasDraft(!!draft)
  }, [open])

  // 自动保存草稿
  useEffect(() => {
    if (!open) return undefined

    const hasContent =
      formData.name ||
      formData.description ||
      formData.code ||
      (formData.parameters && formData.parameters !== '{}')

    if (hasContent) {
      setHasUnsavedChanges(true)

      // 防抖保存
      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
        localStorage.setItem(DRAFT_TIMESTAMP_KEY, new Date().toISOString())
      }, 1000)

      return () => clearTimeout(timer)
    }

    return undefined
  }, [formData, open])

  // 验证 Parameters JSON
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

  // 验证代码语法
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

  const applyTemplate = (template: typeof CODE_TEMPLATES.basic) => {
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
        title: '未保存的更改',
        description: '您有未保存的更改，关闭后将自动保存为草稿。是否继续？',
        confirmText: '继续',
        cancelText: '取消'
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

    if (days > 0) return `${days} 天前`
    if (hours > 0) return `${hours} 小时前`
    if (minutes > 0) return `${minutes} 分钟前`
    return '刚刚'
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
                <DialogTitle className="text-2xl">创建自定义工具</DialogTitle>
                <DialogDescription className="text-sm mt-1.5">
                  使用 JavaScript 编写强大的自定义工具，降低开发门槛
                </DialogDescription>
              </div>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1">
                  <Save className="size-3.5" />
                  自动保存
                </Badge>
              )}
            </div>

            {/* 草稿提示 */}
            {hasDraft && (
              <div className="flex items-center justify-between p-3.5 mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="size-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      发现未完成的草稿
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      上次编辑：{getDraftTime()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearDraft} className="gap-1.5">
                    <Trash2 className="size-3.5" />
                    删除
                  </Button>
                  <Button size="sm" onClick={loadDraft}>
                    恢复草稿
                  </Button>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* 左右分栏布局 */}
          <div className="flex-1 flex gap-6 px-6 py-5 overflow-hidden min-h-0">
            {/* 左侧配置区 */}
            <div className="w-[40%] flex flex-col gap-4 overflow-y-auto pr-3 min-h-0">
              {/* 基本信息 */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base">基本信息</h3>
                </div>

                {/* 工具名称和分类 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Label className="text-sm font-medium">工具名称 *</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>使用小写字母和下划线，例如: my_calculator</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      placeholder="例如: my_calculator"
                      value={formData.name}
                      onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="w-[125px]">
                    <Label className="text-sm font-medium mb-2 block">分类</Label>
                    <Select
                      value={formData.category || 'Utility'}
                      onValueChange={(value) => onFormDataChange({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {TOOL_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Label className="text-sm font-medium">工具描述 *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>帮助 AI 理解何时使用这个工具</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    placeholder="简要描述此工具的功能"
                    value={formData.description}
                    onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <Separator className="my-2" />

              {/* 参数定义 */}
              <div className="flex-1 flex flex-col gap-3.5 min-h-[300px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Code className="size-4 text-purple-500" />
                    </div>
                    <h3 className="font-semibold text-base">参数定义</h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>使用 JSON Schema 格式定义工具参数</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* 模板按钮 */}
                  <div className="flex items-center gap-1.5">
                    {Object.entries(CODE_TEMPLATES).map(([key, template]) => (
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
                      <p className="font-medium text-red-500">JSON 格式错误</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{parametersError}</p>
                    </div>
                  </div>
                )}

                {!parametersError && formData.parameters.trim() && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <p className="text-xs text-green-600 dark:text-green-400">参数定义格式正确</p>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧代码编辑区 */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Code className="size-4 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-base">代码实现</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>参数通过 params 对象传入，使用 return 返回结果</p>
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
                    <p className="font-medium text-red-500">代码语法错误</p>
                    <p className="text-muted-foreground mt-0.5">{codeError}</p>
                  </div>
                </div>
              )}

              {!codeError && formData.code.trim() && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="size-3.5 text-green-500" />
                  <p className="text-xs text-green-600 dark:text-green-400">代码语法检查通过</p>
                </div>
              )}
            </div>
          </div>

          {/* 底部固定按钮栏 */}
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
                      <span className="font-medium">工具配置完成</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4" />
                      <span>请填写必填字段</span>
                    </>
                  )}
                </div>
                {isValid && <p className="text-xs text-muted-foreground">可以创建工具了</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleClose}>
                  取消
                </Button>
                <Button onClick={handleSubmit} disabled={!isValid} className="gap-2" size="default">
                  <Plus className="size-4" />
                  创建工具
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  )
}
