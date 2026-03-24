import { useState, useEffect, useRef } from 'react'
import { Settings, Palette, Monitor, Keyboard, Code, Bot, Wrench } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../ui/breadcrumb'
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '../ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { toast } from 'sonner'
import { useSettings } from '../../contexts/SettingsContext'
import { MonacoCodeEditor } from '../code/MonacoCodeEditor'
import { KeymapSettingsContent } from '../settings/KeymapSettingsContent'
import { ToolsView } from '../tools/ToolsView'
import type {
  EditorSettings,
  TerminalSettings,
  AppearanceSettings,
  GeneralSettings
} from '../../contexts/SettingsContext'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NAV_ITEMS = [
  { name: '通用', icon: Settings, key: 'general' },
  { name: '模型', icon: Bot, key: 'model' },
  { name: 'MCP & Tools', icon: Wrench, key: 'mcp-tools' },
  { name: '外观', icon: Palette, key: 'appearance' },
  { name: '编辑器', icon: Code, key: 'editor' },
  { name: '终端', icon: Monitor, key: 'terminal' },
  { name: '快捷键', icon: Keyboard, key: 'keyboard' }
]

// 字体选择器组件
function FontSelector({
  value,
  onValueChange,
  fonts
}: {
  value: string
  onValueChange: (value: string) => void
  fonts: string[]
}) {
  // 内置字体（已打包到应用中，始终可用）
  const builtInFonts = ['JetBrains Mono', 'Source Code Pro']

  // 推荐的等宽字体（按优先级排序）
  const recommendedMonospaceFonts = [
    'JetBrains Mono',
    'Source Code Pro',
    'Monaco',
    'Menlo',
    'Consolas',
    'Fira Code',
    'SF Mono',
    'Cascadia Code',
    'Courier New',
    'Ubuntu Mono',
    'Roboto Mono'
  ]

  // 合并内置字体和系统字体，去重
  const allAvailableFonts = Array.from(new Set([...builtInFonts, ...fonts]))

  // 筛选出推荐字体（保持推荐列表的顺序）
  const popularFonts = recommendedMonospaceFonts.filter((font) => allAvailableFonts.includes(font))

  // 其他字体（不在推荐列表中的系统字体）
  const otherFonts = allAvailableFonts.filter((font) => !recommendedMonospaceFonts.includes(font))

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="选择字体">{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {popularFonts.length > 0 && (
          <SelectGroup>
            <SelectLabel>推荐等宽字体</SelectLabel>
            {popularFonts.map((font) => (
              <SelectItem key={font} value={font}>
                {font}
                {builtInFonts.includes(font) && (
                  <span className="ml-2 text-xs text-muted-foreground">• 内置</span>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {otherFonts.length > 0 && (
          <SelectGroup>
            <SelectLabel>其他字体</SelectLabel>
            {otherFonts.map((font) => (
              <SelectItem key={font} value={font}>
                {font}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState('general')
  const settings = useSettings()

  // 本地状态用于编辑
  const [localEditorSettings, setLocalEditorSettings] = useState<EditorSettings>(
    settings.editorSettings
  )
  const [localTerminalSettings, setLocalTerminalSettings] = useState<TerminalSettings>(
    settings.terminalSettings
  )
  const [localAppearanceSettings, setLocalAppearanceSettings] = useState<AppearanceSettings>(
    settings.appearanceSettings
  )
  const [localGeneralSettings, setLocalGeneralSettings] = useState<GeneralSettings>(
    settings.generalSettings
  )
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null)
  const [localModelSettings, setLocalModelSettings] = useState<{
    provider: string
    model: string
    instructions: string
  }>({ provider: 'openai', model: 'gpt-4o', instructions: '' })
  const [localEmbeddingSettings, setLocalEmbeddingSettings] = useState<{
    provider: 'openai' | 'dashscope'
    model: string
    apiKey: string
  }>({ provider: 'dashscope', model: 'text-embedding-v4', apiKey: '' })
  const [localSearchSettings, setLocalSearchSettings] = useState<{ bingApiKey: string }>({
    bingApiKey: ''
  })
  /** AI 行内补全（FIM）；未填 provider/model 则使用默认助手 */
  const [localCompletionSettings, setLocalCompletionSettings] = useState<{
    enabled: boolean
    enableValidation: boolean
    provider: string
    model: string
    apiKey: string
  }>({
    enabled: true,
    enableValidation: false,
    provider: '',
    model: '',
    apiKey: ''
  })
  /** 存于用户表 preferences.aiUserRules，注入 Agent 上下文的 &lt;user_rules&gt; */
  const [localAiUserRules, setLocalAiUserRules] = useState('')

  // 系统字体列表
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  // 重置确认 Popover 状态
  const [resetPopoverOpen, setResetPopoverOpen] = useState(false)

  // 加载默认助手与代码库索引 Embedding 设置
  useEffect(() => {
    if (!open) return
    window.api.agents
      .getDefault()
      .then(
        (agent: { id: string; provider: string; model: string; instructions?: string | null }) => {
          setDefaultAgentId(agent.id)
          setLocalModelSettings({
            provider: agent.provider || 'openai',
            model: agent.model || 'gpt-4o',
            instructions: agent.instructions ?? ''
          })
        }
      )
      .catch(console.error)
    window.api.config
      .get()
      .then(
        (config: {
          embeddingSettings?: { provider?: string; model?: string; apiKey?: string }
          searchSettings?: { bingApiKey?: string }
          completionSettings?: {
            enabled?: boolean
            enableValidation?: boolean
            provider?: string
            model?: string
            apiKey?: string
          }
        }) => {
          const e = config.embeddingSettings
          if (e) {
            setLocalEmbeddingSettings({
              provider: (e.provider === 'openai' ? 'openai' : 'dashscope') as
                | 'openai'
                | 'dashscope',
              model: e.model ?? 'text-embedding-v4',
              apiKey: e.apiKey ?? ''
            })
          }
          const s = config.searchSettings
          if (s) {
            setLocalSearchSettings({ bingApiKey: s.bingApiKey ?? '' })
          }
          const comp = config.completionSettings
          if (comp) {
            setLocalCompletionSettings({
              enabled: comp.enabled !== false,
              enableValidation: comp.enableValidation === true,
              provider: comp.provider ?? '',
              model: comp.model ?? '',
              apiKey: comp.apiKey ?? ''
            })
          } else {
            setLocalCompletionSettings({
              enabled: true,
              enableValidation: false,
              provider: '',
              model: '',
              apiKey: ''
            })
          }
        }
      )
      .catch(console.error)

    window.api.auth
      .getCurrentUser()
      .then((res) => {
        if (!res.success || !res.user?.preferences) return
        try {
          const p = JSON.parse(res.user.preferences) as Record<string, unknown>
          const raw = p.aiUserRules
          setLocalAiUserRules(typeof raw === 'string' ? raw : '')
        } catch {
          setLocalAiUserRules('')
        }
      })
      .catch(() => setLocalAiUserRules(''))
  }, [open])

  // 获取系统字体列表（仅在对话框打开时加载）
  useEffect(() => {
    if (!open) return

    const loadFonts = async () => {
      try {
        const fonts = await window.api.system.getFonts()
        setSystemFonts(fonts)
      } catch (error) {
        console.error('Failed to load system fonts:', error)
        setSystemFonts([
          'JetBrains Mono',
          'Monaco',
          'Consolas',
          'Courier New',
          'Fira Code',
          'Source Code Pro',
          'Menlo',
          'SF Mono',
          'Ubuntu Mono'
        ])
      }
    }
    loadFonts()
  }, [open])

  // 当对话框打开时，同步最新的设置
  useEffect(() => {
    if (open) {
      setLocalEditorSettings(settings.editorSettings)
      setLocalTerminalSettings(settings.terminalSettings)
      setLocalAppearanceSettings(settings.appearanceSettings)
      setLocalGeneralSettings(settings.generalSettings)
    }
  }, [open, settings])

  const saveSettings = async () => {
    try {
      // 一次性获取配置并保存所有设置，避免竞态条件
      const config = await window.api.config.get()

      // 确定实际主题
      let actualTheme: 'light' | 'dark' = 'dark'
      if (localAppearanceSettings.theme === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } else {
        actualTheme = localAppearanceSettings.theme
      }

      // 一次性保存所有配置到文件
      await window.api.config.set({
        ...config,
        editorSettings: localEditorSettings,
        terminalSettings: localTerminalSettings,
        appearanceSettings: localAppearanceSettings,
        theme: actualTheme,
        language: localGeneralSettings.language,
        embeddingSettings: {
          provider: localEmbeddingSettings.provider,
          model: localEmbeddingSettings.model,
          apiKey: localEmbeddingSettings.apiKey || undefined
        },
        searchSettings: {
          bingApiKey: localSearchSettings.bingApiKey?.trim() || undefined
        },
        completionSettings: {
          enabled: localCompletionSettings.enabled,
          enableValidation: localCompletionSettings.enableValidation ? true : undefined,
          provider: localCompletionSettings.provider.trim() || undefined,
          model: localCompletionSettings.model.trim() || undefined,
          apiKey: localCompletionSettings.apiKey.trim() || undefined
        },
        preferences: {
          ...config.preferences,
          autoSave: localGeneralSettings.autoSave,
          sidebarCollapsed: config.preferences?.sidebarCollapsed ?? false
        }
      })

      // 应用主题
      await window.api.config.setTheme(actualTheme)
      await window.api.config.updateWindowTheme(actualTheme)

      // 更新默认模型/指令（单模型模式）
      if (defaultAgentId) {
        await window.api.agents.update(defaultAgentId, {
          provider: localModelSettings.provider,
          model: localModelSettings.model,
          instructions: localModelSettings.instructions || null
        })
      }

      const prefResult = await window.api.auth.updatePreferences({
        aiUserRules: localAiUserRules.trim() || ''
      })
      if (!prefResult.success) {
        console.warn('[Settings] auth.updatePreferences failed:', prefResult.error)
      }

      // 更新 Context 状态（不保存，因为已经保存过了）
      await settings.reloadSettings()

      toast.success('设置已保存')
      // 保存成功后关闭弹窗
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('保存设置失败')
    }
  }

  const resetSettings = async () => {
    const defaultEditor: EditorSettings = {
      fontSize: 14,
      fontFamily: 'Monaco',
      lineHeight: 1.5,
      tabSize: 2,
      wordWrap: true,
      minimap: false,
      lineNumbers: true,
      gitBlame: true
    }
    const defaultTerminal: TerminalSettings = {
      fontSize: 14,
      fontFamily: 'Monaco',
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block'
    }
    const defaultAppearance: AppearanceSettings = {
      theme: 'system',
      accentColor: '#3b82f6',
      uiScale: 1.0
    }
    const defaultGeneral: GeneralSettings = {
      language: 'zh-CN',
      autoSave: true,
      debugMode: false,
      telemetry: true
    }

    setLocalEditorSettings(defaultEditor)
    setLocalTerminalSettings(defaultTerminal)
    setLocalAppearanceSettings(defaultAppearance)
    setLocalGeneralSettings(defaultGeneral)

    try {
      await Promise.all([
        settings.updateEditorSettings(defaultEditor),
        settings.updateTerminalSettings(defaultTerminal),
        settings.updateAppearanceSettings(defaultAppearance),
        settings.updateGeneralSettings(defaultGeneral)
      ])
      setResetPopoverOpen(false)
      toast.success('设置已重置')
    } catch (error) {
      console.error('Failed to reset settings:', error)
      toast.error('重置设置失败')
    }
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <GeneralSettingsContent
            settings={localGeneralSettings}
            onChange={setLocalGeneralSettings}
          />
        )
      case 'model':
        return (
          <div className="space-y-6">
            <ModelSettingsContent settings={localModelSettings} onChange={setLocalModelSettings} />
            <Separator />
            <CompletionSettingsContent
              settings={localCompletionSettings}
              onChange={setLocalCompletionSettings}
            />
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">全局 AI 用户规则</h4>
              <p className="text-xs text-muted-foreground">
                写入本地用户数据，随每次对话注入上下文中的 user_rules（与默认助手指令叠加）。
              </p>
              <Textarea
                value={localAiUserRules}
                onChange={(e) => setLocalAiUserRules(e.target.value)}
                placeholder="例如：优先使用 TypeScript 严格模式；提交前运行 lint。"
                className="min-h-[140px] resize-y font-mono text-sm"
              />
            </div>
            <Separator />
            <EmbeddingSettingsContent
              settings={localEmbeddingSettings}
              onChange={setLocalEmbeddingSettings}
            />
            <Separator />
            <SearchSettingsContent
              settings={localSearchSettings}
              onChange={setLocalSearchSettings}
            />
          </div>
        )
      case 'mcp-tools':
        return (
          <div className="min-h-[400px] -m-2 overflow-auto rounded-md border border-border/50 bg-muted/20 p-4">
            <ToolsView />
          </div>
        )
      case 'appearance':
        return (
          <AppearanceSettingsContent
            settings={localAppearanceSettings}
            onChange={setLocalAppearanceSettings}
          />
        )
      case 'editor':
        return (
          <EditorSettingsContent
            settings={localEditorSettings}
            onChange={setLocalEditorSettings}
            fontOptions={systemFonts}
            currentTheme={
              localAppearanceSettings.theme === 'system'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light'
                : localAppearanceSettings.theme === 'dark'
                  ? 'dark'
                  : 'light'
            }
          />
        )
      case 'terminal':
        return (
          <TerminalSettingsContent
            settings={localTerminalSettings}
            onChange={setLocalTerminalSettings}
            fontOptions={systemFonts}
          />
        )
      case 'keyboard':
        return <KeymapSettingsContent />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[750px] md:max-w-[1100px] lg:max-w-[1200px]">
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription className="sr-only">自定义您的应用设置</DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV_ITEMS.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={item.key === activeSection}
                          onClick={() => setActiveSection(item.key)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[700px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">设置</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {NAV_ITEMS.find((item) => item.key === activeSection)?.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className="flex-1 overflow-y-auto p-6">{renderContent()}</div>
            <div className="flex items-center justify-between border-t p-4">
              <Popover open={resetPopoverOpen} onOpenChange={setResetPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    重置为默认
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top" align="start">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">确认重置设置？</h4>
                      <p className="text-sm text-muted-foreground">
                        此操作将重置所有设置为默认值，包括外观、编辑器、终端等所有配置。
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetPopoverOpen(false)}
                      >
                        取消
                      </Button>
                      <Button variant="destructive" size="sm" onClick={resetSettings}>
                        确认重置
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button onClick={saveSettings}>保存设置</Button>
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

// 通用设置
function GeneralSettingsContent({
  settings,
  onChange
}: {
  settings: GeneralSettings
  onChange: (settings: GeneralSettings) => void
}) {
  const languageOptions = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' }
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>界面语言</Label>
        <Select
          value={settings.language}
          onValueChange={(value) => onChange({ ...settings, language: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择语言">
              {languageOptions.find((opt) => opt.value === settings.language)?.label || '简体中文'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label>自动保存</Label>
          <span className="text-xs text-muted-foreground">自动保存文件更改</span>
        </div>
        <Switch
          checked={settings.autoSave}
          onCheckedChange={(checked) => onChange({ ...settings, autoSave: checked })}
        />
      </div>
    </div>
  )
}

// 代码库索引 Embedding 设置
function EmbeddingSettingsContent({
  settings,
  onChange
}: {
  settings: { provider: 'openai' | 'dashscope'; model: string; apiKey: string }
  onChange: (v: { provider: 'openai' | 'dashscope'; model: string; apiKey: string }) => void
}) {
  const providerOptions = [
    { value: 'dashscope', label: '阿里云百炼 (DashScope)' },
    { value: 'openai', label: 'OpenAI' }
  ]
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">代码库语义索引 (Embedding)</h4>
      <p className="text-xs text-muted-foreground">
        用于代码库索引与语义搜索。选择 DashScope 并填写 API Key 时，也会用于 AI 编辑文件时的 Apply
        Edit 小模型。
      </p>
      <div className="space-y-2">
        <Label>提供商</Label>
        <Select
          value={settings.provider}
          onValueChange={(value) =>
            onChange({ ...settings, provider: value as 'openai' | 'dashscope' })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>模型 ID</Label>
        <Input
          value={settings.model}
          onChange={(e) => onChange({ ...settings, model: e.target.value })}
          placeholder={
            settings.provider === 'dashscope' ? 'text-embedding-v4' : 'text-embedding-3-small'
          }
        />
      </div>
      <div className="space-y-2">
        <Label>API Key（可选）</Label>
        <Input
          type="password"
          value={settings.apiKey}
          onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
          placeholder="留空则使用环境变量"
        />
      </div>
    </div>
  )
}

// 网页搜索设置（Bing API）
function SearchSettingsContent({
  settings,
  onChange
}: {
  settings: { bingApiKey: string }
  onChange: (v: { bingApiKey: string }) => void
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">网页搜索 (Bing)</h4>
      <p className="text-xs text-muted-foreground">
        用于 AI 联网搜索。填写 Bing Search API Key 后，工具可查询实时信息。
      </p>
      <div className="space-y-2">
        <Label>Bing Search API Key（可选）</Label>
        <Input
          type="password"
          value={settings.bingApiKey}
          onChange={(e) => onChange({ ...settings, bingApiKey: e.target.value })}
          placeholder="留空则禁用网页搜索"
        />
      </div>
    </div>
  )
}

// 模型设置（默认助手：单模型模式）
function ModelSettingsContent({
  settings,
  onChange
}: {
  settings: { provider: string; model: string; instructions: string }
  onChange: (v: { provider: string; model: string; instructions: string }) => void
}) {
  const providerOptions = [
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'google', label: 'Google (Gemini)' }
  ]
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>默认模型提供商</Label>
        <Select
          value={settings.provider}
          onValueChange={(value) => onChange({ ...settings, provider: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>模型 ID</Label>
        <Input
          value={settings.model}
          onChange={(e) => onChange({ ...settings, model: e.target.value })}
          placeholder="例如 gpt-4o、claude-3-5-sonnet-20241022"
        />
      </div>
      <div className="space-y-2">
        <Label>自定义指令（可选）</Label>
        <Textarea
          value={settings.instructions}
          onChange={(e) => onChange({ ...settings, instructions: e.target.value })}
          placeholder="例如：你是一位专业的代码助手，优先使用简洁的实现。"
          className="min-h-[120px] resize-y"
        />
      </div>
    </div>
  )
}

function CompletionSettingsContent({
  settings,
  onChange
}: {
  settings: {
    enabled: boolean
    enableValidation: boolean
    provider: string
    model: string
    apiKey: string
  }
  onChange: (v: {
    enabled: boolean
    enableValidation: boolean
    provider: string
    model: string
    apiKey: string
  }) => void
}) {
  const dedicated = settings.provider.trim().length > 0
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">行内 AI 补全（Copilot 式）</h4>
        <p className="text-xs text-muted-foreground">
          在编辑器中输入时显示灰色幽灵建议；可单独指定模型，否则使用上方默认助手。保存后需重新打开代码标签页或重载应用后生效。
        </p>
      </div>
      <div className="flex items-center justify-between border rounded-md px-3 py-2">
        <div>
          <Label className="text-sm">启用行内补全</Label>
          <p className="text-xs text-muted-foreground">关闭后不再请求行内建议</p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(v) => onChange({ ...settings, enabled: v })}
        />
      </div>
      <div className="flex items-center justify-between border rounded-md px-3 py-2">
        <div>
          <Label className="text-sm">Shadow 诊断校验</Label>
          <p className="text-xs text-muted-foreground">对 TS/JS 补全结果做轻量诊断（较慢）</p>
        </div>
        <Switch
          checked={settings.enableValidation}
          onCheckedChange={(v) => onChange({ ...settings, enableValidation: v })}
          disabled={!settings.enabled}
        />
      </div>
      <div className="space-y-2">
        <Label>补全专用提供商（可选）</Label>
        <Select
          value={dedicated ? settings.provider : '__default__'}
          onValueChange={(value) =>
            onChange({
              ...settings,
              provider: value === '__default__' ? '' : value,
              ...(value === '__default__' ? { model: '', apiKey: '' } : {})
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">与默认助手相同（推荐）</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="google">Google (Gemini)</SelectItem>
            <SelectItem value="dashscope">DashScope（通义）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {dedicated && (
        <>
          <div className="space-y-2">
            <Label>补全模型 ID</Label>
            <Input
              value={settings.model}
              onChange={(e) => onChange({ ...settings, model: e.target.value })}
              placeholder="例如 gpt-4o-mini"
            />
          </div>
          <div className="space-y-2">
            <Label>补全 API Key（可选）</Label>
            <Input
              type="password"
              value={settings.apiKey}
              onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
              placeholder="留空则尝试使用默认助手的 Key"
              autoComplete="off"
            />
          </div>
        </>
      )}
    </div>
  )
}

// 外观设置
function AppearanceSettingsContent({
  settings,
  onChange
}: {
  settings: AppearanceSettings
  onChange: (settings: AppearanceSettings) => void
}) {
  const themeOptions = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' }
  ]

  const zoomOptions = [
    { value: '0.8', label: '80%' },
    { value: '0.9', label: '90%' },
    { value: '1.0', label: '100%' },
    { value: '1.1', label: '110%' },
    { value: '1.25', label: '125%' },
    { value: '1.5', label: '150%' }
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>主题</Label>
        <Select
          value={settings.theme}
          onValueChange={(value) =>
            onChange({ ...settings, theme: value as 'light' | 'dark' | 'system' })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择主题">
              {themeOptions.find((opt) => opt.value === settings.theme)?.label || '跟随系统'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {themeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>界面缩放</Label>
          <span className="text-xs text-muted-foreground">
            使用 ⌥⌘= 或 ⌥⌘- 调整缩放，⌥⌘0 重置为 100%
          </span>
        </div>
        <Select
          value={settings.uiScale.toString()}
          onValueChange={(value) => onChange({ ...settings, uiScale: parseFloat(value) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择缩放比例">
              {zoomOptions.find((opt) => opt.value === settings.uiScale.toString())?.label ||
                '100%'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {zoomOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// 编辑器设置
function EditorSettingsContent({
  settings,
  onChange,
  fontOptions,
  currentTheme
}: {
  settings: EditorSettings
  onChange: (settings: EditorSettings) => void
  fontOptions: string[]
  currentTheme: 'light' | 'dark'
}) {
  const editorRef = useRef<any>(null)
  const decorationsRef = useRef<string[]>([])

  // 假的 Git Blame 数据
  const mockBlameData = [
    { line: 1, author: '张三', time: '2 天前', summary: '添加示例代码' },
    { line: 2, author: '李四', time: '1 周前', summary: '更新导入语句' },
    { line: 4, author: '王五', time: '3 天前', summary: '定义配置接口' },
    { line: 8, author: '张三', time: '2 天前', summary: '添加默认配置' },
    { line: 13, author: '赵六', time: '5 天前', summary: 'feat: 实现 Circle 类' },
    { line: 16, author: '赵六', time: '5 天前', summary: 'feat: 添加 run 方法实现' }
  ]

  // 当 gitBlame 开关变化时更新装饰器
  useEffect(() => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const model = editor.getModel()
    if (!model) return

    if (settings.gitBlame) {
      const decorations = mockBlameData.map((blame) => {
        const lineContent = model.getLineContent(blame.line)
        const lineLength = lineContent.length
        const text = `${blame.author}, ${blame.time} · ${blame.summary}`

        return {
          range: new (window as any).monaco.Range(blame.line, 1, blame.line, lineLength + 1),
          options: {
            after: {
              content: `${text}`,
              inlineClassName: 'git-blame-decoration'
            }
          }
        }
      })

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations)
    } else {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
    }
  }, [settings.gitBlame])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[400px_1fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editor-font">字体</Label>
            <FontSelector
              value={settings.fontFamily}
              onValueChange={(value) => onChange({ ...settings, fontFamily: value })}
              fonts={fontOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editor-font-size">字体大小</Label>
            <Input
              id="editor-font-size"
              type="number"
              min="8"
              max="32"
              value={settings.fontSize}
              onChange={(e) => onChange({ ...settings, fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editor-line-height">行高</Label>
            <Input
              id="editor-line-height"
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={settings.lineHeight}
              onChange={(e) => onChange({ ...settings, lineHeight: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tab-size">制表符大小</Label>
            <Input
              id="tab-size"
              type="number"
              value={settings.tabSize}
              onChange={(e) => onChange({ ...settings, tabSize: Number(e.target.value) })}
              min={1}
              max={8}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>自动换行</Label>
            <Switch
              checked={settings.wordWrap}
              onCheckedChange={(checked) => onChange({ ...settings, wordWrap: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>显示小地图</Label>
            <Switch
              checked={settings.minimap}
              onCheckedChange={(checked) => onChange({ ...settings, minimap: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>显示行号</Label>
            <Switch
              checked={settings.lineNumbers}
              onCheckedChange={(checked) => onChange({ ...settings, lineNumbers: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Git Blame 信息</Label>
            <Switch
              checked={settings.gitBlame}
              onCheckedChange={(checked) => onChange({ ...settings, gitBlame: checked })}
            />
          </div>
        </div>
        <div className="rounded-md border border-border overflow-hidden bg-card self-start sticky top-0">
          <MonacoCodeEditor
            height="500px"
            language="typescript"
            value={`// Circle IDE 示例代码
import { Agent } from '@/types'

interface Config {
  model: string
  temperature: number
}

const config: Config = {
  model: 'gpt-4',
  temperature: 0.7
}

export class Circle {
  private agents: Agent[] = []
  
  async run(): Promise<void> {
    console.log('Starting Circle...')
    // 实现逻辑
  }
}`}
            path="/settings-preview.ts"
            readOnly={true}
            editorSettings={settings}
            theme={currentTheme === 'dark' ? 'one-dark-pro' : 'one-light'}
            enableGitBlame={false}
            enableLanguageService={false}
            onMount={(editor, monaco) => {
              editorRef.current = editor
              ;(window as any).monaco = monaco

              if (!settings.gitBlame) return

              const model = editor.getModel()
              if (!model) return

              const decorations = mockBlameData.map((blame) => {
                const lineContent = model.getLineContent(blame.line)
                const lineLength = lineContent.length
                const text = `${blame.author}, ${blame.time} · ${blame.summary}`

                return {
                  range: new monaco.Range(blame.line, 1, blame.line, lineLength + 1),
                  options: {
                    after: {
                      content: `${text}`,
                      inlineClassName: 'git-blame-decoration'
                    }
                  }
                }
              })

              decorationsRef.current = editor.deltaDecorations([], decorations)
            }}
          />
        </div>
      </div>
    </div>
  )
}

// 终端设置
function TerminalSettingsContent({
  settings,
  onChange,
  fontOptions
}: {
  settings: TerminalSettings
  onChange: (settings: TerminalSettings) => void
  fontOptions: string[]
}) {
  const cursorStyleOptions = [
    { value: 'block', label: '块状' },
    { value: 'underline', label: '下划线' },
    { value: 'bar', label: '竖线' }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[400px_1fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="terminal-font">字体</Label>
            <FontSelector
              value={settings.fontFamily}
              onValueChange={(value) => onChange({ ...settings, fontFamily: value })}
              fonts={fontOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-font-size">字体大小</Label>
            <Input
              id="terminal-font-size"
              type="number"
              min="8"
              max="32"
              value={settings.fontSize}
              onChange={(e) => onChange({ ...settings, fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-line-height">行高</Label>
            <Input
              id="terminal-line-height"
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={settings.lineHeight}
              onChange={(e) => onChange({ ...settings, lineHeight: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-shell">Shell 路径（可选）</Label>
            <Input
              id="terminal-shell"
              value={settings.shell ?? ''}
              onChange={(e) => onChange({ ...settings, shell: e.target.value || undefined })}
              placeholder="留空则使用系统默认（如 /bin/bash、powershell.exe）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cursor-style">光标样式</Label>
            <Select
              value={settings.cursorStyle}
              onValueChange={(value) =>
                onChange({ ...settings, cursorStyle: value as 'block' | 'underline' | 'bar' })
              }
            >
              <SelectTrigger id="cursor-style" className="w-full">
                <SelectValue>
                  {cursorStyleOptions.find((opt) => opt.value === settings.cursorStyle)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cursorStyleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>光标闪烁</Label>
            <Switch
              checked={settings.cursorBlink}
              onCheckedChange={(checked) => onChange({ ...settings, cursorBlink: checked })}
            />
          </div>
        </div>
        <div className="rounded-md border border-border p-4 bg-card self-start sticky top-0">
          <pre
            style={{
              fontFamily: settings.fontFamily,
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight
            }}
            className="text-foreground"
          >
            {`$ npm install
$ npm run dev
Server running at http://localhost:3000

$ `}
            <span
              style={{
                display: 'inline-block',
                position: 'relative',
                width: settings.cursorStyle === 'bar' ? '2px' : '0.6em',
                height: `${settings.fontSize * settings.lineHeight}px`,
                verticalAlign: 'top'
              }}
            >
              <span
                className={settings.cursorBlink ? 'cursor-blink' : ''}
                style={{
                  display: 'block',
                  position: 'absolute',
                  left: 0,
                  bottom: settings.cursorStyle === 'underline' ? 0 : 'auto',
                  top: settings.cursorStyle === 'underline' ? 'auto' : 0,
                  width: '100%',
                  height:
                    settings.cursorStyle === 'underline'
                      ? '2px'
                      : `${settings.fontSize * settings.lineHeight}px`,
                  backgroundColor: 'currentColor'
                }}
              />
            </span>
          </pre>
        </div>
      </div>
    </div>
  )
}
