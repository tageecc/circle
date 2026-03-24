import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      agents: {
        getAll: () => Promise<any[]>
        getDefault: () => Promise<any>
        getById: (id: string) => Promise<any>
        create: (data: any) => Promise<any>
        update: (id: string, data: any) => Promise<any>
        delete: (id: string) => Promise<void>
      }
      chat: {
        send: (options: {
          agentId: string
          threadId?: string
          resourceId?: string
          message: string
        }) => Promise<{
          threadId: string
          response: string
          toolCalls?: any[]
        }>
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
                  stats?: { linesAdded: number; linesDeleted: number; linesTotal: number }
                }
              }
            }
          }) => void,
          onEnd: (threadId: string) => void,
          onError: (error: string) => void
        ) => { cleanup: () => void; stop: () => void }
      }
      threads: {
        getByAgent: (agentId: string) => Promise<any[]>
        getWithMessages: (threadId: string) => Promise<any>
        delete: (threadId: string) => Promise<void>
      }
      completion: {
        generate: (request: {
          filePath: string
          fileContent: string
          line: number
          column: number
          enableValidation?: boolean
        }) => Promise<
          | {
              type: 'done'
              text: string
              metrics?: { validated?: boolean; attempts?: number; errors?: number }
            }
          | { type: 'error'; error: string }
        >
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
        debug: () => Promise<{ path: string; config: any }>
      }
      tools: {
        getAll: (agentId?: string) => Promise<any[]>
        getTop: (limit?: number, agentId?: string) => Promise<any[]>
        getStatsByServer: (agentId?: string) => Promise<any>
        importFromMCP: (serverId: string) => Promise<{ success: boolean; count: number }>
        syncMCPServer: (serverId: string) => Promise<{ success: boolean }>
        createCustom: (data: any) => Promise<any>
        update: (id: string, data: any) => Promise<any>
        delete: (id: string) => Promise<void>
      }
      mcp: {
        getAll: () => Promise<any[]>
        create: (data: any) => Promise<any>
        update: (id: string, data: any) => Promise<any>
        delete: (id: string) => Promise<void>
      }
      files: {
        read: (filePath: string) => Promise<string>
        readBinary: (filePath: string) => Promise<Uint8Array>
        write: (filePath: string, content: string) => Promise<void>
        listDirectory: (dirPath: string) => Promise<any[]>
        createFile: (filePath: string, content: string) => Promise<void>
        createDirectory: (dirPath: string) => Promise<void>
        delete: (targetPath: string) => Promise<void>
        rename: (oldPath: string, newPath: string) => Promise<void>
        exists: (targetPath: string) => Promise<boolean>
        getInfo: (filePath: string) => Promise<any>
        stat?: (filePath: string) => Promise<any>
        revealInFinder?: (filePath: string) => Promise<void>
        onFileChanged: (callback: (event: { type: string; path: string }) => void) => () => void
      }
      project: {
        openDialog: () => Promise<string | null>
        getRecent: () => Promise<Array<{ name: string; path: string; lastOpened: string }>>
        getCurrent: () => Promise<string | null>
        setCurrent: (projectPath: string | null) => Promise<void>
        close: () => Promise<void>
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
        getCurrentBranch: (projectPath: string) => Promise<string | null>
        getAllBranches: (projectPath: string) => Promise<
          Array<{
            name: string
            current: boolean
            remote: boolean
          }>
        >
        checkoutBranch: (projectPath: string, branchName: string) => Promise<void>
        createBranch: (projectPath: string, branchName: string, checkout: boolean) => Promise<void>
        deleteBranch: (projectPath: string, branchName: string, force: boolean) => Promise<void>
        // Status & Changes
        getStatus: (projectPath: string) => Promise<{
          branch: string
          ahead: number
          behind: number
          staged: string[]
          modified: string[]
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
        pull: (projectPath: string, remote: string, branch?: string) => Promise<void>
        fetch: (projectPath: string, remote: string) => Promise<void>
        getRemotes: (projectPath: string) => Promise<Array<{ name: string; url: string }>>
        // File operations
        revertFile: (projectPath: string, filePath: string) => Promise<void>
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
      }
      avatar: {
        select: () => Promise<string | null>
        save: (sourcePath: string, agentId: string) => Promise<string>
        delete: (agentId: string) => Promise<void>
        getPath: (fileName: string) => Promise<string>
        readAsBase64: (fileName: string) => Promise<string>
        readFileAsBase64: (filePath: string) => Promise<string>
      }
      codingAgent: {
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
      app: {
        platform: 'darwin' | 'win32' | 'linux'
        onOpenUrl: (callback: (url: string) => void) => () => void
        onMenuAction: (callback: (payload: { action: string; path?: string }) => void) => () => void
        setRecentProjects: (recent: { path: string; name: string }[]) => Promise<void>
      }
    }
  }
}
