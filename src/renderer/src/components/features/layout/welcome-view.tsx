import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { ChatInput, type PastedImage } from '@/components/features/chat/chat-input'
import { toast } from '@/components/ui/sonner'
import { Folder, GitBranch, Terminal, Clock } from 'lucide-react'
import { useAvailableChatModels } from '@/hooks/use-available-chat-models'

interface RecentProject {
  name: string
  path: string
  lastOpened: string
}

interface WelcomeViewProps {
  recentProjects: RecentProject[]
  onOpenProject: () => void
  onOpenRecentProject: (path: string) => void
  onCloneRepository: () => void
  onCreateApp: (prompt: string, modelId: string) => Promise<boolean>
}

export function WelcomeView({
  recentProjects,
  onOpenProject,
  onOpenRecentProject,
  onCloneRepository,
  onCreateApp
}: WelcomeViewProps) {
  const { t } = useTranslation()
  const [promptValue, setPromptValue] = useState('')
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const { availableModels, isLoadingModels } = useAvailableChatModels()

  const handleCreateApp = async () => {
    const prompt = promptValue.trim()
    if (!prompt || isCreating) return

    if (!selectedModelId) {
      toast.error(t('chat.select_model_first'))
      return
    }

    setIsCreating(true)

    try {
      const started = await onCreateApp(prompt, selectedModelId)
      if (started) {
        setPromptValue('')
        setPastedImages([])
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* macOS 窗口拖动区域 */}
      <div className="h-[38px] w-full window-drag-region shrink-0" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-4xl space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2.5">
              <Terminal className="size-9 text-primary" />
              <h1 className="text-3xl font-bold">{t('welcome.title')}</h1>
            </div>
            <p className="text-base text-muted-foreground">{t('welcome.subtitle')}</p>
          </div>

          {/* Create App Input */}
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold">{t('welcome.create_app_title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('welcome.create_app_desc')}</p>
            </div>
            <ChatInput
              placeholder={t('welcome.create_app_placeholder')}
              value={promptValue}
              onChange={setPromptValue}
              onSend={handleCreateApp}
              isSending={isCreating}
              pastedImages={pastedImages}
              onPastedImagesChange={setPastedImages}
              availableModels={availableModels}
              isLoadingModels={isLoadingModels}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              showModelSelector
              minHeight="100px"
            />
          </div>

          {/* Actions - 更小的卡片 */}
          <div className="grid gap-2.5 md:grid-cols-3">
            <Card
              className="group cursor-pointer border-border/40 transition-all hover:border-primary hover:bg-accent/50"
              onClick={onOpenProject}
            >
              <div className="flex items-center gap-2.5 p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Folder className="size-4 text-primary" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="text-xs font-semibold">{t('welcome.open_project')}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('welcome.open_project_desc')}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              className="group cursor-pointer border-border/40 transition-all hover:border-primary hover:bg-accent/50"
              onClick={onCloneRepository}
            >
              <div className="flex items-center gap-2.5 p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <GitBranch className="size-4 text-primary" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="text-xs font-semibold">{t('welcome.clone_repository')}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('welcome.clone_repository_desc')}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="cursor-not-allowed border-border/30 opacity-40">
              <div className="flex items-center gap-2.5 p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Terminal className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="text-xs font-semibold text-muted-foreground">连接 SSH</div>
                  <div className="text-[11px] text-muted-foreground">远程开发</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-semibold">{t('welcome.recent_projects')}</h2>
                <span className="text-xs text-muted-foreground">
                  {recentProjects.length} {t('welcome.recent_projects')}
                </span>
              </div>

              <div className="space-y-1.5">
                {recentProjects.slice(0, 5).map((project) => (
                  <Card
                    key={project.path}
                    className="group cursor-pointer border-border/50 transition-all hover:border-primary hover:bg-accent/50 py-3"
                    onClick={() => onOpenRecentProject(project.path)}
                  >
                    <div className="flex items-center justify-between px-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Folder className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{project.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pl-3 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span className="whitespace-nowrap">{project.lastOpened}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {recentProjects.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/50 p-6 text-center">
              <Folder className="mx-auto mb-2 size-10 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">{t('welcome.no_recent')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
