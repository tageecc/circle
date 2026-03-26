import { memo, useEffect, useRef, useState } from 'react'
import { FileTree } from './file-tree'
import { SearchPanel } from '../search/search-panel'
import { GitCommitPanel } from '../git/git-commit-panel'
import { GitStashPanel } from '../git/git-stash-panel'
import { GitHistoryPanel } from '../git/git-history-panel'
import { GitBranchComparePanel } from '../git/git-branch-compare-panel'
import { MCPMarketPanel } from '../mcp/mcp-market-panel'
import { SkillsPanel } from '../skills/skills-panel'
import { EmptyState } from '../common/empty-state'
import { GitBranch } from 'lucide-react'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useFileManager } from '@/hooks/use-file-manager'
import { useGitManager, refreshGitStatus } from '@/hooks/use-git-manager'
import { useFileTreeOperations } from '@/hooks/use-file-tree-operations'
import { useConfirm } from '../common/confirm-provider'
import { useSettings } from '@/contexts/settings-context'
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/event-bus'
import { toast } from 'sonner'

interface LeftPanelProps {
  workspaceRoot: string
}

const TAB_TITLES: Record<string, string> = {
  explorer: '资源管理器',
  search: '搜索',
  changes: '源代码管理',
  history: 'Git 历史',
  compare: '比较分支',
  skills: 'Agent Skills',
  mcp: 'MCP 市场'
}

