import { useEffect, useMemo, useCallback, useRef } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { PanelResizeHandle } from 'react-resizable-panels'
import { useSettings } from '@/contexts/settings-context'
import { toast } from '@/components/ui/sonner'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useFileManager } from '@/hooks/use-file-manager'
import { useMenuEvents } from '@/hooks/use-menu-events'
import { useProjectManager } from '@/hooks/use-project-manager'
import { useGitManager, refreshGitStatus } from '@/hooks/use-git-manager'
import { useLayoutManager } from '@/hooks/use-layout-manager'
import { useEditorState } from '@/hooks/use-editor-state'
import { useEditorSync } from '@/hooks/use-editor-sync'
import { useProjectOperations } from '@/hooks/use-project-operations'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'
import { useFileGitSync } from '@/hooks/use-file-git-sync'
import { usePendingEdits } from '@/hooks/use-pending-edits'
import { isMarkdownFile, isImageFile, getLanguageFromFileName } from '@/utils/file-helpers'
import { EditorArea } from '@/components/features/editor/editor-area'
import { LeftPanel } from '@/components/features/layout/left-panel'
import { RightPanel } from '@/components/features/layout/right-panel'
import { BottomPanel } from '@/components/features/layout/bottom-panel'
import { ActivityBar } from '@/components/features/layout/activity-bar'
import { StatusBar } from '@/components/features/layout/status-bar'
import { WorkspaceDialogs } from '@/components/features/layout/workspace-dialogs'
import { WelcomeView } from '@/components/features/layout/welcome-view'
import { LoadingScreen } from '@/components/features/layout/loading-screen'
import { CloneRepositoryDialog } from '@/components/features/git/clone-repository-dialog'
import { EditorProvider } from '@/contexts/editor-context'
import { useTranslation } from 'react-i18next'

