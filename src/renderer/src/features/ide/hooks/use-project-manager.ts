import { useState, useCallback } from 'react'
import { RecentProject } from '../types'

export function useProjectManager() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(true)

  const loadProjectState = useCallback(async () => {
    try {
      setLoading(true)
      const [currentProject, recent, uiState] = await Promise.all([
        window.api.project.getCurrent(),
        window.api.project.getRecent(),
        window.api.config.getUIState()
      ])

      setWorkspaceRoot(currentProject)
      setRecentProjects(recent)

      return { currentProject, uiState }
    } catch (error) {
      console.error('Failed to load project state:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const openProject = useCallback(async () => {
    try {
      const projectPath = await window.api.project.openDialog()
      if (projectPath) {
        setWorkspaceRoot(projectPath)
        await window.api.project.setCurrent(projectPath)
        return projectPath
      }
    } catch (error) {
      console.error('Failed to open project:', error)
    }
    return null
  }, [])

  const openRecentProject = useCallback(async (path: string) => {
    try {
      await window.api.project.setCurrent(path)
      setWorkspaceRoot(path)
      return path
    } catch (error) {
      console.error('Failed to open recent project:', error)
      return null
    }
  }, [])

  const closeProject = useCallback(async () => {
    setWorkspaceRoot(null)
    try {
      await window.api.project.setCurrent(null)
      await window.api.config.updateUIState({
        codeEditor: {
          openFiles: [],
          activeFile: null
        }
      })
    } catch (error) {
      console.error('Failed to close project:', error)
    }
  }, [])

  return {
    workspaceRoot,
    recentProjects,
    loading,
    setWorkspaceRoot,
    loadProjectState,
    openProject,
    openRecentProject,
    closeProject
  }
}