export const LeftPanel = memo(function LeftPanel({ workspaceRoot }: LeftPanelProps) {
  const confirm = useConfirm()
  const [isInitializing, setIsInitializing] = useState(false)

  // Store - 使用精确订阅
  const activeLeftTab = useWorkspaceUIStore((state) => state.activeLeftTab)
  const clipboard = useWorkspaceUIStore((state) => state.clipboard)
  const changesExpanded = useWorkspaceUIStore((state) => state.changesExpanded)
  const stashesExpanded = useWorkspaceUIStore((state) => state.stashesExpanded)
  const branchCompare = useWorkspaceUIStore((state) => state.branchCompare)
  const fileTreeRefreshKey = useWorkspaceUIStore((state) => state.fileTreeRefreshKey)
  const setActiveLeftTab = useWorkspaceUIStore((state) => state.setActiveLeftTab)
  const setClipboard = useWorkspaceUIStore((state) => state.setClipboard)
  const setNewItemParentPath = useWorkspaceUIStore((state) => state.setNewItemParentPath)
  const setChangesExpanded = useWorkspaceUIStore((state) => state.setChangesExpanded)
  const setStashesExpanded = useWorkspaceUIStore((state) => state.setStashesExpanded)
  const setBranchCompare = useWorkspaceUIStore((state) => state.setBranchCompare)
  const refreshFileTree = useWorkspaceUIStore((state) => state.refreshFileTree)
  const openDialog = useWorkspaceUIStore((state) => state.openDialog)

  // Hooks
  const fileManager = useFileManager(workspaceRoot)
  const { isGitRepo, currentBranch, gitFileStatus } = useGitManager(workspaceRoot)
  const expandedDirs = useWorkspaceUIStore((state) => state.expandedDirs)
  const setExpandedDirs = useWorkspaceUIStore((state) => state.setExpandedDirs)
  const { generalSettings } = useSettings()
  const fileTreeOps = useFileTreeOperations({
    workspaceRoot,
    fileManager,
    confirm,
    refreshFileTree
  })

  // 监听预览开关变化，关闭时将所有预览标签转为永久标签
  const prevPreviewEnabled = useRef(generalSettings.enableFilePreviewOnSingleClick)
  useEffect(() => {
    if (prevPreviewEnabled.current && !generalSettings.enableFilePreviewOnSingleClick) {
      // 从开启变为关闭：转换所有预览标签
      fileManager.convertAllPreviewToPermanent()
    }
    prevPreviewEnabled.current = generalSettings.enableFilePreviewOnSingleClick
  }, [generalSettings.enableFilePreviewOnSingleClick, fileManager.convertAllPreviewToPermanent])

  // 全屏状态（用于动态调整标题栏 padding）
  const isFullscreen = useWorkspaceUIStore((state) => state.isFullscreen)

  // 初始化 Git 仓库
  const handleInitGitRepo = async () => {
    try {
      setIsInitializing(true)
      await window.api.git.initRepository(workspaceRoot)
      toast.success('Git 仓库初始化成功')
      // 刷新 Git 状态
      await refreshGitStatus()
    } catch (error) {
      console.error('Failed to initialize git repository:', error)
      toast.error('初始化 Git 仓库失败')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar">
      {/* 顶部标题栏 */}
      <div
        className={cn(
          'h-[38px] flex items-center window-drag-region shrink-0 transition-all',
          isFullscreen ? 'px-4' : 'pl-[30px] pr-4'
        )}
      >
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {TAB_TITLES[activeLeftTab]}
        </span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {activeLeftTab === 'explorer' && (
          <FileTree
            workspaceRoot={workspaceRoot}
            onFileSelect={fileManager.openFile}
            onFilePreview={
              generalSettings.enableFilePreviewOnSingleClick
                ? (path) => fileManager.openFile(path, { isPreview: true })
                : undefined
            }
            activeFile={fileManager.activeFile}
            gitStatus={gitFileStatus}
            onNewFile={(path) => {
              setNewItemParentPath(path)
              openDialog('newFile')
            }}
            onNewFolder={(path) => {
              setNewItemParentPath(path)
              openDialog('newFolder')
            }}
            onRename={fileTreeOps.rename}
            onDelete={fileTreeOps.delete}
            onCut={(path) => fileTreeOps.cut(path, setClipboard)}
            onCopy={(path) => fileTreeOps.copy(path, setClipboard)}
            onPaste={(path) => fileTreeOps.paste(path, clipboard, () => setClipboard(null))}
            onCopyPath={fileTreeOps.copyPath}
            onRevealInFinder={fileTreeOps.revealInFinder}
            onRefresh={fileTreeOps.refresh}
            onGitRevert={fileTreeOps.gitRevert}
            onMove={fileTreeOps.move}
            clipboard={clipboard}
            initialExpandedDirs={expandedDirs}
            onExpandedDirsChange={setExpandedDirs}
            refreshTrigger={fileTreeRefreshKey}
          />
        )}

        {activeLeftTab === 'search' && (
          <SearchPanel
            workspaceRoot={workspaceRoot}
            onFileClick={(filePath, line, column, length) => {
              fileManager.openFile(filePath)
              setTimeout(() => {
                eventBus.emit('editor-goto-line', {
                  filePath,
                  line: line || 1,
                  column: column || 1,
                  length
                })
              }, 150)
            }}
          />
        )}

        {activeLeftTab === 'changes' && (
          <>
            {isGitRepo ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <GitCommitPanel
                  workspaceRoot={workspaceRoot}
                  gitStatus={gitFileStatus}
                  onFileClick={(filePath, options) => {
                    fileManager.openFile(`${workspaceRoot}/${filePath}`, options)
                  }}
                  onRefresh={() => refreshGitStatus()}
                  onOpenHistory={() => setActiveLeftTab('history')}
                  expanded={changesExpanded}
                  onExpandedChange={(expanded) => {
                    setChangesExpanded(expanded)
                    if (expanded) setStashesExpanded(false)
                  }}
                />
                <div
                  className={cn(
                    'border-t border-border/30 flex flex-col',
                    stashesExpanded ? 'flex-1 min-h-0' : 'shrink-0'
                  )}
                >
                  <GitStashPanel
                    workspaceRoot={workspaceRoot}
                    onRefresh={() => refreshGitStatus()}
                    onCreateStash={() => openDialog('stash')}
                    onFileClick={(stashIndex, filePath, stashMessage) => {
                      fileManager.openFile(`${workspaceRoot}/${filePath}`, {
                        stashIndex,
                        stashMessage
                      })
                    }}
                    expanded={stashesExpanded}
                    onExpandedChange={(expanded) => {
                      setStashesExpanded(expanded)
                      if (expanded) setChangesExpanded(false)
                    }}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                icon={GitBranch}
                title="未初始化 Git 仓库"
                description="当前项目还不是一个 Git 仓库。初始化 Git 仓库后，您可以使用版本控制功能来跟踪和管理代码变更。"
                action={{
                  label: isInitializing ? '初始化中...' : '初始化 Git 仓库',
                  onClick: handleInitGitRepo
                }}
              />
            )}
          </>
        )}

        {activeLeftTab === 'history' && (
          <>
            {isGitRepo ? (
              <GitHistoryPanel
                workspaceRoot={workspaceRoot}
                currentBranch={currentBranch || 'HEAD'}
                onFileClick={(filePath, commitHash) => {
                  fileManager.openFile(`${workspaceRoot}/${filePath}`, { commitHash })
                }}
                onRefresh={() => refreshGitStatus()}
              />
            ) : (
              <EmptyState
                icon={GitBranch}
                title="未初始化 Git 仓库"
                description="当前项目还不是一个 Git 仓库。初始化 Git 仓库后，您可以查看提交历史和分支信息。"
                action={{
                  label: isInitializing ? '初始化中...' : '初始化 Git 仓库',
                  onClick: handleInitGitRepo
                }}
              />
            )}
          </>
        )}

        {activeLeftTab === 'compare' && branchCompare && (
          <GitBranchComparePanel
            workspaceRoot={workspaceRoot}
            baseBranch={branchCompare.baseBranch}
            compareBranch={branchCompare.compareBranch}
            onFileClick={(file) => {
              fileManager.openFile(`${workspaceRoot}/${file.path}`, {
                baseBranch: branchCompare.baseBranch,
                compareBranch: branchCompare.compareBranch
              })
            }}
            onClose={() => {
              setBranchCompare(null)
              setActiveLeftTab('explorer')
            }}
            onSwapBranches={() => {
              setBranchCompare({
                baseBranch: branchCompare.compareBranch,
                compareBranch: branchCompare.baseBranch
              })
            }}
          />
        )}

        {activeLeftTab === 'skills' && <SkillsPanel />}

        {activeLeftTab === 'mcp' && <MCPMarketPanel />}
      </div>
    </div>
  )
})
