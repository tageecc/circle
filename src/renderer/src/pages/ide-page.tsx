import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@/components/ui/button'
import { PanelLeft, PanelRight, Settings, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'
import { useConfirm } from '@/components/shared/ConfirmProvider'
import { toast } from 'sonner'
import { ClipboardItem } from '@/features/ide/types'
import {
  useFileManager,
  useProjectManager,
  useGitManager,
  useLayoutManager,
  useEditorState
} from '@/features/ide/hooks'
import {
  isMarkdownFile,
  isImageFile,
  getLanguageFromFileName,
  getFileNameFromPath
} from '@/features/ide/utils/file-helpers'
import { MenuBar } from '@/features/ide/components/menu-bar'
import { EditorArea } from '@/features/ide/components/editor'
import { FileTree } from '@/components/code/FileTree'
import { ChatSidebar } from '@/components/code/ChatSidebar'
import { TerminalPanel } from '@/components/terminal'
import { ProblemsPanel } from '@/components/code/ProblemsPanel'
import { StatusBar } from '@/components/code/StatusBar'
import { WelcomeView } from '@/components/code/WelcomeView'
import { CloneRepositoryDialog } from '@/components/dialogs/CloneRepositoryDialog'
import { NewProjectDialog } from '@/components/dialogs/NewProjectDialog'
import { GitPushDialog } from '@/components/dialogs/GitPushDialog'
import { GitNewBranchDialog } from '@/components/dialogs/GitNewBranchDialog'
import { InputDialog } from '@/components/dialogs/InputDialog'
import {
  GitCommitPanel,
  GitDiffViewerDialog,
  GitFileHistoryDialog,
  GitBlameViewerDialog,
  GitBranchCompareDialog
} from '@/components/git'
import { CollapsiblePanel } from '@/components/shared/CollapsiblePanel'

interface IDEPageProps {
  onOpenSettings?: () => void
}

export function IDEPage({ onOpenSettings }: IDEPageProps) {
  const { t } = useTranslation('editor')
  const tc = useTranslation('common').t
  const td = useTranslation('dialogs').t
  const { generalSettings, updateGeneralSettings } = useSettings()
  const confirm = useConfirm()

  const {
    workspaceRoot,
    recentProjects,
    loading,
    setWorkspaceRoot,
    loadProjectState,
    openProject,
    openRecentProject,
    closeProject
  } = useProjectManager()

  const fileManager = useFileManager(workspaceRoot)
  const { isGitRepo, currentBranch, gitFileStatus, checkGitStatus, pull, fetch, checkoutBranch } =
    useGitManager(workspaceRoot)
  const {
    panelLayout,
    expandedDirs,
    showFileTree,
    showChatSidebar,
    bottomPanel,
    expandedLeftPanel,
    setPanelLayout,
    setExpandedDirs,
    setBottomPanel,
    toggleLeftPanel,
    toggleFileTree,
    toggleChatSidebar,
    updatePanelLayout
  } = useLayoutManager()
  const {
    cursorPosition,
    allDiagnostics,
    markdownMode,
    setMarkdownMode,
    updateCursorPosition,
    updateDiagnostics,
    handleDiagnosticClick
  } = useEditorState()

  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null)
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0)
  const [gitRefreshKey, setGitRefreshKey] = useState(0)

  // File edit diff 状态
  const [pendingFileEdit, setPendingFileEdit] = useState<{
    toolCallId: string
    filePath: string
    absolutePath: string
    oldContent: string
    newContent: string
    language?: string
  } | null>(null)

  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [showPushDialog, setShowPushDialog] = useState(false)
  const [showNewBranchDialog, setShowNewBranchDialog] = useState(false)
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [currentOperationPath, setCurrentOperationPath] = useState<string>('')
  const [currentOperationName, setCurrentOperationName] = useState<string>('')
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<string | null>(null)

  type GitInspectState =
    | { kind: 'history'; path: string }
    | { kind: 'blame'; path: string }
    | { kind: 'branch'; path: string }
    | null
  const [gitInspect, setGitInspect] = useState<GitInspectState>(null)
  const [gitWorkingDiff, setGitWorkingDiff] = useState<{
    open: boolean
    path: string
    text: string
    loading: boolean
  }>({ open: false, path: '', text: '', loading: false })

  const prevWorkspaceRoot = useRef<string | null>(null)

  const isMac = window.api?.app?.platform === 'darwin'
  const menuHandlersRef = useRef<{
    openProject: () => void
    openRecent: (path: string) => void
    saveFile: () => void
    closeFile: () => void
    closeWorkspace: () => void
    debugConfig: () => void
  } | null>(null)

  // macOS：同步「打开最近」到原生菜单
  useEffect(() => {
    if (isMac && recentProjects.length >= 0 && window.api?.app?.setRecentProjects)
      window.api.app.setRecentProjects(recentProjects.map((p) => ({ path: p.path, name: p.name })))
  }, [isMac, recentProjects])

  // 监听 Agent 命令执行请求
  useEffect(() => {
    const cleanup = window.api.terminal.onRunCommand((command) => {
      setBottomPanel('terminal')
      setPendingTerminalCommand(command)
    })
    return cleanup
  }, [setBottomPanel])

  const restoreEditorState = useCallback(
    async (projectRoot: string) => {
      console.log('📂 Restoring editor state for:', projectRoot)

      try {
        const uiState = await window.api.config.getUIState()

        if (uiState.codeEditor?.openFiles) {
          const filePaths = uiState.codeEditor.openFiles
            .filter((f: { path: string }) => f.path.startsWith(projectRoot))
            .map((f: { path: string }) => f.path)

          if (filePaths.length > 0) {
            console.log(`📄 Restoring ${filePaths.length} files`)
            await fileManager.restoreFiles(filePaths, projectRoot)

            if (uiState.codeEditor.activeFilePath?.startsWith(projectRoot)) {
              console.log(
                '📌 Restoring active file:',
                uiState.codeEditor.activeFilePath.split('/').pop()
              )
              fileManager.setActiveFile(uiState.codeEditor.activeFilePath)
            }
          }
        }

        if (uiState.codeEditor?.panelLayout) {
          setPanelLayout(uiState.codeEditor.panelLayout)
        }

        if (uiState.codeEditor?.expandedDirs) {
          setExpandedDirs(uiState.codeEditor.expandedDirs)
        }
      } catch (error) {
        console.error('Failed to restore editor state:', error)
      }
    },
    [fileManager, setPanelLayout, setExpandedDirs]
  )

  useEffect(() => {
    loadProjectState().then((result) => {
      if (result?.currentProject) {
        checkGitStatus()
        restoreEditorState(result.currentProject)
      }
    })
  }, [])

  useEffect(() => {
    if (prevWorkspaceRoot.current !== null && prevWorkspaceRoot.current !== workspaceRoot) {
      fileManager.clearAllFiles()
    }
    prevWorkspaceRoot.current = workspaceRoot
  }, [workspaceRoot, fileManager])

  // 文件监听器 - 使用 ref 来避免依赖问题
  const fileManagerRef = useRef(fileManager)
  const checkGitStatusRef = useRef(checkGitStatus)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fileManagerRef.current = fileManager
    checkGitStatusRef.current = checkGitStatus
  })

  useEffect(() => {
    if (!workspaceRoot) return

    const cleanup = window.api.files.onFileChanged((event) => {
      const currentFileManager = fileManagerRef.current
      const currentCheckGitStatus = checkGitStatusRef.current

      // 忽略正在保存的文件（避免循环刷新）
      if (event.path === currentFileManager.savingFile) return

      // 检查变化的文件是否在当前打开的文件列表中
      const isFileOpen = currentFileManager.openFiles.some((f) => f.path === event.path)

      if (isFileOpen && event.type === 'change') {
        // 文件被外部修改，重新加载内容
        currentFileManager.reloadFile(event.path)
      } else if (isFileOpen && event.type === 'unlink') {
        // 文件被删除，标记为已删除
        currentFileManager.markFileAsDeleted(event.path)
      }

      // 刷新文件树和 Git 状态（防抖处理，避免批量操作时频繁刷新）
      if (event.type !== 'change') {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
        refreshTimerRef.current = setTimeout(() => {
          setFileTreeRefreshKey((prev) => prev + 1)
          currentCheckGitStatus()
        }, 300)
      }
    })

    return () => {
      cleanup()
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [workspaceRoot])

  useEffect(() => {
    if (!workspaceRoot || loading) return

    const saveEditorState = async () => {
      try {
        const editorState = {
          openFiles: fileManager.openFiles.map((f) => ({ path: f.path })),
          activeFilePath: fileManager.activeFile,
          currentProject: workspaceRoot,
          panelLayout,
          expandedDirs
        }

        console.log('💾 Saving editor state:', {
          files: editorState.openFiles.length,
          activeFile: editorState.activeFilePath?.split('/').pop() || 'none',
          expandedDirs: editorState.expandedDirs.length
        })

        await window.api.config.updateUIState({
          codeEditor: editorState
        })
      } catch (error) {
        console.error('❌ Failed to save editor state:', error)
      }
    }

    const timeoutId = setTimeout(saveEditorState, 500)
    return () => clearTimeout(timeoutId)
  }, [
    fileManager.openFiles,
    fileManager.activeFile,
    workspaceRoot,
    loading,
    panelLayout,
    expandedDirs
  ])

  // 同步Git状态到打开的文件tab
  useEffect(() => {
    if (!gitFileStatus || !workspaceRoot) return

    fileManager.openFiles.forEach((file) => {
      const relativePath = file.path.replace(workspaceRoot + '/', '')

      // 内联状态判断逻辑，避免依赖函数
      let gitStatus: import('@/features/ide/types').GitStatus = null
      if (gitFileStatus.conflicted.includes(relativePath)) gitStatus = 'conflicted'
      else if (gitFileStatus.staged.includes(relativePath)) gitStatus = 'staged'
      else if (gitFileStatus.modified.includes(relativePath)) gitStatus = 'modified'
      else if (gitFileStatus.untracked.includes(relativePath)) gitStatus = 'untracked'

      if (file.gitStatus !== gitStatus) {
        fileManager.updateFileGitStatus(file.path, gitStatus)
      }
    })
  }, [gitFileStatus, workspaceRoot])

  // 同步错误状态到打开的文件tab
  useEffect(() => {
    fileManager.openFiles.forEach((file) => {
      const fileDiagnostics = allDiagnostics[file.path] || []
      const hasErrors = fileDiagnostics.some((d) => d.severity === 'error')
      if (file.hasErrors !== hasErrors) {
        fileManager.updateFileErrorStatus(file.path, hasErrors)
      }
    })
  }, [allDiagnostics])

  useEffect(() => {
    if (!generalSettings.autoSave) return

    const timer = setTimeout(() => {
      const dirtyFiles = fileManager.openFiles.filter((f) => f.isDirty)
      dirtyFiles.forEach((f) => fileManager.saveFile(f.path, undefined, checkGitStatus))
    }, 300)

    return () => clearTimeout(timer)
  }, [generalSettings.autoSave, fileManager.openFiles, checkGitStatus])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (fileManager.activeFile) {
          fileManager.saveFile(fileManager.activeFile, undefined, checkGitStatus)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fileManager.activeFile, fileManager.saveFile, checkGitStatus])

  const handleDebugConfig = async () => {
    try {
      const result = await (window.api as any).config.debug?.()
      if (result) {
        alert(
          t('debugConfig.alert', {
            path: result.path,
            currentProject: result.config.currentProject || t('debugConfig.noProject'),
            recentCount: result.config.recentProjects?.length || 0
          })
        )
      }
    } catch (error) {
      console.error('Failed to debug config:', error)
    }
  }

  const handleOpenProject = async () => {
    const projectPath = await openProject()
    if (projectPath) {
      checkGitStatus()
      await restoreEditorState(projectPath)
    }
  }

  const handleOpenRecentProject = async (path: string) => {
    const projectPath = await openRecentProject(path)
    if (projectPath) {
      checkGitStatus()
      await restoreEditorState(projectPath)
    }
  }

  const handleCloseWorkspace = async () => {
    await closeProject()
  }

  menuHandlersRef.current = {
    openProject: handleOpenProject,
    openRecent: handleOpenRecentProject,
    saveFile: () =>
      fileManager.activeFile &&
      fileManager.saveFile(fileManager.activeFile, undefined, checkGitStatus),
    closeFile: () => fileManager.activeFile && fileManager.closeFile(fileManager.activeFile),
    closeWorkspace: handleCloseWorkspace,
    debugConfig: handleDebugConfig
  }

  useEffect(() => {
    if (!isMac || !window.api?.app?.onMenuAction) return
    const cleanup = window.api.app.onMenuAction(({ action, path }) => {
      const h = menuHandlersRef.current
      if (!h) return
      if (action === 'openProject') h.openProject()
      else if (action === 'openRecent' && path) h.openRecent(path)
      else if (action === 'saveFile') h.saveFile()
      else if (action === 'closeFile') h.closeFile()
      else if (action === 'closeWorkspace') h.closeWorkspace()
      else if (action === 'debugConfig') h.debugConfig()
    })
    return cleanup
  }, [isMac])

  const handleProjectCreated = async (projectPath: string) => {
    setWorkspaceRoot(projectPath)
    checkGitStatus()
    await restoreEditorState(projectPath)
  }

  const handleFileTreeOperation = {
    newFile: (parentPath: string) => {
      setCurrentOperationPath(parentPath)
      setShowNewFileDialog(true)
    },

    confirmNewFile: async (fileName: string) => {
      try {
        const filePath = `${currentOperationPath}/${fileName}`
        await window.api.files.createFile(filePath, '')
        toast.success(t('fileOperation.createFileSuccess'), {
          description: t('fileOperation.createFileSuccessDesc', { name: fileName })
        })
        setFileTreeRefreshKey((prev) => prev + 1)
        setTimeout(() => fileManager.openFile(filePath), 100)
      } catch (error) {
        toast.error(t('fileOperation.createFileFailed'), {
          description: error instanceof Error ? error.message : tc('message.unknownError')
        })
      }
    },

    newFolder: (parentPath: string) => {
      setCurrentOperationPath(parentPath)
      setShowNewFolderDialog(true)
    },

    confirmNewFolder: async (folderName: string) => {
      try {
        const folderPath = `${currentOperationPath}/${folderName}`
        await window.api.files.createDirectory(folderPath)
        toast.success(t('fileOperation.createFolderSuccess'), {
          description: t('fileOperation.createFolderSuccessDesc', { name: folderName })
        })
        setFileTreeRefreshKey((prev) => prev + 1)
      } catch (error) {
        toast.error(t('fileOperation.createFolderFailed'), {
          description: error instanceof Error ? error.message : tc('message.unknownError')
        })
      }
    },

    rename: (path: string) => {
      const name = getFileNameFromPath(path)
      setCurrentOperationPath(path)
      setCurrentOperationName(name)
      setShowRenameDialog(true)
    },

    confirmRename: async (newName: string) => {
      try {
        const parentPath = currentOperationPath.split('/').slice(0, -1).join('/')
        const newPath = `${parentPath}/${newName}`
        await window.api.files.rename(currentOperationPath, newPath)
        fileManager.updateFilePathAfterRename(currentOperationPath, newPath, newName)
        toast.success(t('fileOperation.renameSuccess'), {
          description: t('fileOperation.renameSuccessDesc', {
            oldName: currentOperationName,
            newName
          })
        })
        setFileTreeRefreshKey((prev) => prev + 1)
      } catch (error) {
        toast.error(t('fileOperation.renameFailed'), {
          description: error instanceof Error ? error.message : tc('message.unknownError')
        })
      }
    },

    delete: async (path: string) => {
      const name = getFileNameFromPath(path)

      const confirmed = await confirm({
        title: td('idePage.confirmDelete.title'),
        description: td('idePage.confirmDelete.description', { name }),
        confirmText: td('idePage.confirmDelete.confirm'),
        cancelText: td('confirm.cancel'),
        variant: 'destructive'
      })

      if (confirmed) {
        try {
          await window.api.files.delete(path)
          fileManager.removeDeletedFiles(path)
          toast.success(t('fileOperation.deleteSuccess'), {
            description: t('fileOperation.deleteSuccessDesc', { name })
          })
          setFileTreeRefreshKey((prev) => prev + 1)
        } catch (error) {
          toast.error(t('fileOperation.deleteFailed'), {
            description: error instanceof Error ? error.message : tc('message.unknownError')
          })
        }
      }
    },

    cut: (path: string) => {
      setClipboard({ path, type: 'cut' })
      const baseName = getFileNameFromPath(path)
      toast.success(t('fileOperation.cutSuccess'), {
        description: t('fileOperation.cutSuccessDesc', { name: baseName })
      })
    },

    copy: (path: string) => {
      setClipboard({ path, type: 'copy' })
      const baseName = getFileNameFromPath(path)
      toast.success(t('fileOperation.copySuccess'), {
        description: t('fileOperation.copySuccessDesc', { name: baseName })
      })
    },

    paste: async (targetPath: string) => {
      if (!clipboard) return

      try {
        const sourceName = getFileNameFromPath(clipboard.path)
        const destPath = `${targetPath}/${sourceName}`

        if (clipboard.type === 'copy') {
          const content = await window.api.files.read(clipboard.path)
          await window.api.files.createFile(destPath, content)
          toast.success(t('fileOperation.pasteSuccess'), {
            description: t('fileOperation.pasteSuccessCopyDesc', { name: sourceName })
          })
        } else {
          await window.api.files.rename(clipboard.path, destPath)
          fileManager.updateFilePathAfterRename(clipboard.path, destPath, sourceName)
          toast.success(t('fileOperation.pasteSuccess'), {
            description: t('fileOperation.pasteSuccessMoveDesc', { name: sourceName })
          })
          setClipboard(null)
        }

        setFileTreeRefreshKey((prev) => prev + 1)
      } catch (error) {
        toast.error(t('fileOperation.pasteFailed'), {
          description: error instanceof Error ? error.message : tc('message.unknownError')
        })
      }
    },

    copyPath: (path: string) => {
      navigator.clipboard.writeText(path)
      toast.success(t('fileOperation.copyPathSuccess'), { description: path })
    },

    revealInFinder: async (path: string) => {
      try {
        await window.api.files.revealInFinder?.(path)
      } catch (error) {
        toast.error(t('fileOperation.revealInFinderFailed'), {
          description: error instanceof Error ? error.message : tc('message.unknownError')
        })
      }
    },

    refresh: () => {
      setFileTreeRefreshKey((prev) => prev + 1)
      toast.success(t('fileOperation.refreshSuccess'), {
        description: t('fileOperation.refreshSuccessDesc')
      })
    },

    gitRevert: async (path: string) => {
      if (!workspaceRoot) return

      const confirmed = await confirm({
        title: td('idePage.gitRevert.title'),
        description: td('idePage.gitRevert.description'),
        confirmText: td('idePage.gitRevert.confirm'),
        cancelText: td('confirm.cancel'),
        variant: 'destructive'
      })

      if (confirmed) {
        try {
          await window.api.git.revertFile(workspaceRoot, path)
          toast.success(t('gitFileActions.revertSuccess'), { description: path })
          setFileTreeRefreshKey((prev) => prev + 1)
          checkGitStatus()
          // 如果文件已打开，重新加载
          if (fileManager.openFiles.some((f) => f.path === path)) {
            const content = await window.api.files.read(path)
            fileManager.updateContent(path, content)
          }
        } catch (error) {
          toast.error(t('gitFileActions.revertFailed'), {
            description: error instanceof Error ? error.message : tc('message.unknownError')
          })
        }
      }
    },

    gitShowHistory: (path: string) => {
      if (!workspaceRoot) return
      setGitInspect({ kind: 'history', path })
    },

    gitShowDiff: async (path: string) => {
      if (!workspaceRoot) return
      setGitWorkingDiff({ open: true, path, text: '', loading: true })
      try {
        const diff = await window.api.git.getWorkingDiff(workspaceRoot, path)
        if (!diff?.trim()) {
          toast.info(t('gitFileActions.noDiff'), {
            description: t('gitFileActions.noDiffDesc')
          })
          setGitWorkingDiff({ open: false, path: '', text: '', loading: false })
          return
        }
        setGitWorkingDiff({ open: true, path, text: diff, loading: false })
      } catch (error) {
        toast.error(t('gitFileActions.getDiffFailed'), {
          description: error instanceof Error ? error.message : tc('message.unknownError')
        })
        setGitWorkingDiff({ open: false, path: '', text: '', loading: false })
      }
    },

    gitAnnotate: (path: string) => {
      if (!workspaceRoot) return
      setGitInspect({ kind: 'blame', path })
    },

    gitCompareWithBranch: (filePath: string) => {
      if (!workspaceRoot) return
      setGitInspect({ kind: 'branch', path: filePath })
    }
  }

  const currentFile = fileManager.openFiles.find((f) => f.path === fileManager.activeFile)
  const isCurrentFileMarkdown = currentFile ? isMarkdownFile(currentFile.name) : false
  const isCurrentFileImage = currentFile ? isImageFile(currentFile.name) : false

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  if (!workspaceRoot) {
    return (
      <WelcomeView
        recentProjects={recentProjects}
        onOpenProject={handleOpenProject}
        onOpenRecentProject={handleOpenRecentProject}
        onCloneRepository={() => setShowCloneDialog(true)}
        onProjectCreated={handleProjectCreated}
      />
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center border-b border-border/30 bg-background px-2 py-1.5">
        {!isMac && (
          <MenuBar
            activeFile={fileManager.activeFile}
            hasOpenFiles={fileManager.openFiles.length > 0}
            workspaceRoot={workspaceRoot}
            recentProjects={recentProjects}
            autoSave={generalSettings.autoSave}
            onOpenProject={handleOpenProject}
            onOpenRecentProject={handleOpenRecentProject}
            onSaveFile={() =>
              fileManager.activeFile &&
              fileManager.saveFile(fileManager.activeFile, undefined, checkGitStatus)
            }
            onCloseFile={() =>
              fileManager.activeFile && fileManager.closeFile(fileManager.activeFile)
            }
            onCloseWorkspace={handleCloseWorkspace}
            onToggleAutoSave={(checked) => updateGeneralSettings({ autoSave: checked })}
            onDebugConfig={handleDebugConfig}
          />
        )}

        <div className="ml-auto flex items-center gap-1 pr-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 w-7 p-0 hover:bg-accent', !showFileTree && 'bg-accent')}
            onClick={toggleFileTree}
            title={t('panels.toggleFileTree')}
          >
            <PanelLeft className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 w-7 p-0 hover:bg-accent', !showChatSidebar && 'bg-accent')}
            onClick={toggleChatSidebar}
            title={t('panels.toggleChatSidebar')}
          >
            <PanelRight className="size-4" />
          </Button>

          {onOpenSettings && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-accent"
              onClick={onOpenSettings}
              title={t('panels.settingsShortcut')}
            >
              <Settings className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <PanelGroup
          direction="horizontal"
          onLayout={(sizes) => updatePanelLayout(sizes, showFileTree, showChatSidebar)}
        >
          {showFileTree && (
            <>
              <Panel defaultSize={panelLayout.fileTreeSize} minSize={15} maxSize={35}>
                <div className="flex h-full flex-col border-r border-border/30 bg-sidebar overflow-hidden">
                  <div
                    className={cn(
                      'flex flex-col transition-all duration-200',
                      expandedLeftPanel === 'explorer' ? 'flex-1 min-h-0' : 'flex-none'
                    )}
                  >
                    <FileTree
                      workspaceRoot={workspaceRoot}
                      onFileSelect={fileManager.openFile}
                      activeFile={fileManager.activeFile}
                      gitStatus={gitFileStatus}
                      onNewFile={handleFileTreeOperation.newFile}
                      onNewFolder={handleFileTreeOperation.newFolder}
                      onRename={handleFileTreeOperation.rename}
                      onDelete={handleFileTreeOperation.delete}
                      onCut={handleFileTreeOperation.cut}
                      onCopy={handleFileTreeOperation.copy}
                      onPaste={handleFileTreeOperation.paste}
                      onCopyPath={handleFileTreeOperation.copyPath}
                      onRevealInFinder={handleFileTreeOperation.revealInFinder}
                      onRefresh={handleFileTreeOperation.refresh}
                      onGitRevert={handleFileTreeOperation.gitRevert}
                      onGitShowHistory={handleFileTreeOperation.gitShowHistory}
                      onGitShowDiff={handleFileTreeOperation.gitShowDiff}
                      onGitAnnotate={handleFileTreeOperation.gitAnnotate}
                      onGitCompareWithBranch={handleFileTreeOperation.gitCompareWithBranch}
                      clipboard={clipboard}
                      initialExpandedDirs={expandedDirs}
                      onExpandedDirsChange={setExpandedDirs}
                      refreshTrigger={fileTreeRefreshKey}
                      onToggleCollapse={() => toggleLeftPanel('explorer')}
                      isExpanded={expandedLeftPanel === 'explorer'}
                    />
                  </div>

                  {isGitRepo && (
                    <div
                      className={cn(
                        'border-t border-sidebar-border/50 transition-all duration-200',
                        expandedLeftPanel === 'commit' ? 'flex-1 min-h-0' : 'flex-none'
                      )}
                    >
                      <CollapsiblePanel
                        title="Source Control"
                        isExpanded={expandedLeftPanel === 'commit'}
                        onToggle={() => toggleLeftPanel('commit')}
                        actions={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-accent/50"
                            onClick={(e) => {
                              e.stopPropagation()
                              setGitRefreshKey((prev) => prev + 1)
                            }}
                            title={tc('button.refresh')}
                          >
                            <RefreshCw className="size-3.5" />
                          </Button>
                        }
                      >
                        <GitCommitPanel
                          key={gitRefreshKey}
                          workspaceRoot={workspaceRoot}
                          onFileClick={(filePath) => {
                            fileManager.openFile(`${workspaceRoot}/${filePath}`)
                          }}
                          onSuccess={checkGitStatus}
                          onRefresh={checkGitStatus}
                        />
                      </CollapsiblePanel>
                    </div>
                  )}
                </div>
              </Panel>
              <PanelResizeHandle className="w-px bg-border/50 hover:bg-primary hover:w-1 transition-all" />
            </>
          )}

          <Panel
            defaultSize={
              showFileTree && showChatSidebar ? 60 : showFileTree || showChatSidebar ? 80 : 100
            }
            className="flex"
          >
            <PanelGroup direction="vertical">
              <Panel defaultSize={bottomPanel ? 70 : 100}>
                <EditorArea
                  openFiles={fileManager.openFiles}
                  activeFile={fileManager.activeFile}
                  currentFile={currentFile}
                  workspaceRoot={workspaceRoot}
                  autoSave={generalSettings.autoSave}
                  isMarkdown={isCurrentFileMarkdown}
                  isImage={isCurrentFileImage}
                  markdownMode={markdownMode}
                  pendingFileEdit={pendingFileEdit}
                  onTabClick={fileManager.setActiveFile}
                  onTabClose={fileManager.closeFile}
                  onCloseOthers={fileManager.closeOthers}
                  onCloseToRight={fileManager.closeToRight}
                  onCloseAll={fileManager.closeAll}
                  onMarkdownModeChange={setMarkdownMode}
                  onContentChange={fileManager.updateContent}
                  onSave={(path, content) => fileManager.saveFile(path, content, checkGitStatus)}
                  onDiagnosticsChange={updateDiagnostics}
                  onCursorPositionChange={updateCursorPosition}
                  onAcceptFileEdit={() => {
                    // 文件已在 edit_file 时写入，接受仅关闭 diff 条
                    setPendingFileEdit(null)
                  }}
                  onRejectFileEdit={async () => {
                    if (!pendingFileEdit) return
                    try {
                      await window.api.files.write(
                        pendingFileEdit.absolutePath,
                        pendingFileEdit.oldContent
                      )
                      setPendingFileEdit(null)
                      // 若该文件已打开，刷新编辑器内容
                      if (
                        fileManager.openFiles.some((f) => f.path === pendingFileEdit.absolutePath)
                      ) {
                        const content = await window.api.files.read(pendingFileEdit.absolutePath)
                        fileManager.updateContent(pendingFileEdit.absolutePath, content)
                      }
                      toast.info(t('pendingEdit.revertedToast'))
                    } catch (error) {
                      console.error('Failed to revert file:', error)
                      toast.error(t('pendingEdit.revertFailed'))
                    }
                  }}
                />
              </Panel>

              {bottomPanel && (
                <>
                  <PanelResizeHandle className="h-px bg-border/50 hover:bg-primary hover:h-1 transition-all" />

                  {bottomPanel === 'problems' ? (
                    <Panel defaultSize={25} minSize={15} maxSize={50}>
                      <ProblemsPanel
                        diagnostics={allDiagnostics}
                        onDiagnosticClick={(d) =>
                          handleDiagnosticClick(d, fileManager.activeFile, fileManager.openFile)
                        }
                        onClose={() => setBottomPanel(null)}
                      />
                    </Panel>
                  ) : (
                    <Panel defaultSize={30} minSize={15} maxSize={60}>
                      <TerminalPanel
                        workspaceRoot={workspaceRoot}
                        onClose={() => setBottomPanel(null)}
                        pendingCommand={pendingTerminalCommand}
                        onCommandHandled={() => setPendingTerminalCommand(null)}
                      />
                    </Panel>
                  )}
                </>
              )}
            </PanelGroup>
          </Panel>

          {showChatSidebar && (
            <>
              <PanelResizeHandle className="w-px bg-border/50 hover:bg-primary hover:w-1 transition-all" />
              <Panel defaultSize={panelLayout.chatPanelSize} minSize={15} maxSize={35}>
                <ChatSidebar
                  workspaceRoot={workspaceRoot}
                  onPendingFileEdit={(pending) => {
                    // 当有 pending file edit 时，更新状态
                    if (pending) {
                      const language = getLanguageFromFileName(pending.filePath)
                      setPendingFileEdit({
                        ...pending,
                        language
                      })
                    }
                  }}
                  onOpenFile={(filePath) => {
                    // 点击文件名在编辑器中打开
                    fileManager.openFile(filePath)
                  }}
                  onSessionFilesRestored={(paths) => {
                    for (const p of paths) {
                      if (fileManager.openFiles.some((f) => f.path === p)) {
                        void window.api.files.read(p).then((c) => fileManager.updateContent(p, c))
                      }
                    }
                    setFileTreeRefreshKey((k) => k + 1)
                    checkGitStatus()
                  }}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar
        currentFile={fileManager.activeFile}
        projectPath={workspaceRoot}
        cursorPosition={cursorPosition}
        language={currentFile ? getLanguageFromFileName(currentFile.name) : undefined}
        bottomPanel={bottomPanel}
        onBottomPanelChange={setBottomPanel}
        diagnostics={allDiagnostics}
        projectSwitcher={
          workspaceRoot
            ? {
                workspaceRoot,
                recentProjects,
                onNewProject: () => setShowNewProjectDialog(true),
                onOpenProject: openProject,
                onCloneRepository: () => setShowCloneDialog(true),
                onOpenRecentProject: openRecentProject
              }
            : null
        }
        gitBranch={
          isGitRepo && workspaceRoot && currentBranch
            ? {
                workspaceRoot,
                currentBranch,
                onUpdate: pull,
                onCommit: () => toggleLeftPanel('commit'),
                onPush: () => setShowPushDialog(true),
                onPull: pull,
                onFetch: fetch,
                onNewBranch: () => setShowNewBranchDialog(true),
                onCheckoutBranch: checkoutBranch,
                onRefresh: checkGitStatus
              }
            : null
        }
      />

      <CloneRepositoryDialog
        open={showCloneDialog}
        onClose={() => setShowCloneDialog(false)}
        onSuccess={handleProjectCreated}
      />

      <NewProjectDialog
        open={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
        onSuccess={handleProjectCreated}
      />

      {isGitRepo && workspaceRoot && currentBranch && (
        <>
          <GitPushDialog
            open={showPushDialog}
            workspaceRoot={workspaceRoot}
            currentBranch={currentBranch}
            onClose={() => setShowPushDialog(false)}
            onSuccess={checkGitStatus}
          />

          <GitNewBranchDialog
            open={showNewBranchDialog}
            workspaceRoot={workspaceRoot}
            currentBranch={currentBranch}
            onClose={() => setShowNewBranchDialog(false)}
            onSuccess={checkGitStatus}
          />
        </>
      )}

      <InputDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        title="New File"
        description="Enter the name of the new file"
        label="File name"
        placeholder="example.tsx"
        onConfirm={handleFileTreeOperation.confirmNewFile}
      />

      <InputDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        title="New Folder"
        description="Enter the name of the new folder"
        label="Folder name"
        placeholder="my-folder"
        onConfirm={handleFileTreeOperation.confirmNewFolder}
      />

      <InputDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        title="Rename"
        description="Enter the new name"
        label="New name"
        defaultValue={currentOperationName}
        onConfirm={handleFileTreeOperation.confirmRename}
      />

      {workspaceRoot && gitInspect?.kind === 'history' && (
        <GitFileHistoryDialog
          open
          onOpenChange={(open) => {
            if (!open) setGitInspect(null)
          }}
          workspaceRoot={workspaceRoot}
          filePath={gitInspect.path}
        />
      )}

      {workspaceRoot && gitInspect?.kind === 'blame' && (
        <GitBlameViewerDialog
          open
          onOpenChange={(open) => {
            if (!open) setGitInspect(null)
          }}
          workspaceRoot={workspaceRoot}
          filePath={gitInspect.path}
        />
      )}

      {workspaceRoot && gitInspect?.kind === 'branch' && (
        <GitBranchCompareDialog
          open
          onOpenChange={(open) => {
            if (!open) setGitInspect(null)
          }}
          workspaceRoot={workspaceRoot}
          filePath={gitInspect.path}
        />
      )}

      <GitDiffViewerDialog
        open={gitWorkingDiff.open}
        onOpenChange={(open) => {
          if (!open) setGitWorkingDiff({ open: false, path: '', text: '', loading: false })
        }}
        title={t('workingDiff.title', {
          fileName: gitWorkingDiff.path ? getFileNameFromPath(gitWorkingDiff.path) : ''
        })}
        diffText={gitWorkingDiff.text}
        loading={gitWorkingDiff.loading}
      />
    </div>
  )
}
