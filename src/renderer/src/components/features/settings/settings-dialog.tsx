import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import {
  Settings,
  Palette,
  Monitor,
  Keyboard,
  Code,
  FileText,
  Plus,
  X,
  Key,
  Brain,
  Bot
} from 'lucide-react'
import type { editor } from 'monaco-editor'
import { defaultEditorOptions } from '@/config/monaco-editor-options'
import { eventBus } from '@/lib/event-bus'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { useSettings } from '@/contexts/settings-context'
import { MonacoCodeEditor } from '@/components/features/editor/monaco-code-editor'
import { KeymapSettingsContent } from './keymap-settings-content'
import { UserRulesSettingsContent } from './user-rules-settings-content'
import { ApiKeysSettings } from './api-keys-settings'
import { MemoriesSettingsContent } from './memories-settings-content'
import { ModelsSettingsContent } from './models-settings-content'
import type {
  TerminalSettings,
  AppearanceSettings,
  GeneralSettings,
  SkillsSettings,
  FilesExclude
} from '@/contexts/settings-context'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// NAV_ITEMS will be created inside component to access t() function

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
  const { t } = useTranslation()

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
        <SelectValue placeholder={t('settings.select_font')}>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {popularFonts.length > 0 && (
          <SelectGroup>
            <SelectLabel>{t('settings.recommended_monospace_fonts')}</SelectLabel>
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
            <SelectLabel>{t('settings.other_fonts')}</SelectLabel>
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
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState('general')
  const settings = useSettings()

  useEffect(() => {
    const handleOpenSettings = ({ tab }: { tab?: string }) => {
      onOpenChange(true)
      if (tab) {
        setActiveSection(tab)
      }
    }

    eventBus.on('open-settings', handleOpenSettings)
    return () => {
      eventBus.off('open-settings', handleOpenSettings)
    }
  }, [onOpenChange])

  // Navigation items
  const NAV_ITEMS: Array<{ key: string; name: string; icon: any }> = [
    { key: 'general', name: t('settings.general'), icon: Settings },
    { key: 'appearance', name: t('settings.appearance'), icon: Palette },
    { key: 'editor', name: t('settings.editor'), icon: Code },
    { key: 'terminal', name: t('settings.terminal'), icon: Monitor },
    { key: 'keyboard', name: t('settings.keyboard'), icon: Keyboard },
    { key: 'models', name: t('settings.models'), icon: Bot },
    { key: 'aiconfig', name: t('settings.ai_config'), icon: Key },
    { key: 'rules', name: t('settings.rules'), icon: FileText },
    { key: 'memories', name: t('settings.memories'), icon: Brain }
  ]

  // 本地状态用于编辑
  const [localEditorOptions, setLocalEditorOptions] = useState<
    Partial<editor.IStandaloneEditorConstructionOptions>
  >(settings.editorOptions)
  const [localTerminalSettings, setLocalTerminalSettings] = useState<TerminalSettings>(
    settings.terminalSettings
  )
  const [localAppearanceSettings, setLocalAppearanceSettings] = useState<AppearanceSettings>(
    settings.appearanceSettings
  )
  const [localGeneralSettings, setLocalGeneralSettings] = useState<GeneralSettings>(
    settings.generalSettings
  )
  const [localSkillsSettings, setLocalSkillsSettings] = useState<SkillsSettings>(
    settings.skillsSettings
  )
  const [localFilesExclude, setLocalFilesExclude] = useState<FilesExclude>(settings.filesExclude)

  // 系统字体列表
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  // 重置确认 Popover 状态
  const [resetPopoverOpen, setResetPopoverOpen] = useState(false)

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
      setLocalEditorOptions(settings.editorOptions)
      setLocalTerminalSettings(settings.terminalSettings)
      setLocalAppearanceSettings(settings.appearanceSettings)
      setLocalGeneralSettings(settings.generalSettings)
      setLocalSkillsSettings(settings.skillsSettings)
      setLocalFilesExclude(settings.filesExclude)
    }
  }, [open, settings])

  const saveSettings = async () => {
    try {
      // 一次性获取配置并保存所有设置，避免竞态条件
      const config = await window.api.config.get()

      // 一次性保存所有配置到文件
      await window.api.config.set({
        ...config,
        editorOptions: localEditorOptions,
        terminalSettings: localTerminalSettings,
        appearanceSettings: localAppearanceSettings,
        language: localGeneralSettings.language,
        skillsSettings: localSkillsSettings,
        filesExclude: localFilesExclude,
        preferences: {
          ...config.preferences,
          autoSave: localGeneralSettings.autoSave,
          debugMode: localGeneralSettings.debugMode,
          autoRunMode: localGeneralSettings.autoRunMode,
          commandWhitelist: localGeneralSettings.commandWhitelist,
          enableFilePreviewOnSingleClick: localGeneralSettings.enableFilePreviewOnSingleClick,
          sidebarCollapsed: config.preferences?.sidebarCollapsed ?? false
        }
      })

      // 应用主题（确定实际主题用于窗口）
      const actualTheme =
        localAppearanceSettings.theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : localAppearanceSettings.theme

      await window.api.config.updateWindowTheme(actualTheme)

      // Update i18n language if changed
      if (localGeneralSettings.language !== settings.generalSettings.language) {
        const i18nLang = localGeneralSettings.language === 'zh-CN' ? 'zh' : 'en'
        await i18n.changeLanguage(i18nLang)
      }

      // 更新 Context 状态（不保存，因为已经保存过了）
      await settings.reloadSettings()

      // 通知文件树刷新
      eventBus.emit('files-exclude-changed')

      toast.success(t('settings.save_success'))
      // 保存成功后关闭弹窗
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error(t('settings.save_failed'))
    }
  }

  const resetSettings = async () => {
    // 重置为空，使用系统默认值
    const defaultEditor: Partial<editor.IStandaloneEditorConstructionOptions> = {}
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
      autoRunMode: 'auto-run',
      commandWhitelist: [
        'npm',
        'pnpm',
        'yarn',
        'ls',
        'cat',
        'echo',
        'pwd',
        'git status',
        'git diff',
        'git log'
      ],
      enableFilePreviewOnSingleClick: true,
      openProjectBehavior: 'new'
    }

    setLocalEditorOptions(defaultEditor)
    setLocalTerminalSettings(defaultTerminal)
    setLocalAppearanceSettings(defaultAppearance)
    setLocalGeneralSettings(defaultGeneral)

    try {
      await Promise.all([
        settings.updateEditorOptions(defaultEditor),
        settings.updateTerminalSettings(defaultTerminal),
        settings.updateAppearanceSettings(defaultAppearance),
        settings.updateGeneralSettings(defaultGeneral)
      ])

      // Update i18n language to default (zh-CN)
      await i18n.changeLanguage('zh')

      setResetPopoverOpen(false)
      toast.success(t('settings.reset_success'))
    } catch (error) {
      console.error('Failed to reset settings:', error)
      toast.error(t('settings.reset_failed'))
    }
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <GeneralSettingsContent
            settings={localGeneralSettings}
            onChange={setLocalGeneralSettings}
            skillsSettings={localSkillsSettings}
            onSkillsSettingsChange={setLocalSkillsSettings}
            filesExclude={localFilesExclude}
            onFilesExcludeChange={setLocalFilesExclude}
          />
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
            options={localEditorOptions}
            onChange={setLocalEditorOptions}
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
      case 'models':
        return <ModelsSettingsContent />
      case 'aiconfig':
        return <ApiKeysSettings />
      case 'rules':
        return <UserRulesSettingsContent />
      case 'memories':
        return <MemoriesSettingsContent />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 md:max-h-[750px] md:max-w-[1100px] lg:max-w-[1200px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
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
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">{t('settings.title')}</BreadcrumbLink>
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
            <div className="flex items-center justify-between border-t border-border p-4">
              <Popover open={resetPopoverOpen} onOpenChange={setResetPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {t('settings.reset_to_default')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top" align="start">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{t('settings.reset_to_default')}?</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.reset_confirmation')}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetPopoverOpen(false)}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={resetSettings}>
                        {t('common.confirm')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={saveSettings}>{t('common.save')}</Button>
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
  onChange,
  skillsSettings,
  onSkillsSettingsChange,
  filesExclude,
  onFilesExcludeChange
}: {
  settings: GeneralSettings
  onChange: (settings: GeneralSettings) => void
  skillsSettings: SkillsSettings
  onSkillsSettingsChange: (settings: SkillsSettings) => void
  filesExclude: FilesExclude
  onFilesExcludeChange: (exclude: FilesExclude) => void
}) {
  const { t } = useTranslation()
  const [newPattern, setNewPattern] = useState('')
  const [newSkillDir, setNewSkillDir] = useState('')

  const languageOptions = [
    { value: 'zh-CN', label: t('settings.language_zh') },
    { value: 'en-US', label: t('settings.language_en') }
  ]

  const addPattern = () => {
    if (!newPattern.trim()) return
    onFilesExcludeChange({ ...filesExclude, [newPattern.trim()]: true })
    setNewPattern('')
  }

  const removePattern = (pattern: string) => {
    const newExclude = { ...filesExclude }
    delete newExclude[pattern]
    onFilesExcludeChange(newExclude)
  }

  const addSkillDir = () => {
    if (!newSkillDir.trim()) return
    if (skillsSettings.scanDirectories.includes(newSkillDir.trim())) return
    onSkillsSettingsChange({
      ...skillsSettings,
      scanDirectories: [...skillsSettings.scanDirectories, newSkillDir.trim()]
    })
    setNewSkillDir('')
  }

  const removeSkillDir = (dir: string) => {
    onSkillsSettingsChange({
      ...skillsSettings,
      scanDirectories: skillsSettings.scanDirectories.filter((d) => d !== dir)
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="block mb-2">{t('settings.language')}</Label>
        <Select
          value={settings.language}
          onValueChange={(value) => onChange({ ...settings, language: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('common.select_language')}>
              {languageOptions.find((opt) => opt.value === settings.language)?.label ||
                t('settings.language_zh')}
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
        <div>
          <Label className="block mb-1.5">{t('settings.auto_save')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings.auto_save_desc')}</p>
        </div>
        <Switch
          checked={settings.autoSave}
          onCheckedChange={(checked) => onChange({ ...settings, autoSave: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="block mb-1.5">{t('settings.file_preview_single_click')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.file_preview_single_click_desc')}
          </p>
        </div>
        <Switch
          checked={settings.enableFilePreviewOnSingleClick}
          onCheckedChange={(checked) =>
            onChange({ ...settings, enableFilePreviewOnSingleClick: checked })
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="block mb-2">{t('settings.command_execution_mode')}</Label>
        <Select
          value={settings.autoRunMode}
          onValueChange={(value: 'ask' | 'auto-run' | 'whitelist') =>
            onChange({ ...settings, autoRunMode: value })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask">
              <div className="flex items-center gap-2">
                <span className="font-medium">Ask Every Time</span>
                <span className="text-xs text-muted-foreground">
                  {t('settings.auto_run_mode_ask_desc')}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="auto-run">
              <div className="flex items-center gap-2">
                <span className="font-medium">Auto-Run</span>
                <span className="text-xs text-muted-foreground">
                  {t('settings.auto_run_mode_auto_desc')}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="whitelist">
              <div className="flex items-center gap-2">
                <span className="font-medium">Whitelist</span>
                <span className="text-xs text-muted-foreground">
                  {t('settings.auto_run_mode_whitelist_desc')}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1.5">
          {t('settings.command_execution_mode_desc')}
        </p>
      </div>

      {settings.autoRunMode === 'whitelist' && (
        <div className="space-y-3">
          <div>
            <Label className="block mb-1.5">{t('settings.command_whitelist')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.command_whitelist_desc')}</p>
          </div>
          <div className="space-y-2">
            {settings.commandWhitelist.map((cmd) => (
              <div
                key={cmd}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <code className="text-sm font-mono">{cmd}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    onChange({
                      ...settings,
                      commandWhitelist: settings.commandWhitelist.filter((c) => c !== cmd)
                    })
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t('settings.command_whitelist_placeholder')}
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (newPattern.trim() && !settings.commandWhitelist.includes(newPattern.trim())) {
                    onChange({
                      ...settings,
                      commandWhitelist: [...settings.commandWhitelist, newPattern.trim()]
                    })
                    setNewPattern('')
                  }
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (newPattern.trim() && !settings.commandWhitelist.includes(newPattern.trim())) {
                  onChange({
                    ...settings,
                    commandWhitelist: [...settings.commandWhitelist, newPattern.trim()]
                  })
                  setNewPattern('')
                }
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="block mb-1.5">{t('settings.files_exclude')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings.files_exclude_desc')}</p>
        </div>
        <div className="rounded-md border border-border divide-y divide-border">
          {Object.keys(filesExclude)
            .filter((p) => filesExclude[p])
            .map((pattern) => (
              <div
                key={pattern}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 group"
              >
                <code className="text-sm">{pattern}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => removePattern(pattern)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          <div className="flex items-center px-3 py-2 gap-2">
            <Input
              placeholder={t('settings.files_exclude_placeholder')}
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPattern()}
              className="h-8 border-0 shadow-none focus-visible:ring-0 px-2 text-sm"
            />
            {newPattern.trim() && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={addPattern}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="block mb-1.5">Skills: Scan Directories</Label>
          <p className="text-xs text-muted-foreground">
            配置扫描技能目录的名称（会在用户主目录和项目根目录下查找）
          </p>
        </div>
        <div className="rounded-md border border-border divide-y divide-border">
          {skillsSettings.scanDirectories.map((dir) => (
            <div
              key={dir}
              className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 group"
            >
              <code className="text-sm">{dir}/skills</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => removeSkillDir(dir)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center px-3 py-2 gap-2">
            <Input
              placeholder={t('settings.skill_dirs_placeholder')}
              value={newSkillDir}
              onChange={(e) => setNewSkillDir(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkillDir()}
              className="h-8 border-0 shadow-none focus-visible:ring-0 px-2 text-sm"
            />
            {newSkillDir.trim() && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={addSkillDir}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
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
  const { t } = useTranslation()

  const themeOptions = [
    { value: 'system', label: t('settings.theme_system') },
    { value: 'light', label: t('settings.theme_light') },
    { value: 'dark', label: t('settings.theme_dark') }
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
        <Label className="block mb-2">{t('settings.theme')}</Label>
        <Select
          value={settings.theme}
          onValueChange={(value) =>
            onChange({ ...settings, theme: value as 'light' | 'dark' | 'system' })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('settings.select_theme')}>
              {themeOptions.find((opt) => opt.value === settings.theme)?.label ||
                t('settings.theme_system')}
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
        <div className="flex items-center gap-2 mb-2">
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
            <SelectValue placeholder={t('settings.select_zoom')}>
              {zoomOptions.find((opt) => opt.value === settings.uiScale.toString())?.label ||
                t('settings.zoom_100')}
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
  options,
  onChange,
  fontOptions,
  currentTheme
}: {
  options: Partial<editor.IStandaloneEditorConstructionOptions>
  onChange: (options: Partial<editor.IStandaloneEditorConstructionOptions>) => void
  fontOptions: string[]
  currentTheme: 'light' | 'dark'
}) {
  const { t } = useTranslation()
  const editorRef = useRef<any>(null)
  const decorationsRef = useRef<string[]>([])

  // 假的 Git Blame 数据
  const mockBlameData = [
    { line: 1, author: 'Zhang San', time: '2 days ago', summary: 'Add sample code' },
    { line: 2, author: 'Li Si', time: '1 week ago', summary: 'Update imports' },
    { line: 4, author: 'Wang Wu', time: '3 days ago', summary: 'Define config interface' },
    { line: 8, author: 'Zhang San', time: '2 days ago', summary: 'Add default config' },
    { line: 13, author: 'Zhao Liu', time: '5 days ago', summary: 'feat: implement Circle class' },
    { line: 16, author: 'Zhao Liu', time: '5 days ago', summary: 'feat: add run method' }
  ]

  // 当 gitBlame 开关变化时更新装饰器
  useEffect(() => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const model = editor.getModel()
    if (!model) return

    // Git Blame 装饰器逻辑（如果需要的话）
    const showGitBlame = false // 简化预览，不显示 Git Blame
    if (showGitBlame) {
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
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[400px_1fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editor-font" className="block mb-2">
              {t('settings.font')}
            </Label>
            <FontSelector
              value={(options.fontFamily as string) || (defaultEditorOptions.fontFamily as string)}
              onValueChange={(value) => onChange({ ...options, fontFamily: value })}
              fonts={fontOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editor-font-size" className="block mb-2">
              {t('settings.font_size')}
            </Label>
            <Input
              id="editor-font-size"
              type="number"
              min="8"
              max="32"
              value={options.fontSize || defaultEditorOptions.fontSize}
              onChange={(e) => {
                const fontSize = Number(e.target.value)
                const currentFontSize = (options.fontSize || defaultEditorOptions.fontSize)!
                const currentLineHeight = (options.lineHeight ||
                  defaultEditorOptions.lineHeight) as number
                const lineHeightMultiplier = currentLineHeight / currentFontSize
                onChange({ ...options, fontSize, lineHeight: lineHeightMultiplier * fontSize })
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editor-line-height" className="block mb-2">
              {t('settings.line_height_multiplier')}
            </Label>
            <Input
              id="editor-line-height"
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={
                ((options.lineHeight || defaultEditorOptions.lineHeight) as number) /
                (options.fontSize || defaultEditorOptions.fontSize)!
              }
              onChange={(e) => {
                const lineHeightMultiplier = Number(e.target.value)
                const fontSize = (options.fontSize || defaultEditorOptions.fontSize)!
                onChange({ ...options, lineHeight: lineHeightMultiplier * fontSize })
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tab-size" className="block mb-2">
              制表符大小
            </Label>
            <Input
              id="tab-size"
              type="number"
              value={options.tabSize || defaultEditorOptions.tabSize}
              onChange={(e) => onChange({ ...options, tabSize: Number(e.target.value) })}
              min={1}
              max={8}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="block">自动换行</Label>
            <Switch
              checked={(options.wordWrap ?? defaultEditorOptions.wordWrap) === 'on'}
              onCheckedChange={(checked) =>
                onChange({ ...options, wordWrap: checked ? 'on' : 'off' })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="block">显示小地图</Label>
            <Switch
              checked={
                (options.minimap as any)?.enabled ?? (defaultEditorOptions.minimap as any)?.enabled
              }
              onCheckedChange={(checked) => onChange({ ...options, minimap: { enabled: checked } })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="block">显示行号</Label>
            <Switch
              checked={(options.lineNumbers ?? defaultEditorOptions.lineNumbers) === 'on'}
              onCheckedChange={(checked) =>
                onChange({ ...options, lineNumbers: checked ? 'on' : 'off' })
              }
            />
          </div>
        </div>
        <div className="rounded-md border border-border overflow-hidden bg-card self-start sticky top-0">
          <MonacoCodeEditor
            height="500px"
            language="typescript"
            value={`// Circle IDE 示例代码
interface Config {
  model: string
  temperature: number
}

const config: Config = {
  model: 'gpt-4',
  temperature: 0.7
}

export class Circle {
  async run(): Promise<void> {
    console.log('Starting Circle...')
  }
}`}
            path="/settings-preview.ts"
            readOnly={true}
            options={options}
            theme={currentTheme === 'dark' ? 'one-dark-pro' : 'one-light'}
            enableGitBlame={false}
            enableLanguageService={false}
            onMount={(editor, monaco) => {
              editorRef.current = editor
              ;(window as any).monaco = monaco
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
  const { t } = useTranslation()

  const cursorStyleOptions = [
    { value: 'block', label: t('settings.cursor_style_block') },
    { value: 'underline', label: t('settings.cursor_style_underline') },
    { value: 'bar', label: t('settings.cursor_style_bar') }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[400px_1fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="terminal-font" className="block mb-1.5">
              {t('settings.font')}
            </Label>
            <FontSelector
              value={settings.fontFamily}
              onValueChange={(value) => onChange({ ...settings, fontFamily: value })}
              fonts={fontOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-font-size" className="block mb-1.5">
              {t('settings.font_size')}
            </Label>
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
            <Label htmlFor="terminal-line-height" className="block mb-1.5">
              {t('settings.line_height')}
            </Label>
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
            <Label htmlFor="cursor-style" className="block mb-1.5">
              {t('settings.cursor_style')}
            </Label>
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
            <Label className="block">{t('settings.cursor_blink')}</Label>
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