export function IDEPage(): React.ReactElement {
  const { t } = useTranslation()
  const { generalSettings } = useSettings()

  // Workspace UI Store - 布局和 UI 状态（精确订阅）
  const showFileTree = useWorkspaceUIStore((state) => state.showFileTree)
  const showChatSidebar = useWorkspaceUIStore((state) => state.showChatSidebar)
  const chatInitialized = useWorkspaceUIStore((state) => state.chatInitialized)
  const activeLeftTab = useWorkspaceUIStore((state) => state.activeLeftTab)
  const setActiveLeftTab = useWorkspaceUIStore((state) => state.setActiveLeftTab)
  const setFullscreen = useWorkspaceUIStore((state) => state.setFullscreen)

  // 对话框状态和控制（统一从 Zustand 获取）
  const cloneDialogOpen = useWorkspaceUIStore((state) => state.cloneDialogOpen)
  const openDialog = useWorkspaceUIStore((state) => state.openDialog)
  const closeDialog = useWorkspaceUIStore((state) => state.closeDialog)

  // Workspace Store - 工作区数据（统一的状态源）
  const workspaceRoot = useWorkspaceStore((state) => state.workspaceRoot)
  const setWorkspaceRoot = useWorkspaceStore((state) => state.setWorkspaceRoot)

  // Project management - 现在统一使用 Zustand 管理 workspaceRoot
  const {
    recentProjects,
    loading,
    loadProjectState,
    openProject,
    openRecentProject,
    closeProject
  } = useProjectManager()

  // Managers
  const fileManager = useFileManager(workspaceRoot)
  const { gitFileStatus, isGitRepo } = useGitManager(workspaceRoot)
  const branchCompare = useWorkspaceUIStore((state) => state.branchCompare)

  // ✅ 布局管理 - 只获取本地状态和操作
  const { panelLayout, isLayoutReady, updatePanelLayout } = useLayoutManager()

  const expandedDirs = useWorkspaceUIStore((state) => state.expandedDirs)
  const setExpandedDirs = useWorkspaceUIStore((state) => state.setExpandedDirs)

  const { cursorPosition, markdownMode, setMarkdownMode, updateCursorPosition, updateDiagnostics } =
    useEditorState()

  // Editor sync
  const { restoreEditorState } = useEditorSync({
    workspaceRoot,
    fileManager,
    expandedDirs,
    loading,
    autoSave: generalSettings.autoSave,
    setExpandedDirs
  })

  // 项目操作 - setWorkspaceRoot 从 Zustand 获取
  const {
    handleOpenProject,
    handleOpenRecentProject,
    handleProjectCreated,
    handleCloneSuccess,
    pendingProject,
    setPendingProject,
    handleProjectSelection
  } = useProjectOperations({
    openProject,
    openRecentProject,
    setWorkspaceRoot,
    restoreEditorState,
    currentWorkspaceRoot: workspaceRoot
  })

  // 全局快捷键
  useGlobalShortcuts({
    fileManager,
    openQuickOpen: () => openDialog('quickOpen')
  })

  // Git 状态同步到文件标签
  useFileGitSync({ workspaceRoot, gitFileStatus, fileManager })

  // 初始化项目状态
  useEffect(() => {
    let cancelled = false

    const initProject = async () => {
      try {
        const result = await loadProjectState()
        if (cancelled) return

        if (result?.projectNotFound && result.notFoundPath) {
          const projectName = result.notFoundPath.split('/').pop() || result.notFoundPath
          toast.error(t('ide.project_missing_title', { name: projectName }), {
            description: t('ide.project_missing_description'),
            duration: 5000
          })
        } else if (result?.currentProject) {
          refreshGitStatus()
          restoreEditorState(result.currentProject)
        }

      } catch (error) {
        console.error('Failed to initialize project:', error)
      }
    }

    initProject()
    return () => {
      cancelled = true
    }
  }, [t])

  // 监听应用退出时保存所有 dirty 文件
  useEffect(() => {
    const handleSaveAllBeforeQuit = () => {
      const dirtyFiles = fileManager.openFiles.filter((f) => f.isDirty && !f.showDiff)
      dirtyFiles.forEach((file) => {
        try {
          fileManager.saveFile(file.path)
        } catch (error) {
          console.error(`Failed to save ${file.name}:`, error)
        }
      })
    }

    const cleanup = window.electron?.ipcRenderer.on(
      'app:save-all-before-quit',
      handleSaveAllBeforeQuit
    )
    return () => cleanup?.()
  }, [fileManager])

  // 监听外部Git变化（git checkout, git pull等）
  useEffect(() => {
    if (!workspaceRoot) return

    const cleanup = window.api.files.onGitExternalChange?.(({ projectPath }) => {
      if (projectPath === workspaceRoot) {
        refreshGitStatus(workspaceRoot)
      }
    })

    return () => cleanup?.()
  }, [workspaceRoot])

  // 监听原生菜单事件（必须在所有条件 return 之前）
  useMenuEvents({
    fileManager,
    handleOpenProject,
    handleOpenRecentProject,
    closeProject
  })

  // 监听新窗口打开项目事件
  useEffect(() => {
    const unsubscribe = window.api.window.onOpenProject(async ({ projectPath }) => {
      console.log('🪟 New window received project path:', projectPath)
      try {
        // 在新窗口中打开项目
        await window.api.project.setCurrent(projectPath)
        setWorkspaceRoot(projectPath)
        await restoreEditorState(projectPath)
        refreshGitStatus(projectPath)
      } catch (error) {
        console.error('Failed to load project in new window:', error)
        toast.error(t('ide.project_load_failed'), {
          description: error instanceof Error ? error.message : t('errors.unknown_error')
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [setWorkspaceRoot, restoreEditorState, t])

  // ⭐ 监听全屏状态变化（macOS 优化：动态调整红绿灯预留空间）
  useEffect(() => {
    const unsubscribe = window.api.window.onFullscreenChange?.((fullscreen) => {
      setFullscreen(fullscreen)
    })

    return () => unsubscribe?.()
  }, [setFullscreen])

  // 获取当前文件及其属性
  const currentFile = useMemo(() => fileManager.getCurrentFile(), [fileManager])
  const currentLanguage = currentFile ? getLanguageFromFileName(currentFile.name) : 'plaintext'
  const currentFileEncoding = currentFile?.encoding || 'UTF-8'
  const currentLineEnding = currentFile?.lineEnding || 'LF'
  const isCurrentFileMarkdown = currentFile ? isMarkdownFile(currentFile.name) : false
  const isCurrentFileImage = currentFile ? isImageFile(currentFile.name) : false

  // Pending edits
  const { edits: pendingFileEdits, acceptEdit, rejectEdit } = usePendingEdits(workspaceRoot)

  // 优化 EditorArea 的回调函数，避免每次渲染创建新函数
  const handleContentChange = useCallback(
    (path: string, content: string) => {
      fileManager.updateContent(path, content)
    },
    [fileManager]
  )

  const handleSave = useCallback(
    (path: string, content: string) => {
      fileManager.saveFile(path, content, () => refreshGitStatus())
    },
    [fileManager]
  )

  const handleGitRefresh = useCallback(() => {
    refreshGitStatus()
  }, [])

  const handleResolveConflict = useCallback(
    async (filePath: string, resolvedContent: string) => {
      if (!workspaceRoot) return
      try {
        const relativePath = filePath.replace(workspaceRoot + '/', '')
        await window.api.git.resolveConflict(workspaceRoot, relativePath, resolvedContent)
        const conflictTabId = `${filePath}:conflict`
        fileManager.closeFile(conflictTabId)
        refreshGitStatus()
        toast.success(t('ide.conflict_resolved'), { description: relativePath })
      } catch (error) {
        toast.error(t('ide.resolve_conflict_failed'), {
          description: error instanceof Error ? error.message : t('errors.unknown_error')
        })
      }
    },
    [workspaceRoot, fileManager, t]
  )

  const handleCancelConflict = useCallback(() => {
    if (!fileManager.activeFile) return
    fileManager.closeFile(fileManager.activeFile)
  }, [fileManager])

  const handleAcceptPendingDiff = useCallback(
    async (absolutePath: string) => {
      await acceptEdit(absolutePath)
    },
    [acceptEdit]
  )

  const handleRejectPendingDiff = useCallback(
    async (absolutePath: string) => {
      await rejectEdit(absolutePath, { fileManager })
    },
    [rejectEdit, fileManager]
  )

  const handleOpenFile = useCallback(
    async (absolutePath: string) => {
      await fileManager.openFile(absolutePath)
    },
    [fileManager]
  )

  // EditorProvider value - 保留 EditorContext 用于依赖注入
  const editorContextValue = useMemo(
    () => ({
      activeFile: fileManager.activeFile,
      cursorPosition,
      language: currentLanguage,
      fileEncoding: currentFileEncoding,
      lineEnding: currentLineEnding,
      fileManager
    }),
    [fileManager, cursorPosition, currentLanguage, currentFileEncoding, currentLineEnding]
  )

  // 稳定的 defaultSize，使用 ref 避免拖拽时的重渲染冲突
  // 只在面板切换时（PanelGroup 重新挂载）更新 defaultSize
  const prevLayoutKey = useRef(`${showFileTree}-${showChatSidebar}`)
  const stableDefaultSizesRef = useRef({
    fileTreeSize: 20,
    chatPanelSize: 20
  })

  // 检测面板切换（key 变化）时更新 defaultSize
  const currentLayoutKey = `${showFileTree}-${showChatSidebar}`
  if (currentLayoutKey !== prevLayoutKey.current && isLayoutReady) {
    prevLayoutKey.current = currentLayoutKey
    stableDefaultSizesRef.current = {
      fileTreeSize: Math.min(Math.max(panelLayout.fileTreeSize, 15), 40),
      chatPanelSize: Math.min(Math.max(panelLayout.chatPanelSize, 20), 40)
    }
  }

  const stableDefaultSizes = stableDefaultSizesRef.current

  if (loading || !isLayoutReady) {
    return <LoadingScreen />
  }

  if (!workspaceRoot) {
    // 转换 Date 类型为字符串格式以匹配 WelcomeView 的期望
    const formattedRecentProjects = recentProjects.map((project) => ({
      ...project,
      lastOpened: new Date(project.lastOpened).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }))

    return (
      <>
        <WelcomeView
          recentProjects={formattedRecentProjects}
          onOpenProject={handleOpenProject}
          onOpenRecentProject={handleOpenRecentProject}
          onCloneRepository={() => openDialog('clone')}
          onProjectCreated={handleProjectCreated}
        />
        {/* Clone Repository 对话框 - 在欢迎页也需要渲染 */}
        <CloneRepositoryDialog
          open={cloneDialogOpen}
          onClose={() => closeDialog('clone')}
          onSuccess={async (projectPath) => {
            closeDialog('clone')
            await handleCloneSuccess(projectPath)
          }}
        />
      </>
    )
  }

  return (
    <EditorProvider value={editorContextValue}>
      <div className="flex h-full w-full flex-col">
        <div className="relative flex flex-1 overflow-hidden">
          {/* 最左侧的 ActivityBar */}
          <ActivityBar
            activeTab={activeLeftTab}
            onTabChange={setActiveLeftTab}
            showGitTab={isGitRepo}
            showCompareTab={!!branchCompare}
          />

          <PanelGroup
            direction="horizontal"
            onLayout={updatePanelLayout}
            key={`layout-${showFileTree}-${showChatSidebar}`}
          >
            {showFileTree && (
              <>
                <Panel
                  id="file-tree-panel"
                  defaultSize={stableDefaultSizes.fileTreeSize}
                  minSize={15}
                  maxSize={40}
                >
                  <LeftPanel workspaceRoot={workspaceRoot} />
                </Panel>
                <PanelResizeHandle className="w-px bg-border/50 hover:bg-primary hover:w-1 transition-all" />
              </>
            )}

            {/* 中间编辑器区域（包含底部面板） */}
            <Panel id="editor-panel" minSize={30} className="flex">
              <PanelGroup direction="vertical">
                <Panel id="editor-content" minSize={30}>
                  <EditorArea
                    openFiles={fileManager.openFiles}
                    activeFile={fileManager.activeFile}
                    currentFile={currentFile || undefined}
                    workspaceRoot={workspaceRoot}
                    autoSave={generalSettings.autoSave}
                    isMarkdown={isCurrentFileMarkdown}
                    isImage={isCurrentFileImage}
                    markdownMode={markdownMode}
                    pendingFileEdits={pendingFileEdits}
                    onTabClick={fileManager.setActiveFile}
                    onTabClose={fileManager.closeFile}
                    onCloseOthers={fileManager.closeOthers}
                    onCloseToRight={fileManager.closeToRight}
                    onCloseAll={fileManager.closeAll}
                    onMarkdownModeChange={setMarkdownMode}
                    onContentChange={handleContentChange}
                    onSave={handleSave}
                    onDiagnosticsChange={updateDiagnostics}
                    onCursorPositionChange={updateCursorPosition}
                    onReorder={fileManager.reorderTabs}
                    onGitRefresh={handleGitRefresh}
                    onResolveConflict={handleResolveConflict}
                    onCancelConflict={handleCancelConflict}
                    onAcceptPendingDiff={handleAcceptPendingDiff}
                    onRejectPendingDiff={handleRejectPendingDiff}
                    onOpenFile={handleOpenFile}
                  />
                </Panel>
                <BottomPanel workspaceRoot={workspaceRoot} />
              </PanelGroup>
            </Panel>

            {showChatSidebar && (
              <>
                <PanelResizeHandle className="w-px bg-border/50 hover:bg-primary hover:w-1 transition-all" />
                <Panel
                  id="chat-panel"
                  defaultSize={stableDefaultSizes.chatPanelSize}
                  minSize={20}
                  maxSize={40}
                >
                  <RightPanel workspaceRoot={workspaceRoot} />
                </Panel>
              </>
            )}

            {/* Chat 组件保活：即使折叠也渲染（用于保持 WebSocket 连接） */}
            {!showChatSidebar && chatInitialized && (
              <div className="hidden">
                <RightPanel workspaceRoot={workspaceRoot} />
              </div>
            )}
          </PanelGroup>
        </div>

        <StatusBar
          hasGitChanges={gitFileStatus ? Object.keys(gitFileStatus).length > 0 : false}
          onProjectChange={handleOpenRecentProject}
          onGitStatusChange={handleGitRefresh}
        />

        <WorkspaceDialogs
          workspaceRoot={workspaceRoot}
          setWorkspaceRoot={setWorkspaceRoot}
          pendingProject={pendingProject}
          onProjectConfirm={handleProjectSelection}
          onProjectConfirmCancel={() => setPendingProject(null)}
        />
      </div>
    </EditorProvider>
  )
}
