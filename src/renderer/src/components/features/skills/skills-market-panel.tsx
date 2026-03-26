import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  Check,
  ChevronDown,
  Globe,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { useSkillsStore } from '@/stores/skills.store'
import { useFileStore, getTabId } from '@/stores/file.store'
import { useWorkspaceStore } from '@/stores/workspace.store'

export function SkillsMarketPanel() {
  const [searchInput, setSearchInput] = useState('')
  const [installingSkill, setInstallingSkill] = useState<string | null>(null)
  const { isInstalled, loadInstalledSkills, marketCache, loadMarketData } = useSkillsStore()
  const { openFiles, addFile, setActiveFile } = useFileStore()
  const { workspaceRoot } = useWorkspaceStore()

  // 从缓存中读取数据（确保是数组）
  const skills = Array.isArray(marketCache.skills) ? marketCache.skills : []
  const loading = marketCache.isLoading && !marketCache.isLoaded
  const total = marketCache.total

  // 加载市场列表
  const loadSkills = useCallback(
    async (reset = false) => {
      try {
        await loadMarketData({
          query: searchInput || 'skill',
          reset
        })
      } catch (error) {
        toast.error('加载失败，请稍后重试')
      }
    },
    [searchInput, loadMarketData]
  )

  // 初始加载
  useEffect(() => {
    if (!marketCache.isLoaded && !marketCache.isLoading) {
      loadSkills(true)
    }
    loadInstalledSkills(workspaceRoot || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInstalledSkills, workspaceRoot])

  // 搜索（延迟触发）
  useEffect(() => {
    if (!marketCache.isLoaded) return

    const timer = setTimeout(() => {
      const query = searchInput || 'skill'
      if (query !== marketCache.lastQuery) {
        loadSkills(true)
      }
    }, 800) // 800ms 防抖

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // 预览 Skill
  const handlePreview = async (skill: { name: string; githubUrl?: string }) => {
    if (!skill.githubUrl) {
      toast.error('该 Skill 没有提供仓库地址')
      return
    }

    // 构造虚拟路径用于标识市场预览文件
    const previewPath = `skill-market://preview/${skill.name}/SKILL.md`

    // 检查是否已经打开
    const existingFile = openFiles.find((file) => file.path === previewPath)
    if (existingFile) {
      const tabId = getTabId(existingFile)
      setActiveFile(tabId)
      return
    }

    try {
      // 通过后端服务获取内容
      const content = await window.api.skills.fetchContent(skill.githubUrl)

      addFile({
        path: previewPath,
        name: `${skill.name} - SKILL.md (预览)`,
        content,
        language: 'markdown',
        isDirty: false,
        readOnly: true
      })

    } catch (error) {
      toast.error('加载预览失败，请稍后重试')
    }
  }

  // 安装 Skill
  const handleInstall = async (
    skill: { name: string; githubUrl?: string },
    scope: 'user' | 'project'
  ) => {
    if (!skill.githubUrl) {
      toast.error('该 Skill 没有提供仓库地址')
      return
    }

    // 设置安装中状态
    setInstallingSkill(skill.name)

    const scopeText = scope === 'project' ? '项目' : '全局'
    const toastId = `install-${skill.name}`
    toast.loading(`正在安装到${scopeText}...`, { id: toastId })

    try {
      await window.api.skills.installFromGit(
        skill.githubUrl,
        skill.name,
        scope,
        scope === 'project' ? workspaceRoot || undefined : undefined
      )
      await loadInstalledSkills(workspaceRoot || undefined)
      toast.success(`${skill.name} 已安装到${scopeText}`, { id: toastId })
    } catch (error) {
      // 隐藏底层错误细节，统一提示重试
      toast.error('安装失败，请稍后重试', {
        id: toastId
      })
    } finally {
      // 清除安装中状态
      setInstallingSkill(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {loading && searchInput
              ? '搜索中...'
              : searchInput && marketCache.lastQuery === (searchInput || 'skill')
                ? `搜索到 ${total} 个技能`
                : '技能市场'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/50"
            onClick={() => {
              setSearchInput('')
              loadSkills(true)
              loadInstalledSkills(workspaceRoot || undefined)
            }}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索技能..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4 text-center">
            <Search className="size-8 mb-2 opacity-50" />
            <p className="text-sm">未找到相关技能</p>
            <p className="text-xs opacity-70 mt-1">尝试使用不同的关键词</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {skills.map((skill) => {
              const installed = isInstalled(skill.name)
              const installing = installingSkill === skill.name

              return (
                <div
                  key={skill.id}
                  className="group relative rounded-lg border border-border/50 bg-card/30 p-3 hover:bg-accent/30 hover:border-border transition-colors cursor-pointer"
                  onClick={() => handlePreview(skill)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate mb-1">{skill.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {skill.description}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {skill.githubUrl && (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              window.api.shell.openExternal(skill.githubUrl!)
                            }}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                            title="在浏览器中打开"
                          >
                            <ExternalLink className="size-3" />
                            <span>GitHub</span>
                          </a>
                        )}
                        {skill.author && <span>by {skill.author}</span>}
                      </div>
                    </div>

                    {/* Install Split Button */}
                    {installed ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-[11px] shrink-0"
                        disabled
                      >
                        <Check className="size-2.5 mr-1" />
                        已安装
                      </Button>
                    ) : installing ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-6 px-2 text-[11px] shrink-0"
                        disabled
                      >
                        <Loader2 className="size-2.5 mr-1 animate-spin" />
                        安装中
                      </Button>
                    ) : (
                      <div className="flex shrink-0">
                        {/* 主按钮：默认安装到项目 */}
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 px-2 text-[11px] rounded-r-none"
                          disabled={!skill.githubUrl || installing}
                          title={!skill.githubUrl ? '该技能暂无安装源' : undefined}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleInstall(skill, 'project')
                          }}
                        >
                          <Download className="size-2.5 mr-1" />
                          安装
                        </Button>
                        {/* 下拉按钮：选择全局安装 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-6 w-5 px-0 rounded-l-none border-l border-primary-foreground/20"
                              disabled={!skill.githubUrl || installing}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ChevronDown className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleInstall(skill, 'user')
                              }}
                            >
                              <Globe className="size-3 mr-2" />
                              全局安装
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
