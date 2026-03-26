import { useEffect, useRef, useCallback } from 'react'
import { FileManager } from '@/types/ide'
import { refreshGitStatus } from './use-git-manager'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'

interface EditorSyncProps {
  workspaceRoot: string | null
  fileManager: FileManager
  expandedDirs: string[]
  loading: boolean
  autoSave: boolean
  setExpandedDirs: (dirs: string[]) => void
}

/**
 * ✅ 判断是否是普通文件（非临时 tab）
 * 排除 diff、conflict、stash、compare、commit 等临时 tab
 */
function isNormalFile(file: any): boolean {
  return (
    !file.showDiff &&
    !file.showConflict &&
    file.stashIndex === undefined &&
    !file.baseBranch &&
    !file.commitHash
  )
}

/**
 * 编辑器状态同步 Hook
 * 处理自动保存、状态恢复、文件监听等
 */
export function useEditorSync({
  workspaceRoot,
  fileManager,
  expandedDirs,
  loading,
  autoSave,
  setExpandedDirs
}: EditorSyncProps) {
  const prevWorkspaceRoot = useRef<string | null>(null)
  const fileManagerRef = useRef(fileManager)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const setExpandedDirsRef = useRef(setExpandedDirs)
  // ⭐ 修复：保存分批加载定时器的引用，以便清理
  const batch2TimerRef = useRef<NodeJS.Timeout | null>(null)
  const batch3TimerRef = useRef<NodeJS.Timeout | null>(null)

  // ✅ 更新 refs
  useEffect(() => {
    fileManagerRef.current = fileManager
    setExpandedDirsRef.current = setExpandedDirs
  })

  // ✅ 恢复编辑器状态 - 分批加载所有文件，优化用户体验
  const restoreEditorState = useCallback(
    async (projectRoot: string) => {
      try {
        // ✅ 添加超时保护，避免卡死
        const uiState = await Promise.race([
          window.api.config.getUIState(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Restore timeout')), 3000))
        ]).catch((error) => {
          console.error('Failed to load UI state:', error)
          return { codeEditor: null }
        })

        if (uiState.codeEditor?.openFiles) {
          const filePaths = uiState.codeEditor.openFiles
            .filter((f: { path: string }) => f.path.startsWith(projectRoot))
            .map((f: { path: string }) => f.path)

          if (filePaths.length > 0) {
            console.log(`[EditorSync] Restoring ${filePaths.length} files in batches...`)

            // ⭐ 分批加载策略：
            // - 批次 1：立即加载前 5 个文件（快速显示）
            // - 批次 2：1 秒后加载接下来的 10 个文件
            // - 批次 3：2 秒后加载剩余的所有文件

            const batch1 = filePaths.slice(0, 5) // 前 5 个
            const batch2 = filePaths.slice(5, 15) // 第 6-15 个
            const batch3 = filePaths.slice(15) // 剩余所有

            // 批次 1：立即加载（不阻塞）
            if (batch1.length > 0) {
              console.log(`[EditorSync] Loading batch 1: ${batch1.length} files`)
              fileManager.restoreFiles(batch1, projectRoot).catch((error) => {
                console.error('Failed to restore batch 1:', error)
              })
            }

            // 批次 2：延迟 1 秒加载
            if (batch2.length > 0) {
              batch2TimerRef.current = setTimeout(() => {
                console.log(`[EditorSync] Loading batch 2: ${batch2.length} files`)
                fileManagerRef.current.restoreFiles(batch2, projectRoot).catch((error) => {
                  console.error('Failed to restore batch 2:', error)
                })
              }, 1000)
            }

            // 批次 3：延迟 2.5 秒加载（等待用户初始操作完成）
            if (batch3.length > 0) {
              batch3TimerRef.current = setTimeout(() => {
                console.log(`[EditorSync] Loading batch 3: ${batch3.length} files`)
                fileManagerRef.current.restoreFiles(batch3, projectRoot).catch((error) => {
                  console.error('Failed to restore batch 3:', error)
                })
              }, 2500)
            }

            // 设置活动文件
            if (uiState.codeEditor.activeFilePath?.startsWith(projectRoot)) {
              // ✅ 延迟设置活动文件，让文件先加载
              setTimeout(() => {
                fileManager.setActiveFile(uiState.codeEditor.activeFilePath)
              }, 100)
            }
          }
        }

        if (uiState.codeEditor?.expandedDirs) {
          setExpandedDirsRef.current(uiState.codeEditor.expandedDirs)
        }
      } catch (error) {
        console.error('Failed to restore editor state:', error)
      }
    },
    [fileManager] // ✅ 只依赖 fileManager
  )

  // 工作区切换时清空文件
  useEffect(() => {
    if (prevWorkspaceRoot.current !== null && prevWorkspaceRoot.current !== workspaceRoot) {
      fileManager.clearAllFiles()
      // ⭐ 修复：清理分批加载定时器
      if (batch2TimerRef.current) {
        clearTimeout(batch2TimerRef.current)
        batch2TimerRef.current = null
      }
      if (batch3TimerRef.current) {
        clearTimeout(batch3TimerRef.current)
        batch3TimerRef.current = null
      }
    }
    prevWorkspaceRoot.current = workspaceRoot

    // ⭐ 修复：组件卸载时也要清理
    return () => {
      if (batch2TimerRef.current) clearTimeout(batch2TimerRef.current)
      if (batch3TimerRef.current) clearTimeout(batch3TimerRef.current)
    }
  }, [workspaceRoot, fileManager])

  // 文件变化监听
  useEffect(() => {
    if (!workspaceRoot) return

    const cleanup = window.api.files.onFileChanged((event: { type: string; path: string }) => {
      const currentFileManager = fileManagerRef.current

      // 忽略正在保存的文件
      if (event.path === currentFileManager.savingFile) return

      const isFileOpen = currentFileManager.openFiles.some((f) => f.path === event.path)

      if (isFileOpen && event.type === 'change') {
        currentFileManager.reloadFile(event.path)
      } else if (isFileOpen && event.type === 'unlink') {
        currentFileManager.markFileAsDeleted(event.path)
      }

      // 文件增删改时刷新文件树和 Git 状态
      if (event.type !== 'change') {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
        refreshTimerRef.current = setTimeout(() => {
          useWorkspaceUIStore.getState().refreshFileTree()
          refreshGitStatus()
        }, 100)
      }
    })

    return () => {
      cleanup()
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [workspaceRoot])

  // 保存编辑器状态（打开的文件、活动文件、展开的目录）
  // ✅ 优化：使用 ref + 手动序列化，只在文件列表/活动文件真正变化时保存
  const prevFileListRef = useRef<string>('')

  useEffect(() => {
    if (!workspaceRoot || loading) return

    // 创建轻量级的标识符（只包含路径，不包含内容）
    const openFilePaths = fileManager.openFiles
      .filter(isNormalFile)
      .map((f) => f.path)
      .join('|')

    const currentSignature = `${openFilePaths}::${fileManager.activeFile}`

    // 只在文件列表或活动文件真正变化时才保存
    if (currentSignature === prevFileListRef.current) {
      return
    }

    prevFileListRef.current = currentSignature

    const saveEditorState = async () => {
      try {
        const filesToSave = openFilePaths
          .split('|')
          .filter(Boolean)
          .map((path) => ({ path }))

        let activeFilePath = fileManager.activeFile || null
        if (activeFilePath) {
          // 移除所有临时 tab 后缀
          activeFilePath = activeFilePath
            .replace(/:diff$/, '')
            .replace(/:stash:\d+$/, '')
            .replace(/:conflict$/, '')
            .replace(/:compare:[^:]+:[^:]+$/, '')
            .replace(/:commit:[a-f0-9]+$/, '')
        }

        await window.api.config.updateUIState({
          codeEditor: {
            openFiles: filesToSave,
            activeFilePath,
            currentProject: workspaceRoot,
            expandedDirs
          }
        })
      } catch (error) {
        console.error('Failed to save editor state:', error)
      }
    }

    const timeoutId = setTimeout(saveEditorState, 2000) // 增加到2秒
    return () => clearTimeout(timeoutId)
  }, [fileManager.openFiles, fileManager.activeFile, workspaceRoot, loading, expandedDirs])

  // 自动保存（只保存普通文件，diff 是只读的）
  // ✅ 优化：使用 ref + 轻量级签名，避免每次输入都触发 effect
  const prevDirtyFilesRef = useRef<string>('')

  useEffect(() => {
    if (!autoSave) return

    // 创建 dirty 文件的签名（路径列表）
    const dirtyFiles = fileManager.openFiles.filter((f) => f.isDirty && !f.showDiff)
    const dirtySignature = dirtyFiles
      .map((f) => f.path)
      .sort()
      .join('|')

    // 如果 dirty 文件列表没有变化，不触发保存
    if (dirtySignature === prevDirtyFilesRef.current) {
      return
    }

    prevDirtyFilesRef.current = dirtySignature

    const timer = setTimeout(() => {
      // 重新获取最新的 dirty 文件列表（内容可能已更新）
      const currentDirtyFiles = fileManagerRef.current.openFiles.filter(
        (f) => f.isDirty && !f.showDiff
      )
      currentDirtyFiles.forEach(
        (f) => fileManagerRef.current.saveFile(f.path, undefined, () => refreshGitStatus()) // ✅ 使用全局事件
      )
    }, 2000) // 增加到2秒，给用户更多输入时间

    return () => clearTimeout(timer)
  }, [autoSave, fileManager.openFiles])

  return {
    restoreEditorState
  }
}
