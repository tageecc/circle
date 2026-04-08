import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API definition
const api = {
  // Get system locale
  getSystemLocale: () => ipcRenderer.invoke('system:getLocale'),

  // Chat APIs
  chat: {
    send: (options: { sessionId?: string; message: string }) =>
      ipcRenderer.invoke('chat:send', options),

    stream: (
      options: {
        sessionId?: string
        message: string
        workspaceRoot?: string | null
        images?: Array<{ id: string; dataUrl: string; name: string; size: number }>
      },
      onChunk: (chunk: {
        type:
          | 'text'
          | 'reasoning'
          | 'tool-call'
          | 'tool-result'
          | 'tool-output-stream'
          | 'error'
          | 'session-id'
          | 'message-start'
          | 'interrupt'
          | 'finish'
          | 'usage'
          | 'context-notice'
        content?: string
        sessionId?: string
        messages?: Array<{
          id: number
          role: 'user' | 'assistant' | 'system' | 'tool'
          content: any[]
          timestamp?: number
          images?: Array<{ id: string; dataUrl: string; name: string; size: number }>
        }>
        toolCall?: { id: string; name: string; args: any }
        toolResult?: {
          tool_call_id: string
          content: any
          isError?: boolean
          isPending?: boolean
          isApplied?: boolean
          appliedAction?: {
            type: 'file-edit'
            data: {
              toolName?: string
              filePath: string
              absolutePath: string
              oldContent: string
              newContent: string
              fileExists: boolean
              stats?: { linesAdded?: number; linesRemoved?: number; linesTotal?: number }
            }
          }
          pendingAction?: {
            type: 'file-edit'
            data: {
              filePath: string
              absolutePath: string
              oldContent: string
              newContent: string
              fileExists: boolean
              stats?: { linesAdded?: number; linesRemoved?: number; linesTotal?: number }
            }
          }
        }
        toolOutputStream?: {
          toolCallId: string
          terminalId: string
          output: string
          isError?: boolean
        }
        interrupt?: any
        error?: string
        finishReason?: string
        usage?: {
          promptTokens: number
          completionTokens: number
          totalTokens: number
        }
        contextNotice?: {
          prunedMessageCount: number
          toolResultsTruncated: boolean
          estimatedInputTokensAfter?: number
          conversationSummarized?: boolean
          aggressiveToolTruncation?: boolean
          longTextTruncated?: boolean
        }
      }) => void,
      onEnd: (sessionId: string) => void,
      onError: (error: string) => void
    ) => {
      const streamId = `stream-${Date.now()}-${Math.random()}`
      ipcRenderer.send('chat:stream', { ...options, streamId })

      const chunkListener = (_: any, chunk: any) => onChunk(chunk)

      const endListener = (_: any, sessionId: string) => {
        onEnd(sessionId)
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
        // 等待流正常结束，error/end 事件会触发 cleanup
      }

      ipcRenderer.on('chat:stream:chunk', chunkListener)
      ipcRenderer.once('chat:stream:end', endListener)
      ipcRenderer.once('chat:stream:error', errorListener)

      return { cleanup, stop }
    },

    // HITL: Resume interrupt
    resumeInterrupt: (sessionId: string, toolCallId: string, decision: string) =>
      ipcRenderer.invoke('chat:resume-interrupt', { sessionId, toolCallId, decision }),

    onUserQuestion: (
      callback: (data: {
        questionId: string
        sessionId: string
        assistantMessageId: number
        questions: Array<{
          question: string
          header: string
          options: Array<{
            label: string
            description: string
            preview?: string
          }>
          multiSelect: boolean
        }>
        metadata?: {
          source?: string
        }
      }) => void
    ) => {
      const listener = (
        _: unknown,
        data: {
          questionId: string
          sessionId: string
          assistantMessageId: number
          questions: Array<{
            question: string
            header: string
            options: Array<{
              label: string
              description: string
              preview?: string
            }>
            multiSelect: boolean
          }>
          metadata?: {
            source?: string
          }
        }
      ) => callback(data)
      ipcRenderer.on('chat:user-question', listener)
      return () => ipcRenderer.removeListener('chat:user-question', listener)
    },

    submitUserQuestionAnswer: (
      questionId: string,
      result:
        | { type: 'answered'; answers: Record<string, string>; annotations?: Record<string, any> }
        | { type: 'skipped' }
        | { type: 'rejected'; feedback: string }
    ) => ipcRenderer.invoke('chat:user-question:answer', { questionId, result }),

    /** Phase F: resolve large tool payloads stored by ref in main process */
    getStreamPayload: (ref: string) =>
      ipcRenderer.invoke('chat:get-stream-payload', ref) as Promise<string | null>
  },

  // Session APIs
  sessions: {
    create: (modelId: string, projectPath: string) =>
      ipcRenderer.invoke('sessions:create', modelId, projectPath),
    getByProject: (projectPath: string) => ipcRenderer.invoke('sessions:getByProject', projectPath),
    getWithMessages: (sessionId: string) =>
      ipcRenderer.invoke('sessions:getWithMessages', sessionId),
    update: (sessionId: string, updates: { title?: string; modelId?: string }) =>
      ipcRenderer.invoke('sessions:update', sessionId, updates),
    delete: (sessionId: string) => ipcRenderer.invoke('sessions:delete', sessionId),
    deleteMessagesAfter: (sessionId: string, messageId: number) =>
      ipcRenderer.invoke('sessions:deleteMessagesAfter', sessionId, messageId)
  },

  // Message Snapshot APIs
  message: {
    getAffectedFiles: (messageId: number) =>
      ipcRenderer.invoke('message:getAffectedFiles', messageId),
    revertFiles: (messageId: number) => ipcRenderer.invoke('message:revertFiles', messageId)
  },

  // Memory APIs
  memory: {
    getAll: () => ipcRenderer.invoke('memory:getAll'),
    create: (content: string) => ipcRenderer.invoke('memory:create', content),
    update: (id: string, content: string) => ipcRenderer.invoke('memory:update', id, content),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id)
  },

  userRule: {
    getAll: () => ipcRenderer.invoke('userRule:getAll'),
    create: (content: string) => ipcRenderer.invoke('userRule:create', content),
    update: (id: string, content: string) => ipcRenderer.invoke('userRule:update', id, content),
    delete: (id: string) => ipcRenderer.invoke('userRule:delete', id)
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
    // Layout State APIs
    getLayoutState: () => ipcRenderer.invoke('config:getLayoutState'),
    setLayoutState: (layout: any) => ipcRenderer.invoke('config:setLayoutState', layout),
    // API Keys
    getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
    getApiKey: (provider: string) => ipcRenderer.invoke('config:getApiKey', provider),
    setApiKey: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('config:setApiKey', provider, apiKey),
    deleteApiKey: (provider: string) => ipcRenderer.invoke('config:deleteApiKey', provider),
    setApiKeys: (apiKeys: Record<string, string>) =>
      ipcRenderer.invoke('config:setApiKeys', apiKeys),
    // Default Model
    getDefaultModel: () => ipcRenderer.invoke('config:getDefaultModel'),
    setDefaultModel: (modelId: string) => ipcRenderer.invoke('config:setDefaultModel', modelId),
    getServiceSettings: () => ipcRenderer.invoke('config:getServiceSettings'),
    setServiceSettings: (settings: any) => ipcRenderer.invoke('config:setServiceSettings', settings)
  },

  // MCP APIs
  mcp: {
    getAllServers: () => ipcRenderer.invoke('mcp:getAllServers'),
    addServer: (server: { name: string; configJson: any }) =>
      ipcRenderer.invoke('mcp:addServer', server),
    updateServer: (serverId: string, name: string, configJson: any) =>
      ipcRenderer.invoke('mcp:updateServer', serverId, name, configJson),
    deleteServer: (serverId: string) => ipcRenderer.invoke('mcp:deleteServer', serverId),
    connect: (serverId: string, serverConfig: any) =>
      ipcRenderer.invoke('mcp:connect', serverId, serverConfig),
    disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
    callTool: (serverId: string, toolName: string, args: any) =>
      ipcRenderer.invoke('mcp:callTool', serverId, toolName, args),
    listAllTools: () => ipcRenderer.invoke('mcp:listAllTools'),
    listAllResources: () => ipcRenderer.invoke('mcp:listAllResources'),
    readResource: (serverId: string, resourceName: string, args: any) =>
      ipcRenderer.invoke('mcp:readResource', serverId, resourceName, args),
    listAllPrompts: () => ipcRenderer.invoke('mcp:listAllPrompts'),
    getPrompt: (serverId: string, promptName: string, args: any) =>
      ipcRenderer.invoke('mcp:getPrompt', serverId, promptName, args),
    getConnectionStatus: (serverId: string) =>
      ipcRenderer.invoke('mcp:getConnectionStatus', serverId),
    startAuth: (serverId: string) => ipcRenderer.invoke('mcp:startAuth', serverId),
    clearAuth: (serverId: string) => ipcRenderer.invoke('mcp:clearAuth', serverId)
  },

  // File System APIs
  files: {
    read: (filePath: string) => ipcRenderer.invoke('files:read', filePath),
    quickOpen: (projectPath: string, query: string, limit?: number) =>
      ipcRenderer.invoke('files:quickOpen', projectPath, query, limit),
    readWithEncoding: (filePath: string, encoding: string) =>
      ipcRenderer.invoke('files:readWithEncoding', filePath, encoding),
    detectEncoding: (filePath: string) => ipcRenderer.invoke('files:detectEncoding', filePath),
    readBinary: (filePath: string) => ipcRenderer.invoke('files:readBinary', filePath),
    write: (filePath: string, content: string) =>
      ipcRenderer.invoke('files:write', filePath, content),
    writeWithEncoding: (filePath: string, content: string, encoding: string) =>
      ipcRenderer.invoke('files:writeWithEncoding', filePath, content, encoding),
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
    openPath: (path: string) => ipcRenderer.invoke('files:openPath', path),

    // 文件变化监听
    onFileChanged: (callback: (event: { type: string; path: string }) => void) => {
      const listener = (_: any, event: { type: string; path: string }) => callback(event)
      ipcRenderer.on('file:changed', listener)
      return () => ipcRenderer.removeListener('file:changed', listener)
    },

    // ⭐ Git外部变化监听（git checkout, git pull等）
    onGitExternalChange: (callback: (event: { projectPath: string }) => void) => {
      const listener = (_: any, event: { projectPath: string }) => callback(event)
      ipcRenderer.on('git:external-change', listener)
      return () => ipcRenderer.removeListener('git:external-change', listener)
    }
  },

  // Project APIs
  project: {
    openDialog: () => ipcRenderer.invoke('project:openDialog'),
    getRecent: () => ipcRenderer.invoke('project:getRecent'),
    getCurrent: () => ipcRenderer.invoke('project:getCurrent'),
    setCurrent: (projectPath: string | null) =>
      ipcRenderer.invoke('project:setCurrent', projectPath),
    close: () => ipcRenderer.invoke('project:close'),
    openInNewWindow: (projectPath: string) =>
      ipcRenderer.invoke('project:openInNewWindow', projectPath)
  },

  // Window APIs
  window: {
    onOpenProject: (callback: (data: { projectPath: string }) => void) => {
      const listener = (_: any, data: { projectPath: string }) => callback(data)
      ipcRenderer.on('window:open-project', listener)
      return () => ipcRenderer.removeListener('window:open-project', listener)
    },
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
      const listener = (_: any, isFullscreen: boolean) => callback(isFullscreen)
      ipcRenderer.on('window:fullscreen-change', listener)
      return () => ipcRenderer.removeListener('window:fullscreen-change', listener)
    }
  },

  // Menu event listeners
  menu: {
    onOpenProject: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:open-project', listener)
      return () => ipcRenderer.removeListener('menu:open-project', listener)
    },
    onOpenRecentProject: (callback: (path: string) => void) => {
      const listener = (_: any, data: { path: string }) => callback(data.path)
      ipcRenderer.on('menu:open-recent-project', listener)
      return () => ipcRenderer.removeListener('menu:open-recent-project', listener)
    },
    onSaveFile: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:save-file', listener)
      return () => ipcRenderer.removeListener('menu:save-file', listener)
    },
    onSaveAll: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:save-all', listener)
      return () => ipcRenderer.removeListener('menu:save-all', listener)
    },
    onCloseWorkspace: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:close-workspace', listener)
      return () => ipcRenderer.removeListener('menu:close-workspace', listener)
    },
    onOpenSettings: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:open-settings', listener)
      return () => ipcRenderer.removeListener('menu:open-settings', listener)
    },
    onToggleSidebar: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:toggle-sidebar', listener)
      return () => ipcRenderer.removeListener('menu:toggle-sidebar', listener)
    },
    onToggleChat: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:toggle-chat', listener)
      return () => ipcRenderer.removeListener('menu:toggle-chat', listener)
    },
    onToggleTerminal: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:toggle-terminal', listener)
      return () => ipcRenderer.removeListener('menu:toggle-terminal', listener)
    },
    onReportBug: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:report-bug', listener)
      return () => ipcRenderer.removeListener('menu:report-bug', listener)
    }
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
    initRepository: (projectPath: string) => ipcRenderer.invoke('git:initRepository', projectPath),
    getCurrentBranch: (projectPath: string) =>
      ipcRenderer.invoke('git:getCurrentBranch', projectPath),
    getAllBranches: (projectPath: string) => ipcRenderer.invoke('git:getAllBranches', projectPath),
    checkoutBranch: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:checkoutBranch', projectPath, branchName),
    createBranch: (
      projectPath: string,
      branchName: string,
      checkout: boolean,
      startPoint?: string
    ) => ipcRenderer.invoke('git:createBranch', projectPath, branchName, checkout, startPoint),
    getBranchCommit: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:getBranchCommit', projectPath, branchName),
    deleteBranch: (projectPath: string, branchName: string, force: boolean) =>
      ipcRenderer.invoke('git:deleteBranch', projectPath, branchName, force),
    deleteRemoteBranch: (projectPath: string, remoteName: string, branchName: string) =>
      ipcRenderer.invoke('git:deleteRemoteBranch', projectPath, remoteName, branchName),
    getTrackingBranch: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:getTrackingBranch', projectPath, branchName),
    unsetUpstream: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:unsetUpstream', projectPath, branchName),
    renameBranch: (projectPath: string, oldName: string, newName: string) =>
      ipcRenderer.invoke('git:renameBranch', projectPath, oldName, newName),
    mergeBranch: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('git:mergeBranch', projectPath, branchName),
    compareBranches: (projectPath: string, baseBranch: string, compareBranch: string) =>
      ipcRenderer.invoke('git:compareBranches', projectPath, baseBranch, compareBranch),
    getBranchFileDiff: (
      projectPath: string,
      baseBranch: string,
      compareBranch: string,
      filePath: string
    ) =>
      ipcRenderer.invoke('git:getBranchFileDiff', projectPath, baseBranch, compareBranch, filePath),

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
    pushToRef: (projectPath: string, remote: string, refspec: string, setUpstream?: boolean) =>
      ipcRenderer.invoke('git:pushToRef', projectPath, remote, refspec, setUpstream),
    pull: (projectPath: string, remote: string, branch?: string) =>
      ipcRenderer.invoke('git:pull', projectPath, remote, branch),
    fetch: (projectPath: string, remote: string) =>
      ipcRenderer.invoke('git:fetch', projectPath, remote),
    getRemotes: (projectPath: string) => ipcRenderer.invoke('git:getRemotes', projectPath),
    addRemote: (projectPath: string, name: string, url: string) =>
      ipcRenderer.invoke('git:addRemote', projectPath, name, url),

    // File operations
    discardFileChanges: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:discardFileChanges', projectPath, filePath),
    getFileHistory: (projectPath: string, filePath: string, limit?: number) =>
      ipcRenderer.invoke('git:getFileHistory', projectPath, filePath, limit),
    compareWithBranch: (projectPath: string, filePath: string, branch: string) =>
      ipcRenderer.invoke('git:compareWithBranch', projectPath, filePath, branch),
    getWorkingDiff: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getWorkingDiff', projectPath, filePath),
    getBlame: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getBlame', projectPath, filePath),
    getFileFromHead: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getFileFromHead', projectPath, filePath),

    // Stash operations
    stash: (projectPath: string, message?: string, includeUntracked?: boolean) =>
      ipcRenderer.invoke('git:stash', projectPath, message, includeUntracked),
    stashList: (projectPath: string) => ipcRenderer.invoke('git:stashList', projectPath),
    stashApply: (projectPath: string, index: number) =>
      ipcRenderer.invoke('git:stashApply', projectPath, index),
    stashPop: (projectPath: string, index: number) =>
      ipcRenderer.invoke('git:stashPop', projectPath, index),
    stashDrop: (projectPath: string, index: number) =>
      ipcRenderer.invoke('git:stashDrop', projectPath, index),
    stashClear: (projectPath: string) => ipcRenderer.invoke('git:stashClear', projectPath),
    stashShowFiles: (projectPath: string, index: number) =>
      ipcRenderer.invoke('git:stashShowFiles', projectPath, index),
    stashShowDiff: (projectPath: string, index: number) =>
      ipcRenderer.invoke('git:stashShowDiff', projectPath, index),
    stashGetFileContent: (projectPath: string, index: number, filePath: string) =>
      ipcRenderer.invoke('git:stashGetFileContent', projectPath, index, filePath),

    // History operations
    getCommitHistory: (
      projectPath: string,
      options?: {
        limit?: number
        skip?: number
        branch?: string
        author?: string
        search?: string
      }
    ) => ipcRenderer.invoke('git:getCommitHistory', projectPath, options),
    getCommitDetail: (projectPath: string, commitHash: string) =>
      ipcRenderer.invoke('git:getCommitDetail', projectPath, commitHash),
    getCommitFileDiff: (projectPath: string, commitHash: string, filePath: string) =>
      ipcRenderer.invoke('git:getCommitFileDiff', projectPath, commitHash, filePath),
    amendCommit: (projectPath: string, message?: string) =>
      ipcRenderer.invoke('git:amendCommit', projectPath, message),
    resetToCommit: (projectPath: string, commitHash: string, mode?: 'soft' | 'mixed' | 'hard') =>
      ipcRenderer.invoke('git:resetToCommit', projectPath, commitHash, mode),
    revertCommit: (projectPath: string, commitHash: string) =>
      ipcRenderer.invoke('git:revertCommit', projectPath, commitHash),
    getAuthors: (projectPath: string) => ipcRenderer.invoke('git:getAuthors', projectPath),
    getLastCommitInfo: (projectPath: string) =>
      ipcRenderer.invoke('git:getLastCommitInfo', projectPath),

    // Conflict resolution
    getConflictVersions: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('git:getConflictVersions', projectPath, filePath),
    resolveConflict: (projectPath: string, filePath: string, resolvedContent: string) =>
      ipcRenderer.invoke('git:resolveConflict', projectPath, filePath, resolvedContent),
    abortMerge: (projectPath: string) => ipcRenderer.invoke('git:abortMerge', projectPath),
    acceptAllOurs: (projectPath: string, conflictedFiles: string[]) =>
      ipcRenderer.invoke('git:acceptAllOurs', projectPath, conflictedFiles),
    acceptAllTheirs: (projectPath: string, conflictedFiles: string[]) =>
      ipcRenderer.invoke('git:acceptAllTheirs', projectPath, conflictedFiles),

    // Tag operations
    listTags: (projectPath: string) => ipcRenderer.invoke('git:listTags', projectPath),
    createTag: (
      projectPath: string,
      tagName: string,
      options?: { message?: string; commitHash?: string }
    ) => ipcRenderer.invoke('git:createTag', projectPath, tagName, options),
    deleteTag: (projectPath: string, tagName: string) =>
      ipcRenderer.invoke('git:deleteTag', projectPath, tagName),
    pushTag: (projectPath: string, tagName: string, remote?: string) =>
      ipcRenderer.invoke('git:pushTag', projectPath, tagName, remote),
    deleteRemoteTag: (projectPath: string, tagName: string, remote?: string) =>
      ipcRenderer.invoke('git:deleteRemoteTag', projectPath, tagName, remote),

    // Rebase
    rebase: (projectPath: string, onto: string) =>
      ipcRenderer.invoke('git:rebase', projectPath, onto),

    // Squash
    squashCommits: (projectPath: string, count: number, message: string) =>
      ipcRenderer.invoke('git:squashCommits', projectPath, count, message)
  },

  // Avatar APIs
  avatar: {
    select: () => ipcRenderer.invoke('avatar:select'),
    save: (sourcePath: string, ownerId: string) =>
      ipcRenderer.invoke('avatar:save', sourcePath, ownerId),
    delete: (ownerId: string) => ipcRenderer.invoke('avatar:delete', ownerId),
    getPath: (fileName: string) => ipcRenderer.invoke('avatar:getPath', fileName),
    readAsBase64: (fileName: string) => ipcRenderer.invoke('avatar:readAsBase64', fileName),
    readFileAsBase64: (filePath: string) => ipcRenderer.invoke('avatar:readFileAsBase64', filePath)
  },

  projectCreate: {
    selectProjectFolder: () => ipcRenderer.invoke('project-create:selectProjectFolder'),
    createProject: (userPrompt: string, projectPath: string) =>
      ipcRenderer.invoke('project-create:createProject', userPrompt, projectPath)
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
    },

    // Tool 相关事件：审批请求（工具内部发起）
    onApprovalRequired: (
      callback: (event: { toolCallId: string; command: string; is_background: boolean }) => void
    ) => {
      const listener = (
        _: any,
        event: { toolCallId: string; command: string; is_background: boolean }
      ) => callback(event)
      ipcRenderer.on('tool:approval-required', listener)
      return () => ipcRenderer.removeListener('tool:approval-required', listener)
    },

    // Tool 相关事件：terminal 创建（后台任务）
    onTerminalCreated: (
      callback: (event: { toolCallId: string; terminalId: string; command: string }) => void
    ) => {
      const listener = (
        _: any,
        event: { toolCallId: string; terminalId: string; command: string }
      ) => callback(event)
      ipcRenderer.on('tool:terminal-created', listener)
      return () => ipcRenderer.removeListener('tool:terminal-created', listener)
    },

    // Tool 相关事件：流式输出开始（同步任务，不创建 terminal tab）
    onStreamingStarted: (callback: (event: { toolCallId: string; command: string }) => void) => {
      const listener = (_: any, event: { toolCallId: string; command: string }) => callback(event)
      ipcRenderer.on('tool:streaming-started', listener)
      return () => ipcRenderer.removeListener('tool:streaming-started', listener)
    },

    // Tool 相关事件：输出流
    onOutputStream: (
      callback: (event: {
        toolCallId: string
        terminalId?: string
        output: string
        isError: boolean
      }) => void
    ) => {
      const listener = (
        _: any,
        event: { toolCallId: string; terminalId?: string; output: string; isError: boolean }
      ) => callback(event)
      ipcRenderer.on('tool:output-stream', listener)
      return () => ipcRenderer.removeListener('tool:output-stream', listener)
    },

    // Tool 相关事件：输出完成
    onOutputComplete: (
      callback: (event: {
        toolCallId: string
        terminalId?: string
        exitCode: number
        signal?: number
      }) => void
    ) => {
      const listener = (
        _: any,
        event: { toolCallId: string; terminalId?: string; exitCode: number; signal?: number }
      ) => callback(event)
      ipcRenderer.on('tool:output-complete', listener)
      return () => ipcRenderer.removeListener('tool:output-complete', listener)
    }
  },

  plan: {
    resolveApproval: (payload: {
      approvalId: string
      result: { type: 'approved'; feedback?: string } | { type: 'rejected'; feedback: string }
    }) => ipcRenderer.invoke('plan:resolve-approval', payload),
    onModeChanged: (
      callback: (data: {
        sessionId: string
        mode: 'default' | 'plan'
        planFilePath: string | null
      }) => void
    ) => {
      const listener = (
        _: unknown,
        data: {
          sessionId: string
          mode: 'default' | 'plan'
          planFilePath: string | null
        }
      ) => callback(data)
      ipcRenderer.on('session:mode-changed', listener)
      return () => ipcRenderer.removeListener('session:mode-changed', listener)
    },
    onApprovalRequired: (
      callback: (data: {
        approvalId: string
        sessionId: string
        assistantMessageId: number
        planContent: string
        planFilePath: string
      }) => void
    ) => {
      const listener = (
        _: unknown,
        data: {
          approvalId: string
          sessionId: string
          assistantMessageId: number
          planContent: string
          planFilePath: string
        }
      ) => callback(data)
      ipcRenderer.on('plan:approval-required', listener)
      return () => ipcRenderer.removeListener('plan:approval-required', listener)
    }
  },

  delegate: {
    onStart: (
      callback: (data: {
        taskId: string
        sessionId: string
        description: string
        subagentType: string
        subagentName: string
        icon: string
        color: string
      }) => void
    ) => {
      const listener = (
        _: unknown,
        data: {
          taskId: string
          sessionId: string
          description: string
          subagentType: string
          subagentName: string
          icon: string
          color: string
        }
      ) => callback(data)
      ipcRenderer.on('delegate:start', listener)
      return () => ipcRenderer.removeListener('delegate:start', listener)
    },
    onProgress: (
      callback: (data: {
        taskId: string
        sessionId: string
        filesExplored: number
        searches: number
        edits: number
        toolCalls: number
        currentOperation?: string
      }) => void
    ) => {
      const listener = (
        _: unknown,
        data: {
          taskId: string
          sessionId: string
          filesExplored: number
          searches: number
          edits: number
          toolCalls: number
          currentOperation?: string
        }
      ) => callback(data)
      ipcRenderer.on('delegate:progress', listener)
      return () => ipcRenderer.removeListener('delegate:progress', listener)
    },
    onComplete: (
      callback: (data: {
        taskId: string
        sessionId: string
        result?: string
        error?: string
        durationMs: number
        progress?: {
          filesExplored: number
          searches: number
          edits: number
          toolCalls: number
        }
      }) => void
    ) => {
      const listener = (
        _: unknown,
        data: {
          taskId: string
          sessionId: string
          result?: string
          error?: string
          durationMs: number
          progress?: {
            filesExplored: number
            searches: number
            edits: number
            toolCalls: number
          }
        }
      ) => callback(data)
      ipcRenderer.on('delegate:complete', listener)
      return () => ipcRenderer.removeListener('delegate:complete', listener)
    }
  },

  // Todo APIs
  todo: {
    get: (sessionId: string) => ipcRenderer.invoke('todo:get', sessionId),
    onUpdate: (
      callback: (event: {
        sessionId: string
        todos: Array<{
          id: string
          content: string
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          createdAt: number
          updatedAt: number
        }>
        action: 'created' | 'updated'
      }) => void
    ) => {
      const listener = (_: any, event: any) => callback(event)
      ipcRenderer.on('todo:update', listener)
      return () => ipcRenderer.removeListener('todo:update', listener)
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
    onOpenUrl: (callback: (url: string) => void) => {
      const listener = (_: any, url: string) => callback(url)
      ipcRenderer.on('app:open-url', listener)
      return () => ipcRenderer.removeListener('app:open-url', listener)
    }
  },

  // Workflow APIs
  workflow: {
    resume: (params: { sessionId: string; approved: boolean; modifiedData?: any }) =>
      ipcRenderer.invoke('workflow:resume', params),
    cancel: (params: { sessionId: string }) => ipcRenderer.invoke('workflow:cancel', params)
  },

  // Pending Edits APIs - 前后端同步
  pendingEdits: {
    clear: (sessionId: string, absolutePath: string) =>
      ipcRenderer.invoke('pendingEdits:clear', sessionId, absolutePath),
    clearSession: (sessionId: string) => ipcRenderer.invoke('pendingEdits:clearSession', sessionId)
  },

  // Search APIs
  search: {
    find: (
      projectPath: string,
      query: string,
      options?: {
        caseSensitive?: boolean
        wholeWord?: boolean
        useRegex?: boolean
        includePattern?: string
        excludePattern?: string
      }
    ) => ipcRenderer.invoke('search:find', projectPath, query, options),
    replaceInFile: (
      filePath: string,
      searchText: string,
      replaceText: string,
      options?: {
        caseSensitive?: boolean
        wholeWord?: boolean
        useRegex?: boolean
      }
    ) => ipcRenderer.invoke('search:replaceInFile', filePath, searchText, replaceText, options),
    replaceAll: (
      projectPath: string,
      searchText: string,
      replaceText: string,
      options?: {
        caseSensitive?: boolean
        wholeWord?: boolean
        useRegex?: boolean
        includePattern?: string
        excludePattern?: string
      }
    ) => ipcRenderer.invoke('search:replaceAll', projectPath, searchText, replaceText, options)
  },

  // Recent Files APIs
  recentFiles: {
    add: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('recentFiles:add', projectPath, filePath),
    get: (projectPath: string, limit?: number) =>
      ipcRenderer.invoke('recentFiles:get', projectPath, limit) as Promise<string[]>,
    remove: (projectPath: string, filePath: string) =>
      ipcRenderer.invoke('recentFiles:remove', projectPath, filePath),
    clear: (projectPath: string) => ipcRenderer.invoke('recentFiles:clear', projectPath)
  },

  // Notifications APIs - 通知中心
  notifications: {
    getAll: () =>
      ipcRenderer.invoke('notifications:getAll') as Promise<
        Array<{
          id: string
          type: 'success' | 'error' | 'warning' | 'info'
          title: string
          description: string | null
          timestamp: Date
          read: boolean
        }>
      >,
    add: (notification: {
      id: string
      type: 'success' | 'error' | 'warning' | 'info'
      title: string
      description?: string
      timestamp: Date
    }) => ipcRenderer.invoke('notifications:add', notification),
    markAsRead: (id: string) => ipcRenderer.invoke('notifications:markAsRead', id),
    markAllAsRead: () => ipcRenderer.invoke('notifications:markAllAsRead'),
    remove: (id: string) => ipcRenderer.invoke('notifications:remove', id),
    clearAll: () => ipcRenderer.invoke('notifications:clearAll')
  },

  // Recent Branches APIs - Git 最近分支
  recentBranches: {
    get: (projectPath: string, limit?: number) =>
      ipcRenderer.invoke('recentBranches:get', projectPath, limit) as Promise<string[]>,
    add: (projectPath: string, branchName: string) =>
      ipcRenderer.invoke('recentBranches:add', projectPath, branchName)
  },

  // Bug Report APIs
  bugReport: {
    submit: (title: string, description: string) =>
      ipcRenderer.invoke('bugReport:submit', title, description)
  },

  // Completion APIs
  completion: {
    generate: (request: {
      filePath: string
      fileContent: string
      language: string
      cursorPosition: { line: number; column: number }
      lintErrors: Array<{
        line: number
        column: number
        message: string
        severity: 'error' | 'warning' | 'info'
        source?: string
        code?: string
      }>
      projectName?: string
      workspaceRoot?: string
    }) => ipcRenderer.invoke('completion:generate', request)
  },

  // Skills APIs
  skills: {
    scan: (projectPath?: string) => ipcRenderer.invoke('skills:scan', projectPath),
    toggle: (skillPath: string, enabled: boolean) =>
      ipcRenderer.invoke('skills:toggle', skillPath, enabled),
    delete: (skillPath: string) => ipcRenderer.invoke('skills:delete', skillPath)
  },

  modelConfig: {
    getAll: () => ipcRenderer.invoke('model-config:getAll'),
    getDefault: () => ipcRenderer.invoke('model-config:getDefault'),
    add: (input: { providerId: string; modelId: string; isDefault?: boolean }) =>
      ipcRenderer.invoke('model-config:add', input),
    setDefault: (id: string) => ipcRenderer.invoke('model-config:setDefault', id),
    delete: (id: string) => ipcRenderer.invoke('model-config:delete', id),
    exists: (providerId: string, modelId: string) =>
      ipcRenderer.invoke('model-config:exists', providerId, modelId)
  },
  providerApiKey: {
    get: (providerId: string) => ipcRenderer.invoke('provider-api-key:get', providerId),
    set: (input: { providerId: string; apiKey: string; baseURL?: string }) =>
      ipcRenderer.invoke('provider-api-key:set', input),
    delete: (providerId: string) => ipcRenderer.invoke('provider-api-key:delete', providerId)
  },

  // Shell APIs
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Auto-updater APIs
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-available', (_event, info) => callback(info))
      return () => ipcRenderer.removeAllListeners('update-available')
    },
    onUpdateNotAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-not-available', (_event, info) => callback(info))
      return () => ipcRenderer.removeAllListeners('update-not-available')
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update-downloaded', (_event, info) => callback(info))
      return () => ipcRenderer.removeAllListeners('update-downloaded')
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('download-progress', (_event, progress) => callback(progress))
      return () => ipcRenderer.removeAllListeners('download-progress')
    },
    onUpdateError: (callback: (error: string) => void) => {
      ipcRenderer.on('update-error', (_event, error) => callback(error))
      return () => ipcRenderer.removeAllListeners('update-error')
    }
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
