import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
import { ChatService } from '../services/chat.service'
import { FileService } from '../services/file.service'
import { FileWatcherService } from '../services/file-watcher.service'
import { GitWatcherService } from '../services/git-watcher.service'
import { AvatarService } from '../services/avatar.service'
import { GitService } from '../services/git.service'
import { GitUtils } from '../services/git.utils'
import { TerminalService } from '../services/terminal.service'
import { WindowService } from '../services/window.service'
import { handleApprovalDecision } from '../tools/run-terminal-cmd.tool'
import { RecentFilesService } from '../services/recent-files.service'
import { BugReportService } from '../services/bug-report.service'
import { MessageSnapshotService } from '../services/message-snapshot.service'
import { MemoryService } from '../services/memory.service'
import { getConfigService, rebuildApplicationMenu } from '../index'
import { mainI18n, syncMainI18nFromConfig } from '../i18n'
import { getDb } from '../database/db'
import { sendToRenderer } from '../utils/ipc'
import * as fontList from 'font-list'
import * as fs from 'fs/promises'
import * as nodePath from 'path'
import * as iconv from 'iconv-lite'
import * as jschardet from 'jschardet'

// 存储活动的流式响应
const activeStreams = new Map<string, { abortController: AbortController; sessionId: string }>()

export function registerIpcHandlers(): void {
  // 获取全局配置服务实例
  const configService = getConfigService()

  // ChatService: streaming chat and tools
  const chatService = new ChatService(configService)

  // 创建 BugReportService 实例
  const bugReportService = new BugReportService()

  // 创建 MemoryService 实例
  const memoryService = new MemoryService()

  ipcMain.on('chat:stream', async (event, options) => {
    const streamId = options.streamId
    const abortController = new AbortController()

    if (streamId) {
      activeStreams.set(streamId, { abortController, sessionId: options.sessionId })
    }

    try {
      const stream = chatService.streamChat({
        sessionId: options.sessionId,
        message: options.message,
        workspaceRoot: options.workspaceRoot,
        abortSignal: abortController.signal,
        images: options.images
      })

      let finalSessionId = options.sessionId

      for await (const chunk of stream) {
        // 发送 chunk 到前端
        event.reply('chat:stream:chunk', chunk)

        // 如果是 session-id chunk，保存 sessionId
        if (chunk.type === 'session-id' && chunk.sessionId) {
          finalSessionId = chunk.sessionId
        }

        // interrupt: assistant waits for user decision; stream pauses until resume
        if (chunk.type === 'interrupt') {
          console.log('[IPC] ⏸️  Assistant interrupted, waiting for user decision')
          // 继续发送 chunk 到前端，但不结束流
        }
      }

      // 流完成，返回实际的 sessionId
      event.reply('chat:stream:end', finalSessionId)
    } catch (error) {
      console.error('Stream chat error:', error)

      // 特殊错误消息处理
      let errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (error instanceof Error && error.message.includes('tool_call_id')) {
        errorMessage = 'Chat state error, please create a new session'
      } else if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Chat stopped by user'
      }

      event.reply('chat:stream:error', errorMessage)
    } finally {
      if (streamId) {
        activeStreams.delete(streamId)
      }
    }
  })

  // 停止流式响应
  ipcMain.on('chat:stream:stop', async (_, streamId: string) => {
    const streamData = activeStreams.get(streamId)
    if (streamData) {
      console.log(`[IPC] ⏹️  Stopping stream: ${streamId}`)
      streamData.abortController.abort()

      // 立即清理数据库中的 pending tool-calls
      await chatService.cleanupPendingTools(streamData.sessionId)
    }
  })

  // HITL: Resume interrupt
  ipcMain.handle(
    'chat:resume-interrupt',
    async (
      _,
      params: {
        sessionId: string
        toolCallId: string
        decision: string
      }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const decision = params.decision === 'approved' ? 'approve' : 'reject'
        handleApprovalDecision(params.toolCallId, decision)
        return { success: true }
      } catch (error) {
        console.error('[IPC] Failed to resume interrupt:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  // Session handlers (使用 SessionService)
  const sessionService = chatService.getSessionService()

  ipcMain.handle('sessions:create', async (_, modelId: string, projectPath: string) => {
    try {
      return await sessionService.createSession(modelId, projectPath)
    } catch (error) {
      console.error('Failed to create session:', error)
      throw error
    }
  })

  ipcMain.handle('sessions:getByProject', async (_, projectPath: string) => {
    try {
      return await sessionService.getProjectSessions(projectPath)
    } catch (error) {
      console.error('Failed to get sessions:', error)
      throw error
    }
  })

  ipcMain.handle('sessions:getWithMessages', async (_, sessionId: string) => {
    try {
      return await sessionService.getSessionHistory(sessionId)
    } catch (error) {
      console.error('Failed to get session:', error)
      throw error
    }
  })

  ipcMain.handle('sessions:delete', async (_, sessionId: string) => {
    try {
      // 清理该会话的 pending edits
      chatService.onSessionDeleted(sessionId)
      await sessionService.deleteSession(sessionId)
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw error
    }
  })

  ipcMain.handle(
    'sessions:deleteMessagesAfter',
    async (_, sessionId: string, messageId: number) => {
      try {
        const deletedCount = await sessionService.deleteMessagesAfter(sessionId, messageId)
        return { success: true, deletedCount }
      } catch (error) {
        console.error('Failed to delete messages after:', error)
        throw error
      }
    }
  )

  ipcMain.handle('sessions:update', async (_, sessionId: string, updates: { title?: string }) => {
    try {
      await sessionService.updateSession(sessionId, updates)
    } catch (error) {
      console.error('Failed to update session:', error)
      throw error
    }
  })

  // Todo handlers
  ipcMain.handle('todo:get', async (_, sessionId: string) => {
    try {
      const session = await sessionService.getSession(sessionId)
      if (!session) {
        return []
      }
      return (session.metadata?.todos || []) as Array<{
        id: string
        content: string
        status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
        createdAt: number
        updatedAt: number
      }>
    } catch (error) {
      console.error('[TodoGet] Error:', error)
      return []
    }
  })

  // Config handlers
  ipcMain.handle('config:get', async () => {
    try {
      return configService.getConfig()
    } catch (error) {
      console.error('Failed to get config:', error)
      throw error
    }
  })

  ipcMain.handle('config:set', async (_, config) => {
    try {
      configService.setConfig(config)
      if (
        config &&
        typeof config === 'object' &&
        'language' in config &&
        config.language !== undefined
      ) {
        await syncMainI18nFromConfig(configService)
        rebuildApplicationMenu()
      }
    } catch (error) {
      console.error('Failed to set config:', error)
      throw error
    }
  })

  ipcMain.handle('config:getTheme', async () => {
    try {
      return configService.getTheme()
    } catch (error) {
      console.error('Failed to get theme:', error)
      throw error
    }
  })

  ipcMain.handle('config:setTheme', async (_, theme: 'light' | 'dark') => {
    try {
      configService.setTheme(theme)
    } catch (error) {
      console.error('Failed to set theme:', error)
      throw error
    }
  })

  ipcMain.handle('config:getPreferences', async () => {
    try {
      return configService.getPreferences()
    } catch (error) {
      console.error('Failed to get preferences:', error)
      throw error
    }
  })

  ipcMain.handle('config:setPreference', async (_, key: string, value: boolean): Promise<void> => {
    try {
      type PreferenceKey = Parameters<typeof configService.setPreference>[0]
      configService.setPreference(key as PreferenceKey, value)
    } catch (error) {
      console.error('Failed to set preference:', error)
      throw error
    }
  })

  // API Keys handlers
  ipcMain.handle('config:getApiKeys', async () => {
    try {
      return configService.getApiKeys()
    } catch (error) {
      console.error('Failed to get API keys:', error)
      throw error
    }
  })

  ipcMain.handle('config:getApiKey', async (_, provider: string) => {
    try {
      return configService.getApiKey(provider)
    } catch (error) {
      console.error('Failed to get API key:', error)
      throw error
    }
  })

  ipcMain.handle('config:setApiKey', async (_, provider: string, apiKey: string) => {
    try {
      configService.setApiKey(provider, apiKey)
      return { success: true }
    } catch (error) {
      console.error('Failed to set API key:', error)
      throw error
    }
  })

  ipcMain.handle('config:deleteApiKey', async (_, provider: string) => {
    try {
      configService.deleteApiKey(provider)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete API key:', error)
      throw error
    }
  })

  ipcMain.handle('config:setApiKeys', async (_, apiKeys: Record<string, string>) => {
    try {
      configService.setApiKeys(apiKeys)
      return { success: true }
    } catch (error) {
      console.error('Failed to set API keys:', error)
      throw error
    }
  })

  ipcMain.handle('config:getDefaultModel', async () => {
    try {
      return configService.getDefaultModel()
    } catch (error) {
      console.error('Failed to get default model:', error)
      throw error
    }
  })

  ipcMain.handle('config:setDefaultModel', async (_, modelId: string) => {
    try {
      configService.setDefaultModel(modelId)
      return { success: true }
    } catch (error) {
      console.error('Failed to set default model:', error)
      throw error
    }
  })

  ipcMain.handle('config:getServiceSettings', async () => {
    try {
      return configService.getServiceSettings()
    } catch (error) {
      console.error('Failed to get service settings:', error)
      throw error
    }
  })

  ipcMain.handle('config:setServiceSettings', async (_, settings: any) => {
    try {
      configService.setServiceSettings(settings)
      return { success: true }
    } catch (error) {
      console.error('Failed to set service settings:', error)
      throw error
    }
  })

  // UI State handlers
  ipcMain.handle('config:getUIState', async () => {
    try {
      return configService.getUIState()
    } catch (error) {
      console.error('Failed to get UI state:', error)
      throw error
    }
  })

  ipcMain.handle('config:setUIState', async (_, state) => {
    try {
      configService.setUIState(state)
    } catch (error) {
      console.error('Failed to set UI state:', error)
      throw error
    }
  })

  ipcMain.handle('config:updateUIState', async (_, updates) => {
    try {
      configService.updateUIState(updates)
    } catch (error) {
      console.error('Failed to update UI state:', error)
      throw error
    }
  })

  // Memory handlers
  ipcMain.handle('memory:getAll', async () => {
    try {
      return await memoryService.getAllMemories()
    } catch (error) {
      console.error('[MemoryGetAll] Error:', error)
      throw error
    }
  })

  ipcMain.handle('memory:create', async (_, content: string) => {
    try {
      const id = await memoryService.createMemory(content)
      return { success: true, id }
    } catch (error) {
      console.error('[MemoryCreate] Error:', error)
      throw error
    }
  })

  ipcMain.handle('memory:update', async (_, id: string, content: string) => {
    try {
      await memoryService.updateMemory(id, content)
      return { success: true }
    } catch (error) {
      console.error('[MemoryUpdate] Error:', error)
      throw error
    }
  })

  ipcMain.handle('memory:delete', async (_, id: string) => {
    try {
      await memoryService.deleteMemory(id)
      return { success: true }
    } catch (error) {
      console.error('[MemoryDelete] Error:', error)
      throw error
    }
  })

  // User Rule handlers
  ipcMain.handle('userRule:getAll', async () => {
    try {
      const db = getDb()
      return db.getUserRules().map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.getTime(),
        updatedAt: r.updatedAt.getTime()
      }))
    } catch (error) {
      console.error('[UserRuleGetAll] Error:', error)
      throw error
    }
  })

  ipcMain.handle('userRule:create', async (_, content: string) => {
    try {
      const db = getDb()
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      db.addUserRule(id, content)
      return { success: true, id }
    } catch (error) {
      console.error('[UserRuleCreate] Error:', error)
      throw error
    }
  })

  ipcMain.handle('userRule:update', async (_, id: string, content: string) => {
    try {
      const db = getDb()
      db.addUserRule(id, content)
      return { success: true }
    } catch (error) {
      console.error('[UserRuleUpdate] Error:', error)
      throw error
    }
  })

  ipcMain.handle('userRule:delete', async (_, id: string) => {
    try {
      const db = getDb()
      db.removeUserRule(id)
      return { success: true }
    } catch (error) {
      console.error('[UserRuleDelete] Error:', error)
      throw error
    }
  })

  // Layout State handlers
  ipcMain.handle('config:getLayoutState', async () => {
    try {
      return configService.getLayoutState()
    } catch (error) {
      console.error('Failed to get layout state:', error)
      throw error
    }
  })

  ipcMain.handle('config:setLayoutState', async (_, layout) => {
    try {
      configService.setLayoutState(layout)
    } catch (error) {
      console.error('Failed to set layout state:', error)
      throw error
    }
  })

  // File handlers
  ipcMain.handle('files:read', async (_, filePath: string) => {
    try {
      return await FileService.readFile(filePath)
    } catch (error) {
      console.error('Failed to read file:', error)
      throw error
    }
  })

  ipcMain.handle('files:readWithEncoding', async (_, filePath: string, encoding: string) => {
    try {
      const buffer = await fs.readFile(filePath)
      return iconv.decode(buffer, encoding)
    } catch (error) {
      console.error('Failed to read file with encoding:', error)
      throw error
    }
  })

  ipcMain.handle('files:detectEncoding', async (_, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath)

      // 1. BOM 检测（最高优先级）
      if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return 'UTF-8 with BOM'
      }
      if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return 'UTF-16 LE'
      }
      if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
        return 'UTF-16 BE'
      }

      // 2. jschardet 检测（需置信度 > 0.7）
      const detected = jschardet.detect(buffer)

      if (detected && detected.encoding && detected.confidence > 0.7) {
        // 映射常见编码（jschardet 返回的名称 → iconv-lite 支持的名称）
        const encodingMap: Record<string, string> = {
          'UTF-8': 'UTF-8',
          GB2312: 'GB2312',
          GBK: 'GBK',
          Big5: 'Big5',
          'ISO-8859-1': 'ISO-8859-1',
          'windows-1252': 'windows-1252',
          Shift_JIS: 'Shift_JIS',
          'EUC-JP': 'EUC-JP',
          'EUC-KR': 'EUC-KR'
        }
        return encodingMap[detected.encoding] || 'UTF-8'
      }

      // 3. 默认 UTF-8（置信度低或未检测到）
      return 'UTF-8'
    } catch (error) {
      console.error('Failed to detect encoding:', error)
      return 'UTF-8'
    }
  })

  ipcMain.handle('files:readBinary', async (_, filePath: string) => {
    try {
      const buffer = await FileService.readBinaryFile(filePath)
      // 将 Buffer 转换为 Uint8Array 以便在渲染进程中使用
      return new Uint8Array(buffer)
    } catch (error) {
      console.error('Failed to read binary file:', error)
      throw error
    }
  })

  ipcMain.handle('files:write', async (_, filePath: string, content: string) => {
    try {
      await FileService.writeFile(filePath, content)
    } catch (error) {
      console.error('Failed to write file:', error)
      throw error
    }
  })

  ipcMain.handle(
    'files:writeWithEncoding',
    async (_, filePath: string, content: string, encoding: string) => {
      try {
        const buffer = iconv.encode(content, encoding)
        await fs.writeFile(filePath, buffer)
      } catch (error) {
        console.error('Failed to write file with encoding:', error)
        throw error
      }
    }
  )

  ipcMain.handle('files:listDirectory', async (_, dirPath: string) => {
    try {
      // 获取用户配置的文件排除规则（VSCode 风格）
      const filesExclude = configService.getFilesExclude()
      return await FileService.listDirectory(dirPath, filesExclude)
    } catch (error) {
      console.error('Failed to list directory:', error)
      throw error
    }
  })

  ipcMain.handle('files:createFile', async (_, filePath: string, content: string) => {
    try {
      await FileService.createFile(filePath, content)
    } catch (error) {
      console.error('Failed to create file:', error)
      throw error
    }
  })

  ipcMain.handle('files:createDirectory', async (_, dirPath: string) => {
    try {
      await FileService.createDirectory(dirPath)
    } catch (error) {
      console.error('Failed to create directory:', error)
      throw error
    }
  })

  ipcMain.handle('files:delete', async (_, targetPath: string) => {
    try {
      await FileService.delete(targetPath)
    } catch (error) {
      console.error('Failed to delete:', error)
      throw error
    }
  })

  ipcMain.handle('files:rename', async (_, oldPath: string, newPath: string) => {
    try {
      await FileService.rename(oldPath, newPath)
    } catch (error) {
      console.error('Failed to rename:', error)
      throw error
    }
  })

  ipcMain.handle('files:exists', async (_, targetPath: string) => {
    try {
      return await FileService.exists(targetPath)
    } catch (error) {
      console.error('Failed to check existence:', error)
      throw error
    }
  })

  ipcMain.handle('files:getInfo', async (_, filePath: string) => {
    try {
      return await FileService.getFileInfo(filePath)
    } catch (error) {
      console.error('Failed to get file info:', error)
      throw error
    }
  })

  ipcMain.handle('files:revealInFinder', async (_, filePath: string) => {
    try {
      await FileService.revealInFinder(filePath)
    } catch (error) {
      console.error('Failed to reveal in finder:', error)
      throw error
    }
  })

  // Project handlers
  ipcMain.handle('project:openDialog', async (event) => {
    try {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: mainI18n.t('dialog.select_project_folder.title'),
        buttonLabel: mainI18n.t('dialog.select_project_folder.confirm')
      })

      const projectPath = result.canceled ? null : result.filePaths[0]
      if (projectPath) {
        const recentProjects = configService.getRecentProjects()
        const filtered = recentProjects.filter((p) => p.path !== projectPath)
        const projectName = nodePath.basename(projectPath)
        filtered.unshift({
          path: projectPath,
          name: projectName,
          lastOpened: Date.now().toString()
        })
        const limited = filtered.slice(0, 10)
        configService.setConfig({ recentProjects: limited })

        // 开始监听文件变化
        const window = BrowserWindow.fromWebContents(event.sender)
        if (window) {
          FileWatcherService.startWatching(projectPath, window)
          // ⭐ 同时启动Git监听器
          GitWatcherService.startWatching(projectPath)
        }
      }
      return projectPath
    } catch (error) {
      console.error('Failed to open project:', error)
      throw error
    }
  })

  ipcMain.handle('project:getRecent', async () => {
    try {
      return configService.getRecentProjects()
    } catch (error) {
      console.error('Failed to get recent projects:', error)
      throw error
    }
  })

  ipcMain.handle('project:getCurrent', async () => {
    try {
      return configService.getCurrentProject()
    } catch (error) {
      console.error('Failed to get current project:', error)
      throw error
    }
  })

  ipcMain.handle('project:setCurrent', async (event, projectPath: string | null) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)

      // 停止之前的监听
      const currentProject = configService.getCurrentProject()
      if (currentProject) {
        await FileWatcherService.stopWatching(currentProject)
        GitWatcherService.stopWatching(currentProject) // ⭐ 同时停止Git监听器
      }

      // 设置新项目
      configService.setCurrentProject(projectPath)

      // 如果有新项目，开始监听并添加到最近项目
      if (projectPath && window) {
        const recentProjects = configService.getRecentProjects()
        const filtered = recentProjects.filter((p) => p.path !== projectPath)
        const projectName = nodePath.basename(projectPath)
        filtered.unshift({
          path: projectPath,
          name: projectName,
          lastOpened: Date.now().toString()
        })
        const limited = filtered.slice(0, 10)
        configService.setConfig({ recentProjects: limited })
        FileWatcherService.startWatching(projectPath, window)
        // ⭐ 同时启动Git监听器
        GitWatcherService.startWatching(projectPath)
      }
    } catch (error) {
      console.error('Failed to set current project:', error)
      throw error
    }
  })

  ipcMain.handle('project:close', async () => {
    try {
      const currentProject = configService.getCurrentProject()
      if (currentProject) {
        await FileWatcherService.stopWatching(currentProject)
        GitWatcherService.stopWatching(currentProject) // ⭐ 同时停止Git监听器
      }
      configService.setCurrentProject(null)
    } catch (error) {
      console.error('Failed to close project:', error)
      throw error
    }
  })

  // 在新窗口打开项目
  ipcMain.handle('project:openInNewWindow', async (_event, projectPath: string) => {
    try {
      console.log('🪟 Opening project in new window:', projectPath)

      // 创建新窗口并传递项目路径
      const newWindow = WindowService.createWindow(projectPath, configService)

      // 等待窗口加载完成后设置项目
      newWindow.webContents.once('did-finish-load', async () => {
        // 通过 IPC 告诉新窗口要打开的项目
        newWindow.webContents.send('window:open-project', { projectPath })
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to open project in new window:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : mainI18n.t('errors.unknown_error')
      }
    }
  })

  // Git handlers

  ipcMain.handle('git:extractRepoName', async (_, url: string) => {
    try {
      return GitUtils.extractRepoName(url)
    } catch (error) {
      console.error('Failed to extract repo name:', error)
      throw error
    }
  })

  ipcMain.handle('git:selectTargetDirectory', async () => {
    try {
      return await GitUtils.selectTargetDirectory()
    } catch (error) {
      console.error('Failed to select target directory:', error)
      throw error
    }
  })

  ipcMain.handle('git:cloneRepository', async (event, repoUrl: string, targetPath: string) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)

      const clonedPath = await GitService.cloneRepository(repoUrl, targetPath, (message) => {
        sendToRenderer('git:cloneProgress', { message })
      })

      // 克隆成功后，设置为当前项目
      if (window) {
        const recentProjects = configService.getRecentProjects()
        const filtered = recentProjects.filter((p) => p.path !== clonedPath)
        const projectName = require('path').basename(clonedPath)
        filtered.unshift({
          path: clonedPath,
          name: projectName,
          lastOpened: Date.now().toString()
        })
        const limited = filtered.slice(0, 10)
        configService.setConfig({ recentProjects: limited })
        configService.setCurrentProject(clonedPath)
        FileWatcherService.startWatching(clonedPath, window)
        // ⭐ 同时启动Git监听器
        GitWatcherService.startWatching(clonedPath)
      }

      return clonedPath
    } catch (error) {
      console.error('Failed to clone repository:', error)
      throw error
    }
  })

  ipcMain.handle('git:createNewProject', async (event, parentPath: string, projectName: string) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)

      const projectPath = await GitUtils.createNewProject(parentPath, projectName)

      // 创建成功后，设置为当前项目
      if (window) {
        const recentProjects = configService.getRecentProjects()
        const filtered = recentProjects.filter((p) => p.path !== projectPath)
        const projectName = nodePath.basename(projectPath)
        filtered.unshift({
          path: projectPath,
          name: projectName,
          lastOpened: Date.now().toString()
        })
        const limited = filtered.slice(0, 10)
        configService.setConfig({ recentProjects: limited })
        configService.setCurrentProject(projectPath)
        FileWatcherService.startWatching(projectPath, window)
        // ⭐ 同时启动Git监听器
        GitWatcherService.startWatching(projectPath)
      }

      return projectPath
    } catch (error) {
      console.error('Failed to create new project:', error)
      throw error
    }
  })

  ipcMain.handle('git:isRepository', async (_, projectPath: string) => {
    try {
      return await GitService.isGitRepository(projectPath)
    } catch (error) {
      console.error('Failed to check if repository:', error)
      return false
    }
  })

  ipcMain.handle('git:initRepository', async (_, projectPath: string) => {
    try {
      await GitService.initRepository(projectPath)
    } catch (error) {
      console.error('Failed to initialize repository:', error)
      throw error
    }
  })

  ipcMain.handle('git:getCurrentBranch', async (_, projectPath: string) => {
    try {
      return await GitService.getCurrentBranch(projectPath)
    } catch (error) {
      console.error('Failed to get current branch:', error)
      throw error
    }
  })

  ipcMain.handle('git:getAllBranches', async (_, projectPath: string) => {
    try {
      return await GitService.getAllBranches(projectPath)
    } catch (error) {
      console.error('Failed to get all branches:', error)
      throw error
    }
  })

  ipcMain.handle('git:checkoutBranch', async (_, projectPath: string, branchName: string) => {
    try {
      await GitService.checkoutBranch(projectPath, branchName)
    } catch (error) {
      console.error('Failed to checkout branch:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:createBranch',
    async (_, projectPath: string, branchName: string, checkout: boolean, startPoint?: string) => {
      try {
        await GitService.createBranch(projectPath, branchName, checkout, startPoint)
      } catch (error) {
        console.error('Failed to create branch:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:getBranchCommit', async (_, projectPath: string, branchName: string) => {
    return await GitService.getBranchCommit(projectPath, branchName)
  })

  ipcMain.handle(
    'git:deleteBranch',
    async (_, projectPath: string, branchName: string, force: boolean) => {
      try {
        await GitService.deleteBranch(projectPath, branchName, force)
      } catch (error) {
        console.error('Failed to delete branch:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'git:deleteRemoteBranch',
    async (_, projectPath: string, remoteName: string, branchName: string) => {
      try {
        await GitService.deleteRemoteBranch(projectPath, remoteName, branchName)
      } catch (error) {
        console.error('Failed to delete remote branch:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:getTrackingBranch', async (_, projectPath: string, branchName: string) => {
    try {
      return await GitService.getTrackingBranch(projectPath, branchName)
    } catch (error) {
      console.error('Failed to get tracking branch:', error)
      return null
    }
  })

  ipcMain.handle('git:unsetUpstream', async (_, projectPath: string, branchName: string) => {
    try {
      await GitService.unsetUpstream(projectPath, branchName)
    } catch (error) {
      console.error('Failed to unset upstream:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:renameBranch',
    async (_, projectPath: string, oldName: string, newName: string) => {
      try {
        await GitService.renameBranch(projectPath, oldName, newName)
      } catch (error) {
        console.error('Failed to rename branch:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:mergeBranch', async (_, projectPath: string, branchName: string) => {
    try {
      return await GitService.mergeBranch(projectPath, branchName)
    } catch (error) {
      console.error('Failed to merge branch:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:compareBranches',
    async (_, projectPath: string, baseBranch: string, compareBranch: string) => {
      try {
        return await GitService.compareBranches(projectPath, baseBranch, compareBranch)
      } catch (error) {
        console.error('Failed to compare branches:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'git:getBranchFileDiff',
    async (_, projectPath: string, baseBranch: string, compareBranch: string, filePath: string) => {
      try {
        return await GitService.getBranchFileDiff(projectPath, baseBranch, compareBranch, filePath)
      } catch (error) {
        console.error('Failed to get branch file diff:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:getStatus', async (_, projectPath: string) => {
    try {
      return await GitService.getStatus(projectPath)
    } catch (error) {
      console.error('Failed to get git status:', error)
      throw error
    }
  })

  ipcMain.handle('git:stageFiles', async (_, projectPath: string, files: string[]) => {
    try {
      await GitService.stageFiles(projectPath, files)
    } catch (error) {
      console.error('Failed to stage files:', error)
      throw error
    }
  })

  ipcMain.handle('git:unstageFiles', async (_, projectPath: string, files: string[]) => {
    try {
      await GitService.unstageFiles(projectPath, files)
    } catch (error) {
      console.error('Failed to unstage files:', error)
      throw error
    }
  })

  ipcMain.handle('git:getDiff', async (_, projectPath: string, filePath: string) => {
    try {
      return await GitService.getDiff(projectPath, filePath)
    } catch (error) {
      console.error('Failed to get diff:', error)
      throw error
    }
  })

  ipcMain.handle('git:commit', async (_, projectPath: string, message: string) => {
    try {
      await GitService.commit(projectPath, message)
    } catch (error) {
      console.error('Failed to commit:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:push',
    async (_, projectPath: string, remote: string, branch?: string, setUpstream?: boolean) => {
      try {
        await GitService.push(projectPath, remote, branch, setUpstream)
      } catch (error) {
        console.error('Failed to push:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'git:pushToRef',
    async (_, projectPath: string, remote: string, refspec: string, setUpstream?: boolean) => {
      try {
        await GitService.pushToRef(projectPath, remote, refspec, setUpstream)
      } catch (error) {
        console.error('Failed to push to ref:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:pull', async (_, projectPath: string, remote: string, branch?: string) => {
    try {
      return await GitService.pull(projectPath, remote, branch)
    } catch (error) {
      console.error('Failed to pull:', error)
      throw error
    }
  })

  ipcMain.handle('git:fetch', async (_, projectPath: string, remote: string) => {
    try {
      await GitService.fetch(projectPath, remote)
    } catch (error) {
      console.error('Failed to fetch:', error)
      throw error
    }
  })

  ipcMain.handle('git:discardFileChanges', async (_, projectPath: string, filePath: string) => {
    try {
      await GitService.discardFileChanges(projectPath, filePath)
    } catch (error) {
      console.error('Failed to discard file changes:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:getFileHistory',
    async (_, projectPath: string, filePath: string, limit?: number) => {
      try {
        return await GitService.getFileHistory(projectPath, filePath, limit)
      } catch (error) {
        console.error('Failed to get file history:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'git:compareWithBranch',
    async (_, projectPath: string, filePath: string, branch: string) => {
      try {
        return await GitService.compareWithBranch(projectPath, filePath, branch)
      } catch (error) {
        console.error('Failed to compare with branch:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:getWorkingDiff', async (_, projectPath: string, filePath: string) => {
    try {
      return await GitService.getWorkingDiff(projectPath, filePath)
    } catch (error) {
      console.error('Failed to get working diff:', error)
      throw error
    }
  })

  ipcMain.handle('git:getBlame', async (_, projectPath: string, filePath: string) => {
    try {
      return await GitService.getBlame(projectPath, filePath)
    } catch (error) {
      console.error('Failed to get blame:', error)
      throw error
    }
  })

  ipcMain.handle('git:getFileFromHead', async (_, projectPath: string, filePath: string) => {
    try {
      return await GitService.getFileFromHead(projectPath, filePath)
    } catch (error) {
      console.error('Failed to get file from HEAD:', error)
      throw error
    }
  })

  ipcMain.handle('git:getRemotes', async (_, projectPath: string) => {
    try {
      return await GitService.getRemotes(projectPath)
    } catch (error) {
      console.error('Failed to get remotes:', error)
      throw error
    }
  })

  ipcMain.handle('git:addRemote', async (_, projectPath: string, name: string, url: string) => {
    try {
      await GitService.addRemote(projectPath, name, url)
    } catch (error) {
      console.error('Failed to add remote:', error)
      throw error
    }
  })

  // Git Stash handlers
  ipcMain.handle(
    'git:stash',
    async (_, projectPath: string, message?: string, includeUntracked?: boolean) => {
      try {
        await GitService.stash(projectPath, message, includeUntracked)
      } catch (error) {
        console.error('Failed to stash:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:stashList', async (_, projectPath: string) => {
    try {
      return await GitService.stashList(projectPath)
    } catch (error) {
      console.error('Failed to list stashes:', error)
      throw error
    }
  })

  ipcMain.handle('git:stashApply', async (_, projectPath: string, index: number) => {
    try {
      await GitService.stashApply(projectPath, index)
    } catch (error) {
      console.error('Failed to apply stash:', error)
      throw error
    }
  })

  ipcMain.handle('git:stashPop', async (_, projectPath: string, index: number) => {
    try {
      await GitService.stashPop(projectPath, index)
    } catch (error) {
      console.error('Failed to pop stash:', error)
      throw error
    }
  })

  ipcMain.handle('git:stashDrop', async (_, projectPath: string, index: number) => {
    try {
      await GitService.stashDrop(projectPath, index)
    } catch (error) {
      console.error('Failed to drop stash:', error)
      throw error
    }
  })

  ipcMain.handle('git:stashClear', async (_, projectPath: string) => {
    try {
      await GitService.stashClear(projectPath)
    } catch (error) {
      console.error('Failed to clear stashes:', error)
      throw error
    }
  })

  ipcMain.handle('git:stashShowFiles', async (_, projectPath: string, index: number) => {
    try {
      return await GitService.stashShowFiles(projectPath, index)
    } catch (error) {
      console.error('Failed to show stash files:', error)
      throw error
    }
  })

  ipcMain.handle('git:stashShowDiff', async (_, projectPath: string, index: number) => {
    try {
      return await GitService.stashShowDiff(projectPath, index)
    } catch (error) {
      console.error('Failed to show stash diff:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:stashGetFileContent',
    async (_, projectPath: string, index: number, filePath: string) => {
      try {
        return await GitService.stashGetFileContent(projectPath, index, filePath)
      } catch (error) {
        console.error('Failed to get stash file content:', error)
        throw error
      }
    }
  )

  // Git History handlers
  ipcMain.handle(
    'git:getCommitHistory',
    async (
      _,
      projectPath: string,
      options?: {
        limit?: number
        skip?: number
        branch?: string
        author?: string
        search?: string
      }
    ) => {
      try {
        return await GitService.getCommitHistory(projectPath, options)
      } catch (error) {
        console.error('Failed to get commit history:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:getCommitDetail', async (_, projectPath: string, commitHash: string) => {
    try {
      return await GitService.getCommitDetail(projectPath, commitHash)
    } catch (error) {
      console.error('Failed to get commit detail:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:getCommitFileDiff',
    async (_, projectPath: string, commitHash: string, filePath: string) => {
      try {
        return await GitService.getCommitFileDiff(projectPath, commitHash, filePath)
      } catch (error) {
        console.error('Failed to get commit file diff:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:amendCommit', async (_, projectPath: string, message?: string) => {
    try {
      await GitService.amendCommit(projectPath, message)
    } catch (error) {
      console.error('Failed to amend commit:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:resetToCommit',
    async (_, projectPath: string, commitHash: string, mode?: 'soft' | 'mixed' | 'hard') => {
      try {
        await GitService.resetToCommit(projectPath, commitHash, mode)
      } catch (error) {
        console.error('Failed to reset to commit:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:revertCommit', async (_, projectPath: string, commitHash: string) => {
    try {
      await GitService.revertCommit(projectPath, commitHash)
    } catch (error) {
      console.error('Failed to revert commit:', error)
      throw error
    }
  })

  ipcMain.handle('git:getAuthors', async (_, projectPath: string) => {
    try {
      return await GitService.getAuthors(projectPath)
    } catch (error) {
      console.error('Failed to get authors:', error)
      throw error
    }
  })

  ipcMain.handle('git:getLastCommitInfo', async (_, projectPath: string) => {
    try {
      return await GitService.getLastCommitInfo(projectPath)
    } catch (error) {
      console.error('Failed to get last commit info:', error)
      throw error
    }
  })

  ipcMain.handle('git:getConflictVersions', async (_, projectPath: string, filePath: string) => {
    try {
      return await GitService.getConflictVersions(projectPath, filePath)
    } catch (error) {
      console.error('Failed to get conflict versions:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:resolveConflict',
    async (_, projectPath: string, filePath: string, resolvedContent: string) => {
      try {
        await GitService.resolveConflict(projectPath, filePath, resolvedContent)
      } catch (error) {
        console.error('Failed to resolve conflict:', error)
        throw error
      }
    }
  )

  ipcMain.handle('git:abortMerge', async (_, projectPath: string) => {
    try {
      await GitService.abortMerge(projectPath)
    } catch (error) {
      console.error('Failed to abort merge:', error)
      throw error
    }
  })

  ipcMain.handle('git:acceptAllOurs', async (_, projectPath: string, conflictedFiles: string[]) => {
    try {
      await GitService.acceptAllOurs(projectPath, conflictedFiles)
    } catch (error) {
      console.error('Failed to accept all ours:', error)
      throw error
    }
  })

  ipcMain.handle(
    'git:acceptAllTheirs',
    async (_, projectPath: string, conflictedFiles: string[]) => {
      try {
        await GitService.acceptAllTheirs(projectPath, conflictedFiles)
      } catch (error) {
        console.error('Failed to accept all theirs:', error)
        throw error
      }
    }
  )

  // Tag handlers
  ipcMain.handle('git:listTags', async (_, projectPath: string) => {
    return GitService.listTags(projectPath)
  })

  ipcMain.handle(
    'git:createTag',
    async (
      _,
      projectPath: string,
      tagName: string,
      options?: { message?: string; commitHash?: string }
    ) => {
      await GitService.createTag(projectPath, tagName, options)
    }
  )

  ipcMain.handle('git:deleteTag', async (_, projectPath: string, tagName: string) => {
    await GitService.deleteTag(projectPath, tagName)
  })

  ipcMain.handle(
    'git:pushTag',
    async (_, projectPath: string, tagName: string, remote?: string) => {
      await GitService.pushTag(projectPath, tagName, remote)
    }
  )

  ipcMain.handle(
    'git:deleteRemoteTag',
    async (_, projectPath: string, tagName: string, remote?: string) => {
      await GitService.deleteRemoteTag(projectPath, tagName, remote)
    }
  )

  // Rebase handler
  ipcMain.handle('git:rebase', async (_, projectPath: string, onto: string) => {
    return GitService.rebase(projectPath, onto)
  })

  // Squash handler
  ipcMain.handle(
    'git:squashCommits',
    async (_, projectPath: string, count: number, message: string) => {
      await GitService.squashCommits(projectPath, count, message)
    }
  )

  // Avatar handlers
  ipcMain.handle('avatar:select', async () => {
    try {
      return await AvatarService.selectAvatarFile()
    } catch (error) {
      console.error('Failed to select avatar:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:save', async (_, sourcePath: string, ownerId: string) => {
    try {
      return await AvatarService.saveAvatar(sourcePath, ownerId)
    } catch (error) {
      console.error('Failed to save avatar:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:delete', async (_, ownerId: string) => {
    try {
      await AvatarService.deleteAvatarsForOwner(ownerId)
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:getPath', async (_, fileName: string) => {
    try {
      return AvatarService.getAvatarPath(fileName)
    } catch (error) {
      console.error('Failed to get avatar path:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:readAsBase64', async (_, fileName: string) => {
    try {
      return await AvatarService.readAvatarAsBase64(fileName)
    } catch (error) {
      console.error('Failed to read avatar:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:readFileAsBase64', async (_, filePath: string) => {
    try {
      return await AvatarService.readFileAsBase64(filePath)
    } catch (error) {
      console.error('Failed to read file as base64:', error)
      throw error
    }
  })

  // Debug handler - 用于调试配置
  ipcMain.handle('config:debug', async () => {
    try {
      const config = configService.getConfig()
      const dbPath = configService.getDatabasePath()
      console.log('🔍 Debug Config Info:')
      console.log('   Database:', dbPath)
      console.log('   Current Project:', config.currentProject)
      console.log('   Recent Projects:', config.recentProjects)
      return {
        path: dbPath,
        config
      }
    } catch (error) {
      console.error('Failed to debug config:', error)
      throw error
    }
  })

  // AI project bootstrap (welcome flow)
  ipcMain.handle('project-create:selectProjectFolder', async (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) throw new Error('No active window')

      const result = await dialog.showOpenDialog(window, {
        title: mainI18n.t('dialog.create_project_folder.title'),
        message: mainI18n.t('dialog.create_project_folder.message'),
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: mainI18n.t('dialog.create_project_folder.confirm')
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true }
      }

      return { canceled: false, path: result.filePaths[0] }
    } catch (error) {
      console.error('Failed to select project folder:', error)
      throw error
    }
  })

  ipcMain.handle(
    'project-create:createProject',
    async (event, userPrompt: string, projectPath: string) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender)

        // 创建新的 session，使用默认模型
        const defaultModelId = 'Alibaba (China)/qwen-plus'
        const sessionId = await sessionService.createSession(defaultModelId, projectPath)

        const stream = chatService.streamChat({
          sessionId,
          message: userPrompt,
          workspaceRoot: projectPath
        })

        for await (const chunk of stream) {
          if (chunk.type === 'text') {
            sendToRenderer('project-create:stream:chunk', { content: chunk.content })
          }
        }

        // 项目创建完成后的处理
        const recentProjects = configService.getRecentProjects()
        const filtered = recentProjects.filter((p) => p.path !== projectPath)
        const projectName = nodePath.basename(projectPath)
        filtered.unshift({
          path: projectPath,
          name: projectName,
          lastOpened: Date.now().toString()
        })
        const limited = filtered.slice(0, 10)
        configService.setConfig({ recentProjects: limited })
        configService.setCurrentProject(projectPath)

        if (window) {
          FileWatcherService.startWatching(projectPath, window)
          // ⭐ 同时启动Git监听器
          GitWatcherService.startWatching(projectPath)
        }

        return {
          success: true,
          sessionId,
          projectPath
        }
      } catch (error) {
        console.error('Failed to create project with AI:', error)
        throw error
      }
    }
  )

  // Terminal handlers
  ipcMain.handle('terminal:create', async (_, cwd: string) => {
    try {
      const terminalId = TerminalService.createTerminal(cwd)
      return terminalId
    } catch (error) {
      console.error('Failed to create terminal:', error)
      throw error
    }
  })

  ipcMain.handle('terminal:write', async (_, terminalId: string, data: string) => {
    try {
      TerminalService.write(terminalId, data)
    } catch (error) {
      console.error('Failed to write to terminal:', error)
      throw error
    }
  })

  ipcMain.handle('terminal:resize', async (_, terminalId: string, cols: number, rows: number) => {
    try {
      TerminalService.resize(terminalId, cols, rows)
    } catch (error) {
      console.error('Failed to resize terminal:', error)
      throw error
    }
  })

  ipcMain.handle('terminal:kill', async (_, terminalId: string) => {
    try {
      TerminalService.kill(terminalId)
    } catch (error) {
      console.error('Failed to kill terminal:', error)
      throw error
    }
  })

  // System handlers - 获取系统字体列表
  ipcMain.handle('system:getFonts', async () => {
    try {
      const fonts = await fontList.getFonts({ disableQuoting: true })
      // 过滤和排序字体列表
      const uniqueFonts = Array.from(new Set(fonts))
        .filter((font) => {
          // 过滤掉一些系统字体或特殊字体
          const name = font.toLowerCase()
          return (
            !name.startsWith('.') &&
            !name.includes('icon') &&
            !name.includes('emoji') &&
            !name.includes('symbol')
          )
        })
        .sort()

      return uniqueFonts
    } catch (error) {
      console.error('Failed to get system fonts:', error)
      // 如果获取失败，返回一些常见的备用字体
      return [
        'Monaco',
        'Menlo',
        'Consolas',
        'Courier New',
        'monospace',
        'SF Mono',
        'JetBrains Mono',
        'Fira Code',
        'Source Code Pro',
        'Ubuntu Mono'
      ]
    }
  })

  // Codebase Index handlers
  ipcMain.handle('codebase:index', async (event, projectPath: string) => {
    try {
      const { CodebaseIndexService } = await import('../services/codebase-index.service')
      const indexService = CodebaseIndexService.getInstance()

      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) throw new Error('No active window')

      const index = await indexService.indexProject(projectPath, (progress, total, message) => {
        sendToRenderer('codebase:index:progress', {
          current: progress,
          total,
          file: message,
          progress: Math.round(progress)
        })
      })

      return {
        success: true,
        totalFiles: index.totalFiles,
        totalChunks: index.totalChunks,
        totalSize: index.totalSize,
        indexedAt: index.indexedAt,
        // 增量统计信息
        newFiles: index.newFiles,
        modifiedFiles: index.modifiedFiles,
        deletedFiles: index.deletedFiles,
        unchangedFiles: index.unchangedFiles
      }
    } catch (error) {
      console.error('Failed to index codebase:', error)
      throw error
    }
  })

  ipcMain.handle(
    'codebase:search',
    async (_, projectPath: string, query: string, options?: any) => {
      try {
        const { CodebaseIndexService } = await import('../services/codebase-index.service')
        const indexService = CodebaseIndexService.getInstance()

        const results = await indexService.search(projectPath, query, options)
        return results
      } catch (error) {
        console.error('Failed to search codebase:', error)
        throw error
      }
    }
  )

  ipcMain.handle('codebase:getIndex', async (_, projectPath: string) => {
    try {
      const { CodebaseIndexService } = await import('../services/codebase-index.service')
      const indexService = CodebaseIndexService.getInstance()

      const index = await indexService.getProjectIndex(projectPath)

      if (!index) {
        return null
      }

      return {
        projectName: index.projectName,
        totalFiles: index.totalFiles,
        totalChunks: index.totalChunks,
        totalSize: index.totalSize,
        indexedAt: index.indexedAt
      }
    } catch (error) {
      console.error('Failed to get index:', error)
      return null
    }
  })

  ipcMain.handle('codebase:deleteIndex', async (_, projectPath: string) => {
    try {
      const { CodebaseIndexService } = await import('../services/codebase-index.service')
      const indexService = CodebaseIndexService.getInstance()

      await indexService.deleteProject(projectPath)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete index:', error)
      throw error
    }
  })

  // Diagnostics handlers
  ipcMain.handle('diagnostics:get', async (_, filePath: string, content?: string) => {
    try {
      const { DiagnosticsService } = await import('../services/diagnostics.service')
      const diagnosticsService = DiagnosticsService.getInstance()

      const diagnostics = await diagnosticsService.getDiagnostics(filePath, content)
      return diagnostics
    } catch (error) {
      console.error('Failed to get diagnostics:', error)
      return []
    }
  })

  ipcMain.handle('diagnostics:clear', async (_, filePath?: string) => {
    try {
      const { DiagnosticsService } = await import('../services/diagnostics.service')
      const diagnosticsService = DiagnosticsService.getInstance()

      diagnosticsService.clearCache(filePath)
    } catch (error) {
      console.error('Failed to clear diagnostics cache:', error)
    }
  })

  // Language Service handlers
  ipcMain.handle(
    'languageService:updateFile',
    async (_, projectRoot: string, fileName: string, content: string) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        service.updateFile(fileName, content)
      } catch (error) {
        console.error('Failed to update file in language service:', error)
      }
    }
  )

  ipcMain.handle(
    'languageService:getQuickInfo',
    async (_, projectRoot: string, fileName: string, position: number) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.getQuickInfoAtPosition(fileName, position)
      } catch (error) {
        console.error('Failed to get quick info:', error)
        return null
      }
    }
  )

  ipcMain.handle(
    'languageService:getDefinition',
    async (_, projectRoot: string, fileName: string, position: number) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.getDefinitionAtPosition(fileName, position)
      } catch (error) {
        console.error('Failed to get definition:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'languageService:getReferences',
    async (_, projectRoot: string, fileName: string, position: number) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.getReferencesAtPosition(fileName, position)
      } catch (error) {
        console.error('Failed to get references:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'languageService:getRenameLocations',
    async (_, projectRoot: string, fileName: string, position: number) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.getRenameLocations(fileName, position)
      } catch (error) {
        console.error('Failed to get rename locations:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'languageService:getCompletions',
    async (_, projectRoot: string, fileName: string, position: number) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.getCompletionsAtPosition(fileName, position)
      } catch (error) {
        console.error('Failed to get completions:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'languageService:getSignatureHelp',
    async (_, projectRoot: string, fileName: string, position: number) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.getSignatureHelpAtPosition(fileName, position)
      } catch (error) {
        console.error('Failed to get signature help:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'languageService:formatDocument',
    async (_, projectRoot: string, fileName: string) => {
      try {
        const { LanguageService } = await import('../services/language-service')
        const service = await LanguageService.getInstance(projectRoot)
        return service.formatDocument(fileName)
      } catch (error) {
        console.error('Failed to format document:', error)
        return []
      }
    }
  )

  // Search handlers - 纯 Node.js 实现，零外部依赖
  const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    '.next',
    'build',
    'coverage',
    '.cache'
  ])
  const IGNORE_EXTS = new Set([
    '.lock',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot'
  ])

  async function* walkFiles(dir: string): AsyncGenerator<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue
      const fullPath = nodePath.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) yield* walkFiles(fullPath)
      } else if (entry.isFile()) {
        if (!IGNORE_EXTS.has(nodePath.extname(entry.name).toLowerCase())) yield fullPath
      }
    }
  }

  // 简单的 glob 匹配（支持 *.ext 和 **/path 模式）
  const matchesGlob = (relativePath: string, pattern: string): boolean => {
    const p = pattern.trim()
    if (!p) return true
    if (p.startsWith('*.')) {
      // *.ts → 以 .ts 结尾
      return relativePath.endsWith(p.slice(1))
    }
    if (p.includes('**')) {
      // src/** → 路径包含 src/
      const prefix = p.replace('**', '').replace(/\/$/, '')
      return relativePath.includes(prefix)
    }
    // 普通匹配
    return relativePath.includes(p)
  }

  ipcMain.handle('search:find', async (_, projectPath: string, query: string, options?: any) => {
    if (!query?.trim()) return []

    const { caseSensitive, wholeWord, useRegex, includePattern, excludePattern } = options || {}

    // 解析 include/exclude 模式
    const includes =
      includePattern
        ?.split(',')
        .map((p: string) => p.trim())
        .filter(Boolean) || []
    const excludes =
      excludePattern
        ?.split(',')
        .map((p: string) => p.trim())
        .filter(Boolean) || []

    // 构建正则
    let pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (wholeWord) pattern = `\\b${pattern}\\b`
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')

    const results: any[] = []

    try {
      for await (const filePath of walkFiles(projectPath)) {
        const relativePath = nodePath.relative(projectPath, filePath)

        // 应用 include/exclude 过滤
        if (includes.length > 0 && !includes.some((p) => matchesGlob(relativePath, p))) continue
        if (excludes.some((p) => matchesGlob(relativePath, p))) continue

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n')
          const matches: any[] = []

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            let match
            regex.lastIndex = 0
            while ((match = regex.exec(line)) !== null) {
              matches.push({
                line: i + 1,
                column: match.index + 1,
                length: match[0].length,
                lineContent: line,
                matchText: match[0]
              })
            }
          }

          if (matches.length > 0) {
            results.push({ filePath, relativePath, matches })
          }
        } catch {
          // 忽略无法读取的文件
        }
      }
    } catch (error) {
      console.error('Search failed:', error)
    }

    return results
  })

  // 内部替换函数
  const doReplaceInFile = async (
    filePath: string,
    searchText: string,
    replaceText: string,
    options?: any
  ) => {
    const content = await fs.readFile(filePath, 'utf-8')
    const { caseSensitive, wholeWord, useRegex } = options || {}

    let pattern = useRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (wholeWord) pattern = `\\b${pattern}\\b`

    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')
    const matches = content.match(regex)
    const replacements = matches?.length || 0

    if (replacements > 0) {
      await fs.writeFile(filePath, content.replace(regex, replaceText), 'utf-8')
    }
    return { filePath, replacements }
  }

  ipcMain.handle(
    'search:replaceInFile',
    async (_, filePath: string, searchText: string, replaceText: string, options?: any) => {
      return doReplaceInFile(filePath, searchText, replaceText, options)
    }
  )

  ipcMain.handle(
    'search:replaceAll',
    async (_, projectPath: string, searchText: string, replaceText: string, options?: any) => {
      if (!searchText?.trim()) return []

      const { caseSensitive, wholeWord, useRegex } = options || {}
      const results: any[] = []

      // 构建正则
      let pattern = useRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (wholeWord) pattern = `\\b${pattern}\\b`
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')

      try {
        for await (const filePath of walkFiles(projectPath)) {
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            if (regex.test(content)) {
              regex.lastIndex = 0
              const result = await doReplaceInFile(filePath, searchText, replaceText, options)
              if (result.replacements > 0) results.push(result)
            }
          } catch {
            // 忽略无法读取的文件
          }
        }
      } catch (error) {
        console.error('Replace all failed:', error)
      }

      return results
    }
  )

  // Quick Open - 文件名搜索（模糊匹配）
  ipcMain.handle(
    'files:quickOpen',
    async (_, projectPath: string, query: string, limit: number = 50) => {
      if (!query?.trim() || !projectPath) return []

      const searchQuery = query.toLowerCase()
      const results: Array<{
        name: string
        path: string
        relativePath: string
      }> = []

      try {
        for await (const filePath of walkFiles(projectPath)) {
          const relativePath = nodePath.relative(projectPath, filePath)
          const fileName = nodePath.basename(filePath).toLowerCase()

          // 模糊匹配：文件名包含查询字符串，或路径包含查询字符串
          if (fileName.includes(searchQuery) || relativePath.toLowerCase().includes(searchQuery)) {
            results.push({
              name: nodePath.basename(filePath),
              path: filePath,
              relativePath
            })

            // 限制返回数量
            if (results.length >= limit) break
          }
        }

        // 按匹配度排序：完全匹配 > 开头匹配 > 包含匹配
        results.sort((a, b) => {
          const aName = a.name.toLowerCase()
          const bName = b.name.toLowerCase()

          // 完全匹配优先
          if (aName === searchQuery && bName !== searchQuery) return -1
          if (bName === searchQuery && aName !== searchQuery) return 1

          // 开头匹配次之
          const aStartsWith = aName.startsWith(searchQuery)
          const bStartsWith = bName.startsWith(searchQuery)
          if (aStartsWith && !bStartsWith) return -1
          if (bStartsWith && !aStartsWith) return 1

          // 文件名长度短的优先
          if (a.name.length !== b.name.length) {
            return a.name.length - b.name.length
          }

          // 路径深度浅的优先
          const aDepth = a.relativePath.split('/').length
          const bDepth = b.relativePath.split('/').length
          if (aDepth !== bDepth) return aDepth - bDepth

          // 字母顺序
          return a.name.localeCompare(b.name)
        })

        return results
      } catch (error) {
        console.error('Quick open search failed:', error)
        return []
      }
    }
  )

  // Recent Files - 最近文件历史
  const recentFilesService = RecentFilesService.getInstance()

  ipcMain.handle('recentFiles:add', async (_, projectPath: string, filePath: string) => {
    recentFilesService.addRecentFile(projectPath, filePath)
    return { success: true }
  })

  ipcMain.handle('recentFiles:get', async (_, projectPath: string, limit?: number) => {
    return recentFilesService.getRecentFiles(projectPath, limit)
  })

  ipcMain.handle('recentFiles:remove', async (_, projectPath: string, filePath: string) => {
    recentFilesService.removeRecentFile(projectPath, filePath)
    return { success: true }
  })

  ipcMain.handle('recentFiles:clear', async (_, projectPath: string) => {
    recentFilesService.clearRecentFiles(projectPath)
    return { success: true }
  })

  // ==================== 通知相关 Handlers ====================
  const db = getDb()

  ipcMain.handle('notifications:getAll', async () => {
    return db.getNotifications()
  })

  ipcMain.handle(
    'notifications:add',
    async (
      _,
      notification: {
        id: string
        type: 'success' | 'error' | 'warning' | 'info'
        title: string
        description?: string
        timestamp: Date
      }
    ) => {
      db.addNotification({
        ...notification,
        description: notification.description ?? null
      })
      return { success: true }
    }
  )

  ipcMain.handle('notifications:markAsRead', async (_, id: string) => {
    db.markNotificationAsRead(id)
    return { success: true }
  })

  ipcMain.handle('notifications:markAllAsRead', async () => {
    db.markAllNotificationsAsRead()
    return { success: true }
  })

  ipcMain.handle('notifications:remove', async (_, id: string) => {
    db.removeNotification(id)
    return { success: true }
  })

  ipcMain.handle('notifications:clearAll', async () => {
    db.clearAllNotifications()
    return { success: true }
  })

  // ==================== Git 最近分支相关 Handlers ====================
  ipcMain.handle('recentBranches:get', async (_, projectPath: string, limit?: number) => {
    return db.getRecentBranches(projectPath, limit)
  })

  ipcMain.handle('recentBranches:add', async (_, projectPath: string, branchName: string) => {
    db.addRecentBranch(projectPath, branchName)
    return { success: true }
  })

  // ==================== Bug Report 相关 Handlers ====================
  ipcMain.handle('bugReport:submit', async (_, title: string, description: string) => {
    try {
      const report = await bugReportService.submitReport(title, description)
      return { success: true, report }
    } catch (error: any) {
      console.error('[IPC] Failed to submit bug report:', error)
      return { success: false, error: error.message }
    }
  })

  // ==================== Message Snapshot 相关 Handlers ====================
  const snapshotService = MessageSnapshotService.getInstance()

  // 获取受影响的文件列表
  ipcMain.handle('message:getAffectedFiles', async (_, messageId: number) => {
    try {
      return await snapshotService.getAffectedFiles(messageId)
    } catch (error) {
      console.error('Failed to get affected files:', error)
      return []
    }
  })

  // 恢复文件（Revert 功能）
  ipcMain.handle('message:revertFiles', async (_, messageId: number) => {
    try {
      const result = await snapshotService.restoreFiles(messageId)
      return result
    } catch (error) {
      console.error('Failed to revert files:', error)
      throw error
    }
  })

  // Files: 打开路径（在文件管理器中打开）
  ipcMain.handle('files:openPath', async (_, path: string) => {
    const { shell } = await import('electron')
    return await shell.openPath(path)
  })

  // Shell: 在默认浏览器中打开外部链接
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    return await shell.openExternal(url)
  })

  // System: Get system locale for i18n
  ipcMain.handle('system:getLocale', async () => {
    return app.getLocale()
  })

  console.log('✅ IPC handlers registered')
}
