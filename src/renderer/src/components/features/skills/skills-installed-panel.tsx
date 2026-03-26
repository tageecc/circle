import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, RefreshCw, Puzzle, FolderOpen, Trash2, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { useSettings } from '@/contexts/settings-context'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useFileStore, getTabId } from '@/stores/file.store'
import type { SkillDefinition, FailedSkill } from '@/types/skills'

export function SkillsInstalledPanel() {
  const workspaceRoot = useWorkspaceStore((state) => state.workspaceRoot)
  const { skillsSettings } = useSettings()
  const { openFiles, addFile, setActiveFile, activeFile } = useFileStore()
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [failedSkills, setFailedSkills] = useState<FailedSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletePopoverOpen, setDeletePopoverOpen] = useState<string | null>(null)

  // 使用 useMemo 缓存序列化结果，只在数组内容变化时重新计算
  const scanDirsKey = useMemo(
    () => JSON.stringify([...skillsSettings.scanDirectories].sort()),
    [skillsSettings.scanDirectories]
  )

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.skills.scan(workspaceRoot || undefined)
      setSkills(result?.skills || [])
      setFailedSkills(result?.failedSkills || [])
    } catch (error) {
      toast.error('加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [workspaceRoot])

  useEffect(() => {
    loadSkills()
  }, [loadSkills, scanDirsKey])

  const handleToggle = async (skillPath: string, enabled: boolean) => {
    try {
      await window.api.skills.toggle(skillPath, enabled)
      setSkills((prev) => prev.map((s) => (s.skillPath === skillPath ? { ...s, enabled } : s)))
      toast.success(enabled ? '已启用' : '已禁用')
    } catch (error) {
      toast.error('操作失败，请稍后重试')
    }
  }

  const handleDelete = async (skillPath: string) => {
    try {
      // 检查是否有相关文件正在编辑器中打开
      const skillMdPath = `${skillPath}/SKILL.md`
      const openedFile = openFiles.find((file) => file.path === skillMdPath)
      
      await window.api.skills.delete(skillPath)
      setSkills((prev) => prev.filter((s) => s.skillPath !== skillPath))
      setFailedSkills((prev) => prev.filter((s) => s.skillPath !== skillPath))
      setDeletePopoverOpen(null)
      
      // 如果文件正在打开，关闭它
      if (openedFile) {
        const { removeFile } = useFileStore.getState()
        const tabId = getTabId(openedFile)
        removeFile(tabId)
      }
      
      toast.success('已删除')
    } catch (error) {
      toast.error('删除失败，请稍后重试')
    }
  }

  // 打开 SKILL.md 文件
  const handleCardClick = async (skill: SkillDefinition) => {
    const skillMdPath = `${skill.skillPath}/SKILL.md`
    
    // 检查是否已经打开
    const existingFile = openFiles.find((file) => file.path === skillMdPath)
    
    if (existingFile) {
      // 如果已经打开，直接激活该 tab
      const tabId = getTabId(existingFile)
      setActiveFile(tabId)
    } else {
      // 如果没有打开，读取文件内容并添加到编辑器
      try {
        const content = await window.api.files.read(skillMdPath)
        addFile({
          path: skillMdPath,
          name: 'SKILL.md',
          content,
          language: 'markdown',
          isDirty: false,
          isPreview: false,
          encoding: 'utf-8',
          lineEnding: 'LF'
        })
      } catch (error) {
        toast.error('打开失败，请稍后重试')
      }
    }
  }

  // 将失败的 skills 转换为特殊的卡片数据
  const failedSkillsAsCards = failedSkills.map(fs => ({
    metadata: {
      name: fs.skillPath.split('/').pop() || 'Unknown',
      description: `解析失败: ${fs.error}`,
      tags: fs.errorDetails ? ['error'] : []
    },
    instructions: '',
    skillPath: fs.skillPath,
    enabled: false,
    scope: fs.scope,
    isFailed: true,
    errorDetails: fs.errorDetails
  }))
  
  // 合并成功和失败的 skills，然后统一搜索
  type SkillCard = SkillDefinition & { isFailed?: boolean; errorDetails?: string }
  const allSkills: SkillCard[] = [...skills, ...failedSkillsAsCards]
  
  const filteredSkills = allSkills.filter((skill) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      skill.metadata.name.toLowerCase().includes(query) ||
      skill.metadata.description.toLowerCase().includes(query) ||
      skill.metadata.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
      (skill.isFailed && skill.errorDetails?.toLowerCase().includes(query))
    )
  })
  
  // 按 scope 分组
  const allProjectSkills = filteredSkills.filter((s) => s.scope === 'project')
  const allUserSkills = filteredSkills.filter((s) => s.scope === 'user')

  // 渲染技能卡片（包括失败的）
  const renderSkillCard = (skill: SkillCard) => {
    const skillMdPath = `${skill.skillPath}/SKILL.md`
    const isActive = openFiles.some(
      (file) => getTabId(file) === activeFile && file.path === skillMdPath
    )

    return (
      <div
        key={skill.skillPath}
        className={cn(
          'group rounded-lg border transition-all',
          skill.isFailed 
            ? 'border-destructive/30 bg-destructive/5' 
            : isActive 
              ? 'border-primary bg-primary/5' 
              : 'border-border/50 hover:border-border'
        )}
      >
        <div
          className={cn(
            'p-3 cursor-pointer transition-colors',
            isActive ? 'bg-primary/5' : 'hover:bg-accent/30'
          )}
          onClick={() => handleCardClick(skill)}
        >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "shrink-0 w-10 h-10 rounded-md flex items-center justify-center",
            skill.isFailed ? "bg-destructive/10" : "bg-muted"
          )}>
            {skill.isFailed ? (
              <AlertCircle className="size-5 text-destructive" />
            ) : (
              <Puzzle className="size-5 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-medium text-foreground truncate">
                {skill.metadata.name}
              </h3>

              {/* 操作按钮 - 右侧对齐 */}
              <div className="flex items-center gap-1 shrink-0">
                {/* 打开文件夹按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.api.files.openPath(skill.skillPath).catch(console.error)
                  }}
                  title="打开目录"
                >
                  <FolderOpen className="size-3" />
                </Button>

                {/* 删除按钮 - Popover 确认 */}
                <Popover
                  open={deletePopoverOpen === skill.skillPath}
                  onOpenChange={(open) => setDeletePopoverOpen(open ? skill.skillPath : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      title="删除"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-1">确认删除</h4>
                        <p className="text-xs text-muted-foreground">
                          将永久删除技能文件夹，此操作无法撤销
                        </p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletePopoverOpen(null)
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(skill.skillPath)
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 开关 - 调小（失败的不显示） */}
                {!skill.isFailed && (
                  <div
                    className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={skill.enabled ?? true}
                      onCheckedChange={(checked) => handleToggle(skill.skillPath, checked)}
                      className="scale-75"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 描述 - 最多两行 */}
            <p className={cn(
              "text-xs line-clamp-2 mb-2",
              skill.isFailed ? "text-destructive/70" : "text-muted-foreground"
            )}>
              {skill.metadata.description || '暂无描述'}
            </p>
            
            {/* 错误详情 - 仅失败的 skill 显示 */}
            {skill.isFailed && skill.errorDetails && (
              <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2" title={skill.errorDetails}>
                {skill.errorDetails}
              </p>
            )}

            {/* 底部信息：GitHub 链接和标签 */}
            {(skill.metadata.homepage || (skill.metadata.tags && skill.metadata.tags.length > 0)) && (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {/* GitHub 链接 */}
                {skill.metadata.homepage && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      window.api.shell.openExternal(skill.metadata.homepage!)
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    title="在浏览器中打开"
                  >
                    <ExternalLink className="size-3" />
                    <span>GitHub</span>
                  </a>
                )}
                
                {/* 标签 */}
                {skill.metadata.tags && skill.metadata.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    {skill.metadata.tags.slice(0, 3).map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                    {skill.metadata.tags.length > 3 && <span>+{skill.metadata.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground">
            {skills.length + failedSkills.length} 个技能 · {skills.filter((s) => s.enabled).length} 个已启用
            {failedSkills.length > 0 && (
              <span className="text-destructive ml-1.5">· {failedSkills.length} 个有错误</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/50"
            onClick={loadSkills}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>

        {/* 搜索 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* 技能列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Puzzle className="size-8 mb-2 opacity-50" />
            <p className="text-xs">{searchQuery ? '未找到匹配的技能' : '暂无技能'}</p>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={['project', 'user']} className="w-full">
            {/* 项目级技能 */}
            {allProjectSkills.length > 0 && (
              <AccordionItem value="project" className="border-none">
                <AccordionTrigger className="px-3 py-2 hover:bg-accent/30 hover:no-underline text-xs font-medium uppercase tracking-wide">
                  项目技能 ({allProjectSkills.length})
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="space-y-2 p-2">{allProjectSkills.map(renderSkillCard)}</div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 全局技能 */}
            {allUserSkills.length > 0 && (
              <AccordionItem value="user" className="border-none">
                <AccordionTrigger className="px-3 py-2 hover:bg-accent/30 hover:no-underline text-xs font-medium uppercase tracking-wide">
                  全局技能 ({allUserSkills.length})
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="space-y-2 p-2">{allUserSkills.map(renderSkillCard)}</div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>
    </div>
  )
}
