import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      chat: {
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
              | 'interrupt'
              | 'error'
              | 'session-id'
              | 'message-start'
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
            interrupt?: any
            error?: string
          }) => void,
          onEnd: (sessionId: string) => void,
          onError: (error: string) => void
        ) => { cleanup: () => void; stop: () => void }
        resumeInterrupt: (
          sessionId: string,
          toolCallId: string,
          decision: string
        ) => Promise<{ success: boolean }>
      }
      sessions: {
        create: (modelId: string, projectPath: string) => Promise<string>
        getByProject: (projectPath: string) => Promise<any[]>
        getWithMessages: (sessionId: string) => Promise<any>
        update: (sessionId: string, updates: { title?: string }) => Promise<void>
        delete: (sessionId: string) => Promise<void>
        deleteMessagesAfter: (
          sessionId: string,
          messageId: number
        ) => Promise<{ success: boolean; deletedCount: number }>
      }
      message: {
        getAffectedFiles: (messageId: number) => Promise<
          {
            path: string
            action: 'create' | 'edit' | 'delete'
            size: number
          }[]
        >
        revertFiles: (messageId: number) => Promise<{
          success: boolean
          filesRestored: number
          files: string[]
        }>
      }
      config: {
        get: () => Promise<any>
        set: (config: any) => Promise<void>
        getTheme: () => Promise<'light' | 'dark'>
        setTheme: (theme: 'light' | 'dark') => Promise<void>
        updateWindowTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>
        getPreferences: () => Promise<any>
        setPreference: (key: string, value: boolean) => Promise<void>
        // UI State APIs
        getUIState: () => Promise<any>
        setUIState: (state: any) => Promise<void>
        updateUIState: (updates: any) => Promise<void>
        // Layout State APIs
        getLayoutState: () => Promise<{
          showFileTree?: boolean
          showChatSidebar?: boolean
          bottomPanel?: 'terminal' | 'problems' | null
          activeLeftTab?: 'explorer' | 'search' | 'changes' | 'history' | 'mcp' | 'skills'
          panelLayout?: { fileTreeSize?: number; chatPanelSize?: number }
        }>
        setLayoutState: (layout: {
          showFileTree?: boolean
          showChatSidebar?: boolean
          bottomPanel?: 'terminal' | 'problems' | null
          activeLeftTab?: 'explorer' | 'search' | 'changes' | 'history' | 'mcp' | 'skills'
          panelLayout?: { fileTreeSize?: number; chatPanelSize?: number }
        }) => Promise<void>
        debug: () => Promise<{ path: string; config: any }>
        // API Keys
        getApiKeys: () => Promise<Record<string, string>>
        getApiKey: (provider: string) => Promise<string | undefined>
        setApiKey: (provider: string, apiKey: string) => Promise<{ success: boolean }>
        deleteApiKey: (provider: string) => Promise<{ success: boolean }>
        setApiKeys: (apiKeys: Record<string, string>) => Promise<{ success: boolean }>
        // Default Model
        getDefaultModel: () => Promise<string>
        setDefaultModel: (modelId: string) => Promise<{ success: boolean }>
      }
      memory: {
        getAll: () => Promise<Array<{
          id: string
          content: string
          createdAt: Date
          updatedAt: Date
        }>>
        create: (content: string) => Promise<{ success: boolean; id: string }>
        update: (id: string, content: string) => Promise<{ success: boolean }>
        delete: (id: string) => Promise<{ success: boolean }>
      }
      userRule: {
        getAll: () => Promise<Array<{
          id: string
          content: string
          createdAt: number
          updatedAt: number
        }>>
        create: (content: string) => Promise<{ success: boolean; id: string }>
        update: (id: string, content: string) => Promise<{ success: boolean }>
        delete: (id: string) => Promise<{ success: boolean }>
      }
      mcp: {
        getAllServers: () => Promise<any[]>
        addServer: (server: { name: string; configJson: any }) => Promise<any>
        updateServer: (serverId: string, name: string, configJson: any) => Promise<any>
        deleteServer: (serverId: string) => Promise<void>
        connect: (
          serverId: string,
          serverConfig: any
        ) => Promise<{
          success: boolean
          requiresAuth: boolean
          statusCode?: number
        }>
        disconnect: (serverId: string) => Promise<void>
        callTool: (serverId: string, toolName: string, args: any) => Promise<any>
        listAllTools: () => Promise<any[]>
        getMarketServers: (params: {
          empId?: string
          orderBy?: 'TIMESTAMP' | 'USAGE'
          page?: number
          pageSize?: number
        }) => Promise<{
          content: Array<{
            code: string
            name: string
            description: string
            ownerEmpId: string
            platformCode: string
            updateTimeStamp: string
            icon: string
            usageCount: number
            toolsCount: number
          }>
          totalPages: number
          totalElements: number
        }>
        getServerDetail: (serverName: string) => Promise<any>
        listAllResources: () => Promise<any[]>
        readResource: (serverId: string, resourceName: string, args: any) => Promise<any>
        listAllPrompts: () => Promise<any[]>
        getPrompt: (serverId: string, promptName: string, args: any) => Promise<string>
        getConnectionStatus: (
          serverId: string
        ) => Promise<'connecting' | 'connected' | 'disconnected' | 'error'>
        startAuth: (serverId: string) => Promise<boolean>
        clearAuth: (serverId: string) => Promise<void>
      }
      mcpMarket: {
        getAll: (options?: {
          category?: string
          search?: string
          sortBy?: 'downloads' | 'stars' | 'rating' | 'createdAt'
          limit?: number
          offset?: number
        }) => Promise<any[]>
        getBySlug: (slug: string) => Promise<any>
        getCategories: () => Promise<Array<{ name: string; count: number }>>
        install: (slug: string) => Promise<any>
        getStats: () => Promise<{ total: number; installed: number; categories: number }>
        triggerSync: () => Promise<{ success: boolean }>
        getSyncStatus: () => Promise<{
          isSyncing: boolean
          lastSyncTime: Date | null
          lastSyncResult: any
          isRunning: boolean
        }>
      }
      files: {
        read: (filePath: string) => Promise<string>
        quickOpen: (
          projectPath: string,
          query: string,
          limit?: number
        ) => Promise<
          Array<{
            name: string
            path: string
            relativePath: string
          }>
        >
        readWithEncoding: (filePath: string, encoding: string) => Promise<string>
        detectEncoding: (filePath: string) => Promise<string>
        readBinary: (filePath: string) => Promise<Uint8Array>
        write: (filePath: string, content: string) => Promise<void>
        writeWithEncoding: (filePath: string, content: string, encoding: string) => Promise<void>
        listDirectory: (dirPath: string) => Promise<any[]>
        createFile: (filePath: string, content: string) => Promise<void>
        createDirectory: (dirPath: string) => Promise<void>
        delete: (targetPath: string) => Promise<void>
        rename: (oldPath: string, newPath: string) => Promise<void>
        exists: (targetPath: string) => Promise<boolean>
        getInfo: (filePath: string) => Promise<any>
        stat?: (filePath: string) => Promise<any>
        revealInFinder?: (filePath: string) => Promise<void>
        openPath: (path: string) => Promise<string>
        onFileChanged: (callback: (event: { type: string; path: string }) => void) => () => void
        onGitExternalChange?: (callback: (event: { projectPath: string }) => void) => () => void
      }
      project: {
        openDialog: () => Promise<string | null>
        getRecent: () => Promise<Array<{ name: string; path: string; lastOpened: string }>>
        getCurrent: () => Promise<string | null>
        setCurrent: (projectPath: string | null) => Promise<void>
        close: () => Promise<void>
        openInNewWindow: (projectPath: string) => Promise<{ success: boolean; error?: string }>
      }
      window: {
        onOpenProject: (callback: (data: { projectPath: string }) => void) => () => void
        onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void
      }
      menu: {
        onOpenProject: (callback: () => void) => () => void
        onOpenRecentProject: (callback: (path: string) => void) => () => void
        onSaveFile: (callback: () => void) => () => void
        onSaveAll: (callback: () => void) => () => void
        onCloseWorkspace: (callback: () => void) => () => void
        onOpenSettings: (callback: () => void) => () => void
        onToggleSidebar: (callback: () => void) => () => void
        onToggleChat: (callback: () => void) => () => void
        onToggleTerminal: (callback: () => void) => () => void
        onReportBug: (callback: () => void) => () => void
      }
      git: {
        isInstalled: () => Promise<boolean>
        validateUrl: (url: string) => Promise<{ valid: boolean; message?: string }>
        extractRepoName: (url: string) => Promise<string>
        selectTargetDirectory: () => Promise<string | null>
        cloneRepository: (repoUrl: string, targetPath: string) => Promise<string>
        validateProjectName: (name: string) => Promise<{ valid: boolean; message?: string }>
        createNewProject: (parentPath: string, projectName: string) => Promise<string>
        onCloneProgress: (callback: (message: string) => void) => () => void
        // Repository & Branch operations
        isRepository: (projectPath: string) => Promise<boolean>
        initRepository: (projectPath: string) => Promise<void>
        getCurrentBranch: (projectPath: string) => Promise<string | null>
        getAllBranches: (projectPath: string) => Promise<
          Array<{
            name: string
            current: boolean
            remote: boolean
          }>
        >
        checkoutBranch: (projectPath: string, branchName: string) => Promise<void>
        createBranch: (
          projectPath: string,
          branchName: string,
          checkout: boolean,
          startPoint?: string
        ) => Promise<void>
        getBranchCommit: (projectPath: string, branchName: string) => Promise<string>
        deleteBranch: (projectPath: string, branchName: string, force: boolean) => Promise<void>
        deleteRemoteBranch: (
          projectPath: string,
          remoteName: string,
          branchName: string
        ) => Promise<void>
        getTrackingBranch: (
          projectPath: string,
          branchName: string
        ) => Promise<{ remote: string; branch: string } | null>
        unsetUpstream: (projectPath: string, branchName: string) => Promise<void>
        renameBranch: (projectPath: string, oldName: string, newName: string) => Promise<void>
        mergeBranch: (
          projectPath: string,
          branchName: string
        ) => Promise<{ success: boolean; message: string }>
        compareBranches: (
          projectPath: string,
          baseBranch: string,
          compareBranch: string
        ) => Promise<{
          files: Array<{
            path: string
            status: 'added' | 'modified' | 'deleted' | 'renamed'
            additions: number
            deletions: number
          }>
          stats: { additions: number; deletions: number; filesChanged: number }
        }>
        getBranchFileDiff: (
          projectPath: string,
          baseBranch: string,
          compareBranch: string,
          filePath: string
        ) => Promise<{ baseContent: string; compareContent: string }>
        // Status & Changes
        getStatus: (projectPath: string) => Promise<{
          branch: string
          ahead: number
          behind: number
          staged: string[]
          modified: string[]
          deleted: string[]
          untracked: string[]
          conflicted: string[]
        }>
        stageFiles: (projectPath: string, files: string[]) => Promise<void>
        unstageFiles: (projectPath: string, files: string[]) => Promise<void>
        commit: (projectPath: string, message: string) => Promise<void>
        getDiff: (projectPath: string, filePath: string) => Promise<string>
        // Remote operations
        push: (
          projectPath: string,
          remote: string,
          branch?: string,
          setUpstream?: boolean
        ) => Promise<void>
        pushToRef: (
          projectPath: string,
          remote: string,
          refspec: string,
          setUpstream?: boolean
        ) => Promise<void>
        pull: (
          projectPath: string,
          remote: string,
          branch?: string
        ) => Promise<{ commits: number; files: number; insertions: number; deletions: number }>
        fetch: (projectPath: string, remote: string) => Promise<void>
        getRemotes: (projectPath: string) => Promise<Array<{ name: string; url: string }>>
        addRemote: (projectPath: string, name: string, url: string) => Promise<void>
        // File operations
        discardFileChanges: (projectPath: string, filePath: string) => Promise<void>
        getFileHistory: (
          projectPath: string,
          filePath: string,
          limit?: number
        ) => Promise<
          Array<{
            hash: string
            author: string
            date: string
            message: string
          }>
        >
        compareWithBranch: (
          projectPath: string,
          filePath: string,
          branch: string
        ) => Promise<string>
        getWorkingDiff: (projectPath: string, filePath: string) => Promise<string>
        getBlame: (
          projectPath: string,
          filePath: string
        ) => Promise<{
          lines: Array<{
            line: number
            commit: string
            author: string
            authorMail: string
            authorTime: number
            authorTz: string
            committer: string
            committerMail: string
            committerTime: number
            committerTz: string
            summary: string
            previous?: string
            filename: string
          }>
        }>
        getFileFromHead: (projectPath: string, filePath: string) => Promise<string>
        // Stash operations
        stash: (projectPath: string, message?: string, includeUntracked?: boolean) => Promise<void>
        stashList: (projectPath: string) => Promise<
          Array<{
            index: number
            branch: string
            message: string
            date: string
            hash: string
          }>
        >
        stashApply: (projectPath: string, index?: number) => Promise<void>
        stashPop: (projectPath: string, index?: number) => Promise<void>
        stashDrop: (projectPath: string, index: number) => Promise<void>
        stashClear: (projectPath: string) => Promise<void>
        stashShowFiles: (projectPath: string, index: number) => Promise<string[]>
        stashShowDiff: (projectPath: string, index: number) => Promise<string>
        stashGetFileContent: (
          projectPath: string,
          index: number,
          filePath: string
        ) => Promise<string>
        // History operations
        getCommitHistory: (
          projectPath: string,
          options?: {
            limit?: number
            skip?: number
            branch?: string // 'all' 表示所有分支
            author?: string
            search?: string
          }
        ) => Promise<{
          commits: Array<{
            hash: string
            shortHash: string
            author: string
            email: string
            date: string
            message: string
            parents: string[]
            refs?: string[]
          }>
          hasMore: boolean
        }>
        getAuthors: (projectPath: string) => Promise<string[]>
        getCommitDetail: (
          projectPath: string,
          commitHash: string
        ) => Promise<{
          hash: string
          shortHash: string
          author: string
          email: string
          date: string
          message: string
          parents: string[]
          body: string
          files: Array<{
            path: string
            status: 'added' | 'modified' | 'deleted' | 'renamed'
          }>
          stats: {
            additions: number
            deletions: number
            filesChanged: number
          }
        } | null>
        getCommitFileDiff: (
          projectPath: string,
          commitHash: string,
          filePath: string
        ) => Promise<{ before: string; after: string }>
        amendCommit: (projectPath: string, message?: string) => Promise<void>
        resetToCommit: (
          projectPath: string,
          commitHash: string,
          mode?: 'soft' | 'mixed' | 'hard'
        ) => Promise<void>
        revertCommit: (projectPath: string, commitHash: string) => Promise<void>
        getLastCommitInfo: (projectPath: string) => Promise<{
          hash: string
          shortHash: string
          message: string
          author: string
          date: string
          files: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }>
          isPushed: boolean
        } | null>

        // Conflict resolution
        getConflictVersions: (
          projectPath: string,
          filePath: string
        ) => Promise<{
          ours: string
          theirs: string
          base: string
          current: string
          oursBranch: string
          theirsBranch: string
        }>
        resolveConflict: (
          projectPath: string,
          filePath: string,
          resolvedContent: string
        ) => Promise<void>
        abortMerge: (projectPath: string) => Promise<void>
        acceptAllOurs: (projectPath: string, conflictedFiles: string[]) => Promise<void>
        acceptAllTheirs: (projectPath: string, conflictedFiles: string[]) => Promise<void>

        // Tag operations
        listTags: (
          projectPath: string
        ) => Promise<Array<{ name: string; hash: string; message?: string; date?: string }>>
        createTag: (
          projectPath: string,
          tagName: string,
          options?: { message?: string; commitHash?: string }
        ) => Promise<void>
        deleteTag: (projectPath: string, tagName: string) => Promise<void>
        pushTag: (projectPath: string, tagName: string, remote?: string) => Promise<void>
        deleteRemoteTag: (projectPath: string, tagName: string, remote?: string) => Promise<void>

        // Rebase
        rebase: (
          projectPath: string,
          onto: string
        ) => Promise<{ success: boolean; message: string }>

        // Squash
        squashCommits: (projectPath: string, count: number, message: string) => Promise<void>
      }
      avatar: {
        select: () => Promise<string | null>
        save: (sourcePath: string, ownerId: string) => Promise<string>
        delete: (ownerId: string) => Promise<void>
        getPath: (fileName: string) => Promise<string>
        readAsBase64: (fileName: string) => Promise<string>
        readFileAsBase64: (filePath: string) => Promise<string>
      }
      projectCreate: {
        selectProjectFolder: () => Promise<{ canceled: boolean; path?: string }>
        createProject: (
          userPrompt: string,
          projectPath: string
        ) => Promise<{
          success: boolean
          response: string
          projectPath: string
        }>
      }
      terminal: {
        create: (cwd: string) => Promise<string>
        write: (terminalId: string, data: string) => Promise<void>
        resize: (terminalId: string, cols: number, rows: number) => Promise<void>
        kill: (terminalId: string) => Promise<void>
        onData: (callback: (event: { terminalId: string; data: string }) => void) => () => void
        onExit: (
          callback: (event: { terminalId: string; exitCode: number; signal?: number }) => void
        ) => () => void
        onRunCommand: (callback: (command: string) => void) => () => void
        onApprovalRequired: (
          callback: (event: { toolCallId: string; command: string; is_background: boolean }) => void
        ) => () => void
        onTerminalCreated: (
          callback: (event: { toolCallId: string; terminalId: string; command: string }) => void
        ) => () => void
        onStreamingStarted: (
          callback: (event: { toolCallId: string; command: string }) => void
        ) => () => void
        onOutputStream: (
          callback: (event: { toolCallId: string; output: string; isError: boolean }) => void
        ) => () => void
        onOutputComplete: (
          callback: (event: { toolCallId: string; exitCode: number }) => void
        ) => () => void
      }

      todo: {
        get: (sessionId: string) => Promise<
          Array<{
            id: string
            content: string
            status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
            createdAt: number
            updatedAt: number
          }>
        >
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
        ) => () => void
      }

      system: {
        getFonts: () => Promise<string[]>
      }
      codebase: {
        index: (projectPath: string) => Promise<{
          success: boolean
          totalFiles: number
          totalChunks: number
          totalSize: number
          indexedAt: number
          // 增量统计
          newFiles?: number
          modifiedFiles?: number
          deletedFiles?: number
          unchangedFiles?: number
        }>
        search: (
          projectPath: string,
          query: string,
          options?: any
        ) => Promise<
          Array<{
            filePath: string
            relativePath: string
            score: number
            matches: Array<{ line: number; content: string }>
            language: string
          }>
        >
        getIndex: (projectPath: string) => Promise<{
          projectName: string
          totalFiles: number
          totalChunks?: number
          totalSize: number
          indexedAt: number
        } | null>
        deleteIndex: (projectPath: string) => Promise<{ success: boolean }>
        onIndexProgress: (
          callback: (event: {
            current: number
            total: number
            file: string
            progress: number
          }) => void
        ) => () => void
      }
      diagnostics: {
        get: (
          filePath: string,
          content?: string
        ) => Promise<
          Array<{
            filePath: string
            line: number
            column: number
            severity: 'error' | 'warning' | 'info'
            message: string
            source: string
            code?: string | number
          }>
        >
        clear: (filePath?: string) => Promise<void>
      }
      languageService: {
        updateFile: (projectRoot: string, fileName: string, content: string) => Promise<void>
        getQuickInfo: (
          projectRoot: string,
          fileName: string,
          position: number
        ) => Promise<{
          kind: string
          kindModifiers: string
          displayParts: Array<{ text: string; kind: string }>
          documentation: Array<{ text: string; kind: string }>
        } | null>
        getDefinition: (
          projectRoot: string,
          fileName: string,
          position: number
        ) => Promise<
          Array<{
            fileName: string
            textSpan: { start: number; length: number }
            kind: string
            name: string
            containerKind: string
            containerName: string
          }>
        >
        getReferences: (
          projectRoot: string,
          fileName: string,
          position: number
        ) => Promise<
          Array<{
            fileName: string
            textSpan: { start: number; length: number }
            isWriteAccess: boolean
            isDefinition: boolean
          }>
        >
        getRenameLocations: (
          projectRoot: string,
          fileName: string,
          position: number
        ) => Promise<
          Array<{
            fileName: string
            textSpan: { start: number; length: number }
          }>
        >
        getCompletions: (
          projectRoot: string,
          fileName: string,
          position: number
        ) => Promise<
          Array<{
            name: string
            kind: string
            kindModifiers: string
            sortText: string
            insertText?: string
            replacementSpan?: { start: number; length: number }
          }>
        >
        getSignatureHelp: (
          projectRoot: string,
          fileName: string,
          position: number
        ) => Promise<
          Array<{
            prefix: string
            suffix: string
            separator: string
            parameters: Array<{
              name: string
              documentation: Array<{ text: string; kind: string }>
              displayParts: Array<{ text: string; kind: string }>
            }>
            documentation: Array<{ text: string; kind: string }>
          }>
        >
        formatDocument: (
          projectRoot: string,
          fileName: string
        ) => Promise<
          Array<{
            span: { start: number; length: number }
            newText: string
          }>
        >
      }
      mastergo: {
        login: () => Promise<{
          success: boolean
          data?: { token: string; user: any; requestId: string }
          error?: string
        }>
        getProjects: () => Promise<{ success: boolean; data?: any[]; error?: string }>
        getLoginStatus: () => Promise<boolean>
        getSessionInfo: () => Promise<{
          success: boolean
          data?: { isLoggedIn: boolean; user?: any; sessionToken?: string }
          error?: string
        }>
        getSessionToken: () => Promise<{ success: boolean; data?: string | null; error?: string }>
        setCookies: () => Promise<{ success: boolean; error?: string }>
        validateSession: () => Promise<{
          success: boolean
          data?: { isValid: boolean }
          error?: string
        }>
        logout: () => Promise<{ success: boolean; error?: string }>
      }
      app: {
        onOpenUrl: (callback: (url: string) => void) => () => void
      }
      workflow: {
        resume: (params: { sessionId: string; approved: boolean; modifiedData?: any }) => Promise<{
          status: 'completed' | 'failed' | 'cancelled'
          result?: any
          error?: string
        }>
        cancel: (params: { sessionId: string }) => Promise<void>
      }
      pendingEdits: {
        clear: (sessionId: string, absolutePath: string) => Promise<{ success: boolean }>
        clearSession: (sessionId: string) => Promise<{ success: boolean }>
      }
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
        ) => Promise<
          Array<{
            filePath: string
            relativePath: string
            matches: Array<{
              line: number
              column: number
              length: number
              lineContent: string
              matchText: string
            }>
          }>
        >
        replaceInFile: (
          filePath: string,
          searchText: string,
          replaceText: string,
          options?: {
            caseSensitive?: boolean
            wholeWord?: boolean
            useRegex?: boolean
          }
        ) => Promise<{ filePath: string; replacements: number }>
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
        ) => Promise<Array<{ filePath: string; replacements: number }>>
      }
      recentFiles: {
        add: (projectPath: string, filePath: string) => Promise<{ success: boolean }>
        get: (projectPath: string, limit?: number) => Promise<string[]>
        remove: (projectPath: string, filePath: string) => Promise<{ success: boolean }>
        clear: (projectPath: string) => Promise<{ success: boolean }>
      }
      notifications: {
        getAll: () => Promise<
          Array<{
            id: string
            type: 'success' | 'error' | 'warning' | 'info'
            title: string
            description: string | null
            timestamp: Date
            read: boolean
          }>
        >
        add: (notification: {
          id: string
          type: 'success' | 'error' | 'warning' | 'info'
          title: string
          description?: string
          timestamp: Date
        }) => Promise<{ success: boolean }>
        markAsRead: (id: string) => Promise<{ success: boolean }>
        markAllAsRead: () => Promise<{ success: boolean }>
        remove: (id: string) => Promise<{ success: boolean }>
        clearAll: () => Promise<{ success: boolean }>
      }
      recentBranches: {
        get: (projectPath: string, limit?: number) => Promise<string[]>
        add: (projectPath: string, branchName: string) => Promise<{ success: boolean }>
      }
      bugReport: {
        submit: (
          title: string,
          description: string
        ) => Promise<{
          success: boolean
          error?: string
        }>
      }
      completion: {
        generate: (request: {
          filePath: string
          fileContent: string
          language: string
          cursorPosition: { line: number; column: number }
          modelId?: string
          enableValidation?: boolean // 🔥 可选：启用 Shadow Workspace 验证
        }) => Promise<{
          type: 'done' | 'error'
          text?: string
          error?: string
          metrics?: {
            requestTime: number
            completeTime?: number
            tokenCount?: number
            validated?: boolean // 是否经过验证
            attempts?: number // 重试次数
            errors?: number // 错误数量
          }
        }>
      }
      skills: {
        scan: (projectPath?: string) => Promise<{
          skills: Array<{
            metadata: {
              name: string
              description: string
              version?: string
              tags?: string[]
              compatibility?: string
              author?: string
              homepage?: string
              [key: string]: unknown
            }
            instructions: string
            skillPath: string
            enabled?: boolean
            scope?: 'user' | 'project'
          }>
          failedSkills: Array<{
            skillPath: string
            scope: 'user' | 'project'
            error: string
            errorDetails?: string
          }>
        }>
        toggle: (skillPath: string, enabled: boolean) => Promise<{ success: boolean }>
        delete: (skillPath: string) => Promise<{ success: boolean }>
        installFromGit: (
          repoUrl: string,
          skillName: string,
          scope?: 'user' | 'project',
          projectPath?: string
        ) => Promise<{ success: boolean }>
        search: (params: {
          q: string
          page?: number
          limit?: number
        }) => Promise<{
          success: boolean
          data: Array<{
            id: string
            name: string
            description: string
            author?: string
            githubUrl?: string
            skillUrl?: string
            stars?: number
            updatedAt?: number
            [key: string]: unknown
          }>
          total: number
          page: number
          limit: number
        }>
        fetchContent: (githubUrl: string) => Promise<string>
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}
