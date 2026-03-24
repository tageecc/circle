import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API definition
const api = {
  // Agent APIs
  agents: {
    getAll: () => ipcRenderer.invoke('agents:getAll'),
    getDefault: () => ipcRenderer.invoke('agents:getDefault'),
    getById: (id: string) => ipcRenderer.invoke('agents:getById', id),
    create: (data: any) => ipcRenderer.invoke('agents:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('agents:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('agents:delete', id)
  },

  // Chat APIs
  chat: {
    send: (options: { agentId: string; threadId?: string; resourceId?: string; message: string }) =>
      ipcRenderer.invoke('chat:send', options),

    stream: (
      options: {
        agentId: string
        threadId?: string
        resourceId?: string
        message: string
        workspaceRoot?: string | null
      },
      onChunk: (chunk: {
        type: 'text' | 'reasoning' | 'tool-call' | 'tool-result'
        content?: string
        toolCall?: { id: string; name: string; args: any }
        toolResult?: {
          id: string
          result: any
          isError?: boolean
          isPending?: boolean
          pendingAction?: {
            type: 'file-edit'
            data: {
              filePath: string
              absolutePath: string
              oldContent: string
              newContent: string
              diff: string
              instructions: string
              fileExists: boolean
              stats?: { linesAdded: number; linesTotal: number }
            }
          }
        }
      }) => void,
      onEnd: (threadId: string) => void,
      onError: (error: string) => void
    ) => {
      const streamId = `stream-${Date.now()}-${Math.random()}`
      ipcRenderer.send('chat:stream', { ...options, streamId })

      const chunkListener = (
        _: any,
        chunk: {
          type: 'text' | 'reasoning' | 'tool-call' | 'tool-result'
          content?: string
          toolCall?: { id: string; name: string; args: any }
          toolResult?: {
            id: string
            result: any
            isError?: boolean
            isPending?: boolean
            pendingAction?: any
          }
        }
      ) => onChunk(chunk)
      const endListener = (_: any, threadId: string) => {
        onEnd(threadId)
        cleanup()
      }
      const errorListener = (_: any, error: string) => {
        onError(error)
        cleanup()
      }

      const cleanup = () => {
        ipcRenderer.removeListener('chat:stream:chunk', chunkListener)
        ipcRenderer.removeListener('chat:stream:end', endListener)
        ipcRenderer.removeListener('chat:stream:error', errorListener)
      }

      const stop = () => {
        ipcRenderer.send('chat:stream:stop', streamId)
        cleanup()
      }

      ipcRenderer.on('chat:stream:chunk', chunkListener)
      ipcRenderer.once('chat:stream:end', endListener)
      ipcRenderer.once('chat:stream:error', errorListener)

      return { cleanup, stop }
    }
  },

  // Thread APIs (替代原 Conversation APIs)
  threads: {
    getByAgent: (agentId: string) => ipcRenderer.invoke('threads:getByAgent', agentId),
    getWithMessages: (threadId: string) => ipcRenderer.invoke('threads:getWithMessages', threadId),
    delete: (threadId: string) => ipcRenderer.invoke('threads:delete', threadId)
  },

  completion: {
    generate: (request: {
      filePath: string
      fileContent: string
      line: number
      column: number
      enableValidation?: boolean
    }) => ipcRenderer.invoke('completion:generate', request)
  },

  // Config APIs
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: any) => ipcRenderer.invoke('config:set', config),
    getTheme: () => ipcRenderer.invoke('config:getTheme'),
    setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('config:setTheme', theme),
    updateWindowTheme: (theme: 'light' | 'dark' | 'system') =>
      ipcRenderer.invoke('theme:update', theme),
    getPreferences: () => ipcRenderer.invoke('config:getPreferences'),
    setPreference: (key: string, value: boolean) =>
      ipcRenderer.invoke('config:setPreference', key, value),
    // UI State APIs
    getUIState: () => ipcRenderer.invoke('config:getUIState'),
    setUIState: (state: any) => ipcRenderer.invoke('config:setUIState', state),
    updateUIState: (updates: any) => ipcRenderer.invoke('config:updateUIState', updates),
    debug: () => ipcRenderer.invoke('config:debug')
  },

  // Tool APIs (支持 MCP/Custom)
  tools: {
    getAll: (agentId?: string) => ipcRenderer.invoke('tools:getAll', agentId),
    getTop: (limit?: number, agentId?: string) =>
      ipcRenderer.invoke('tools:getTop', limit, agentId),
    getStatsByServer: (agentId?: string) => ipcRenderer.invoke('tools:getStatsByServer', agentId),
    importFromMCP: (serverId: string) => ipcRenderer.invoke('tools:importFromMCP', serverId),
    syncMCPServer: (serverId: string) => ipcRenderer.invoke('tools:syncMCPServer', serverId),
    createCustom: (data: any) => ipcRenderer.invoke('tools:createCustom', data),
    update: (id: string, data: any) => ipcRenderer.invoke('tools:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('tools:delete', id)
  },

  // MCP Server APIs
  mcp: {
    getAll: () => ipcRenderer.invoke('mcp:getAll'),
    create: (data: any) => ipcRenderer.invoke('mcp:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('mcp:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('mcp:delete', id)
  },

  // File System APIs
  files: {
    read: (filePath: string) => ipcRenderer.invoke('files:read', filePath),
    readBinary: (filePath: string) => ipcRenderer.invoke('files:readBinary', filePath),
    write: (filePath: string, content: string) =>
      ipcRenderer.invoke('files:write', filePath, content),
    listDirectory: (dirPath: string) => ipcRenderer.invoke('files:listDirectory', dirPath),
    createFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('files:createFile', filePath, content),
    createDirectory: (dirPath: string) => ipcRenderer.invoke('files:createDirectory', dirPath),
    delete: (targetPath: string) => ipcRenderer.invoke('files:delete', targetPath),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('files:rename', oldPath, newPath),
    exists: (targetPath: string) => ipcRenderer.invoke('files:exists', targetPath),
    getInfo: (filePath: string) => ipcRenderer.invoke('files:getInfo', filePath),
    stat: (filePath: string) => ipcRenderer.invoke('files:getInfo', filePath),
    revealInFinder: (filePath: string) => ipcRenderer.invoke('files:revealInFinder', filePath),

    // 文件变化监听
    onFileChanged: (callback: (event: { type: string; path: string }) => void) => {
      const listener = (_: any, event: { type: string; path: string }) => callback(event)
      ipcRenderer.on('file:changed', listener)
      return () => ipcRenderer.removeListener('file:changed', listener)
    }
  },

  // Project APIs
  project: {
    openDialog: () => ipcRenderer.invoke('project:openDialog'),
    getRecent: () => ipcRenderer.invoke('project:getRecent'),
    getCurrent: () => ipcRenderer.invoke('project:getCurrent'),
    setCurrent: (projectPath: string | null) =>
      ipcRenderer.invoke('project:setCurrent', projectPath),
    close: () => ipcRenderer.invoke('project:close')
  },

  // Git APIs
  git: {
    extractRepoName: (url: string) => ipcRenderer.invoke('git:extractRepoName', url),
    selectTargetDirectory: () => ipcRenderer.invoke('git:selectTargetDirectory'),
    cloneRepository: (repoUrl: string, targetPath: string) =>
      ipcRenderer.invoke('git:cloneRepository', repoUrl, targetPath),
    createNewProject: (parentPath: string, projectName: string) =>
      ipcRenderer.invoke('git:createNewProject', parentPath, projectName),

    // Git clone 进度监听
    onCloneProgress: (callback: (message: string) => void) => {
      const listener = (_: any, message: string) => callback(message)
      ipcRenderer.on('git:cloneProgress', listener)
      return () => ipcRenderer.removeListener('git:cloneProgress', listener)
    },

    // Repository & Branch operations
    isRepository: (projectPath: string) => ipcRenderer.invoke('git:isRepository', projectPath),
    getCurrentBranch: (projectPath: string) =>
      ipcRenderer.invoke('git:getCurrentBranch', projectPath),
    getAllBranches: (projectPath: string) => ipcRenderer.invoke('git:getAllBranches', projectPath),
    checkoutBranch: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:checkoutBranch', projectPath, branchName),
    createBranch: (projectPath: string, branchName: string, checkout: boolean) =>
      ipcRenderer.invoke('git:createBranch', projectPath, branchName, checkout),
    deleteBranch: (projectPath: string, branchName: string, force: boolean) =>
      ipcRenderer.invoke('git:deleteBranch', projectPath, branchName, force),

    // Status & Changes
    getStatus: (projectPath: string) => ipcRenderer.invoke('git:getStatus', projectPath),
    stageFiles: (projectPath: string, files: string[]) =>
      ipcRenderer.invoke('git:stageFiles', projectPath, files),
    unstageFiles: (projectPath: string, files: string[]) =>
      ipcRenderer.invoke('git:unstageFiles', projectPath, files),
    getDiff: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getDiff', projectPath, filePath),
    commit: (projectPath: string, message: string) =>
      ipcRenderer.invoke('git:commit', projectPath, message),

    // Remote operations
    push: (projectPath: string, remote: string, branch?: string, setUpstream?: boolean) =>
      ipcRenderer.invoke('git:push', projectPath, remote, branch, setUpstream),
    pull: (projectPath: string, remote: string, branch?: string) =>
      ipcRenderer.invoke('git:pull', projectPath, remote, branch),
    fetch: (projectPath: string, remote: string) =>
      ipcRenderer.invoke('git:fetch', projectPath, remote),
    getRemotes: (projectPath: string) => ipcRenderer.invoke('git:getRemotes', projectPath),

    // File operations
    revertFile: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:revertFile', projectPath, filePath),
    getFileHistory: (projectPath: string, filePath: string, limit?: number) =>
      ipcRenderer.invoke('git:getFileHistory', projectPath, filePath, limit),
    compareWithBranch: (projectPath: string, filePath: string, branch: string) =>
      ipcRenderer.invoke('git:compareWithBranch', projectPath, filePath, branch),
    getWorkingDiff: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getWorkingDiff', projectPath, filePath),
    getBlame: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getBlame', projectPath, filePath)
  },

  // Avatar APIs
  avatar: {
    select: () => ipcRenderer.invoke('avatar:select'),
    save: (sourcePath: string, agentId: string) =>
      ipcRenderer.invoke('avatar:save', sourcePath, agentId),
    delete: (agentId: string) => ipcRenderer.invoke('avatar:delete', agentId),
    getPath: (fileName: string) => ipcRenderer.invoke('avatar:getPath', fileName),
    readAsBase64: (fileName: string) => ipcRenderer.invoke('avatar:readAsBase64', fileName),
    readFileAsBase64: (filePath: string) => ipcRenderer.invoke('avatar:readFileAsBase64', filePath)
  },

  // Coding Agent APIs
  codingAgent: {
    selectProjectFolder: () => ipcRenderer.invoke('coding-agent:selectProjectFolder'),
    createProject: (userPrompt: string, projectPath: string) =>
      ipcRenderer.invoke('coding-agent:createProject', userPrompt, projectPath)
  },

  // Terminal APIs
  terminal: {
    create: (cwd: string) => ipcRenderer.invoke('terminal:create', cwd),
    write: (terminalId: string, data: string) =>
      ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    kill: (terminalId: string) => ipcRenderer.invoke('terminal:kill', terminalId),

    onData: (callback: (event: { terminalId: string; data: string }) => void) => {
      const listener = (_: any, event: { terminalId: string; data: string }) => callback(event)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },

    onExit: (
      callback: (event: { terminalId: string; exitCode: number; signal?: number }) => void
    ) => {
      const listener = (_: any, event: { terminalId: string; exitCode: number; signal?: number }) =>
        callback(event)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },

    onRunCommand: (callback: (command: string) => void) => {
      const listener = (_: any, command: string) => callback(command)
      ipcRenderer.on('terminal:run-command', listener)
      return () => ipcRenderer.removeListener('terminal:run-command', listener)
    }
  },

  // System APIs
  system: {
    getFonts: () => ipcRenderer.invoke('system:getFonts')
  },

  // Codebase Index APIs
  codebase: {
    index: (projectPath: string) => ipcRenderer.invoke('codebase:index', projectPath),
    search: (projectPath: string, query: string, options?: any) =>
      ipcRenderer.invoke('codebase:search', projectPath, query, options),
    getIndex: (projectPath: string) => ipcRenderer.invoke('codebase:getIndex', projectPath),
    deleteIndex: (projectPath: string) => ipcRenderer.invoke('codebase:deleteIndex', projectPath),

    onIndexProgress: (
      callback: (event: { current: number; total: number; file: string; progress: number }) => void
    ) => {
      const listener = (
        _: any,
        event: { current: number; total: number; file: string; progress: number }
      ) => callback(event)
      ipcRenderer.on('codebase:index:progress', listener)
      return () => ipcRenderer.removeListener('codebase:index:progress', listener)
    }
  },

  // Diagnostics APIs
  diagnostics: {
    get: (filePath: string, content?: string) =>
      ipcRenderer.invoke('diagnostics:get', filePath, content),
    clear: (filePath?: string) => ipcRenderer.invoke('diagnostics:clear', filePath)
  },

  // Language Service APIs
  languageService: {
    updateFile: (projectRoot: string, fileName: string, content: string) =>
      ipcRenderer.invoke('languageService:updateFile', projectRoot, fileName, content),
    getQuickInfo: (projectRoot: string, fileName: string, position: number) =>
      ipcRenderer.invoke('languageService:getQuickInfo', projectRoot, fileName, position),
    getDefinition: (projectRoot: string, fileName: string, position: number) =>
      ipcRenderer.invoke('languageService:getDefinition', projectRoot, fileName, position),
    getReferences: (projectRoot: string, fileName: string, position: number) =>
      ipcRenderer.invoke('languageService:getReferences', projectRoot, fileName, position),
    getRenameLocations: (projectRoot: string, fileName: string, position: number) =>
      ipcRenderer.invoke('languageService:getRenameLocations', projectRoot, fileName, position),
    getCompletions: (projectRoot: string, fileName: string, position: number) =>
      ipcRenderer.invoke('languageService:getCompletions', projectRoot, fileName, position),
    getSignatureHelp: (projectRoot: string, fileName: string, position: number) =>
      ipcRenderer.invoke('languageService:getSignatureHelp', projectRoot, fileName, position),
    formatDocument: (projectRoot: string, fileName: string) =>
      ipcRenderer.invoke('languageService:formatDocument', projectRoot, fileName)
  },

  // App APIs
  app: {
    platform: process.platform as 'darwin' | 'win32' | 'linux',
    onOpenUrl: (callback: (url: string) => void) => {
      const listener = (_: any, url: string) => callback(url)
      ipcRenderer.on('app:open-url', listener)
      return () => ipcRenderer.removeListener('app:open-url', listener)
    },
    onMenuAction: (callback: (payload: { action: string; path?: string }) => void) => {
      const listener = (_: any, payload: { action: string; path?: string }) => callback(payload)
      ipcRenderer.on('app:menu-action', listener)
      return () => ipcRenderer.removeListener('app:menu-action', listener)
    },
    setRecentProjects: (recent: { path: string; name: string }[]) =>
      ipcRenderer.invoke('app:setRecentProjects', recent)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
