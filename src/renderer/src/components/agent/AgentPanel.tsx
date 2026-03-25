import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Bot, Edit, Save, X, FileText, Wrench, Sparkles } from 'lucide-react'
import { useAgent, useAgentAvatar } from '@/hooks'
import { AgentBasicInfo } from './AgentBasicInfo'
import { AgentModelConfig } from './AgentModelConfig'
import { AgentToolsConfig } from './AgentToolsConfig'
import { AgentTestChat } from './AgentTestChat'
import { Badge } from '../ui/badge'
import { useTranslation } from 'react-i18next'

interface AgentPanelProps {
  agentId?: string
}

export function AgentPanel({ agentId }: AgentPanelProps) {
  const { t } = useTranslation('agent')
  const { t: tc } = useTranslation('common')
  const [activeTab, setActiveTab] = useState('basic')
  const { agent, editing, setEditing, formData, setFormData, updateAgent, resetForm } =
    useAgent(agentId)

  // 工具选择（使用新的简化方案：tools 数组）
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  const {
    avatarPreview,
    selectAvatar,
    removeAvatar,
    saveAvatar,
    reset: resetAvatar
  } = useAgentAvatar(agent)

  // 当切换 agent 时，自动退出编辑状态并重置表单
  useEffect(() => {
    if (editing) {
      setEditing(false)
      resetForm()
      resetAvatar()
    }
    // 重置工具选择
    setSelectedTools(agent?.tools || [])
  }, [agentId])

  // 加载保存的 Tab 状态
  useEffect(() => {
    const loadTabState = async () => {
      try {
        const uiState = await window.api.config.getUIState()
        if (uiState.agentActiveTab) {
          setActiveTab(uiState.agentActiveTab)
        }
      } catch (error) {
        console.error('Failed to load agent tab state:', error)
      }
    }
    loadTabState()
  }, [])

  // 保存 Tab 状态
  useEffect(() => {
    const saveTabState = async () => {
      try {
        await window.api.config.updateUIState({
          agentActiveTab: activeTab
        })
        console.log('💾 Saved agent active tab:', activeTab)
      } catch (error) {
        console.error('Failed to save agent tab state:', error)
      }
    }
    saveTabState()
  }, [activeTab])

  // 同步 agent tools 到本地状态
  useEffect(() => {
    if (agent) {
      setSelectedTools(agent.tools || [])
    }
  }, [agent])

  const handleSave = async () => {
    if (!agentId) return

    try {
      // 保存头像（如果有更改）
      const avatarFileName = await saveAvatar(agentId)

      // 更新 agent 信息（使用新的 tools 数组）
      const success = await updateAgent({
        ...formData,
        tools: selectedTools, // 使用新的工具选择方式
        metadata: {
          ...agent.metadata,
          avatar: avatarFileName
        }
      })

      if (success) {
        setEditing(false)
      } else {
        alert(t('panel.saveFailed'))
      }
    } catch (error) {
      console.error('Failed to update agent:', error)
      alert(t('panel.saveFailed'))
    }
  }

  const handleCancel = () => {
    setEditing(false)
    resetForm()
    resetAvatar()
    // 恢复工具选择
    setSelectedTools(agent?.tools || [])
  }

  const handleSelectAvatar = async () => {
    try {
      await selectAvatar()
    } catch {
      alert(t('panel.selectAvatarFailed'))
    }
  }

  const handleRemoveAvatar = async () => {
    if (!agentId) return
    try {
      await removeAvatar(agentId, () => {
        // 重新加载后在 hook 中会自动更新 avatarPreview
      })
    } catch {
      alert(t('panel.removeAvatarFailed'))
    }
  }

  if (!agent) {
    return (
      <div className="flex h-screen flex-1 items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full bg-linear-to-br from-muted/50 to-muted/20 flex items-center justify-center">
              <Bot className="size-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('panel.noAgentTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('panel.noAgentDescription')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-1">
      {/* Left Panel: Agent Details - 60% */}
      <div className="flex w-[60%] flex-col border-r border-border/30 bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-4 bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 shadow-sm">
              {avatarPreview ? <AvatarImage src={avatarPreview} alt={agent.name} /> : null}
              <AvatarFallback className="bg-primary/10 border border-primary/20">
                <Bot className="size-6 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{agent.name}</h2>
                {agent.metadata?.isSystem && (
                  <Badge variant="default" className="h-5 text-xs px-2">
                    {t('list.badgeSystem')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
            </div>
          </div>
          {!agent.metadata?.isSystem &&
            (editing ? (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={handleSave}>
                  <Save className="mr-2 size-4" />
                  {tc('button.save')}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="mr-2 size-4" />
                  {tc('button.cancel')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Edit className="mr-2 size-4" />
                {tc('button.edit')}
              </Button>
            ))}
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col min-h-0"
        >
          <div className="border-b border-border/30 shrink-0 bg-muted/30">
            <TabsList className="inline-flex w-full justify-start gap-1 rounded-none bg-transparent px-4 py-2">
              <TabsTrigger
                value="basic"
                className="relative rounded-md px-4 gap-2 text-sm font-medium transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="size-4" />
                {t('panel.tabs.basic')}
              </TabsTrigger>
              <TabsTrigger
                value="model"
                className="relative rounded-md px-4 gap-2 text-sm font-medium transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Sparkles className="size-4" />
                {t('panel.tabs.model')}
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="relative rounded-md px-4 gap-2 text-sm font-medium transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Wrench className="size-4" />
                {t('panel.tabs.tools')}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                {/* Basic Info Tab */}
                <TabsContent value="basic" className="mt-0 space-y-6">
                  <AgentBasicInfo
                    agent={agent}
                    editing={editing}
                    formData={formData}
                    setFormData={setFormData}
                    avatarPreview={avatarPreview}
                    onSelectAvatar={handleSelectAvatar}
                    onRemoveAvatar={handleRemoveAvatar}
                  />
                </TabsContent>

                {/* Model Config Tab */}
                <TabsContent value="model" className="mt-0 space-y-6">
                  <AgentModelConfig
                    agent={agent}
                    editing={editing}
                    formData={formData}
                    setFormData={setFormData}
                  />
                </TabsContent>

                {/* Tools Tab */}
                <TabsContent value="tools" className="mt-0 space-y-6">
                  {agentId && (
                    <AgentToolsConfig
                      agentId={agentId}
                      editing={editing}
                      selectedTools={selectedTools}
                      onToolsChange={setSelectedTools}
                    />
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </div>

      {/* Right Panel: Test Chat - 40% */}
      <div className="flex w-[40%] flex-col border-l border-border/30 bg-sidebar">
        {agentId && <AgentTestChat agentId={agentId} />}
      </div>
    </div>
  )
}
