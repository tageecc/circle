import { useState } from 'react'
import { Card } from '../ui/card'
import { ChatInput, type PastedImage } from './ChatInput'
import { Folder, GitBranch, Terminal, Clock } from 'lucide-react'
import { AIProjectCreationDialog } from '../dialogs/AIProjectCreationDialog'

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
  onProjectCreated?: (projectPath: string) => void
}

export function WelcomeView({
  recentProjects,
  onOpenProject,
  onOpenRecentProject,
  onCloneRepository,
  onProjectCreated
}: WelcomeViewProps) {
  const [promptValue, setPromptValue] = useState('')
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([])
  const [showCreationDialog, setShowCreationDialog] = useState(false)
  const [creationPrompt, setCreationPrompt] = useState('')

  const handleCreateApp = () => {
    if (!promptValue.trim()) return

    setCreationPrompt(promptValue)
    setShowCreationDialog(true)

    setPromptValue('')
    setPastedImages([])
  }

  const handleProjectCreated = (projectPath: string) => {
    setShowCreationDialog(false)
    if (onProjectCreated) {
      onProjectCreated(projectPath)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <Terminal className="size-9 text-primary" />
            <h1 className="text-3xl font-bold">Circle</h1>
          </div>
          <p className="text-base text-muted-foreground">AI-Powered Development Platform</p>
        </div>

        {/* Create App Input */}
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-semibold">从想法到应用，一键生成</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              描述你想要的应用，AI 会帮你自动创建
            </p>
          </div>
          <ChatInput
            placeholder="描述你想要创建的应用，例如：创建一个待办事项管理应用..."
            value={promptValue}
            onChange={setPromptValue}
            onSend={handleCreateApp}
            pastedImages={pastedImages}
            onPastedImagesChange={setPastedImages}
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
                <div className="text-xs font-semibold">打开项目</div>
                <div className="text-[11px] text-muted-foreground">打开本地文件夹</div>
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
                <div className="text-xs font-semibold">克隆仓库</div>
                <div className="text-[11px] text-muted-foreground">从 Git 克隆</div>
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
              <h2 className="text-base font-semibold">最近打开</h2>
              <span className="text-xs text-muted-foreground">
                共 {recentProjects.length} 个项目
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
            <p className="text-sm text-muted-foreground">暂无最近项目，打开文件夹开始使用</p>
          </div>
        )}
      </div>

      <AIProjectCreationDialog
        open={showCreationDialog}
        userPrompt={creationPrompt}
        onClose={() => setShowCreationDialog(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
