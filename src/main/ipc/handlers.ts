import { ipcMain, BrowserWindow, dialog } from 'electron'
import { AgentService } from '../services/agent.service'
import { ChatService } from '../services/chat.service'
import { ToolService } from '../services/tool.service'
import { MCPService } from '../services/mcp.service'
import { FileService } from '../services/file.service'
import { ProjectService } from '../services/project.service'
import { FileWatcherService } from '../services/file-watcher.service'
import { AvatarService } from '../services/avatar.service'
import { GitService } from '../services/git.service'
import { TerminalService } from '../services/terminal.service'
import { getConfigService, getMCPClientManager } from '../index'
import { CompletionService } from '../services/completion.service'
import { updateRecentProjectsMenu } from '../menu'
import * as fontList from 'font-list'

const agentService = new AgentService()
const chatService = new ChatService()

// 存储活动的流式响应 AbortControllers
const activeStreams = new Map<string, AbortController>()

let completionServiceSingleton: CompletionService | null = null

export function registerIpcHandlers() {
  // 获取全局配置服务实例
  const configService = getConfigService()

  // macOS 原生菜单：更新「打开最近」列表
  ipcMain.handle('app:setRecentProjects', (_, recent: { path: string; name: string }[]) => {
    updateRecentProjectsMenu(recent)
  })

  // Agent handlers
  ipcMain.handle('agents:getAll', async () => {
    try {
      return await agentService.getAllAgents()
    } catch (error) {
      console.error('Failed to get agents:', error)
      throw error
    }
  })

  ipcMain.handle('agents:getDefault', async () => {
    try {
      return await agentService.getDefaultAgent()
    } catch (error) {
      console.error('Failed to get default agent:', error)
      throw error
    }
  })

  ipcMain.handle('agents:getById', async (_, id: string) => {
    try {
      return await agentService.getAgentById(id)
    } catch (error) {
      console.error('Failed to get agent:', error)
      throw error
    }
  })

  ipcMain.handle('agents:create', async (_, data) => {
    try {
      return await agentService.createAgent(data)
    } catch (error) {
      console.error('Failed to create agent:', error)
      throw error
    }
  })

  ipcMain.handle('agents:update', async (_, id: string, data) => {
    try {
      return await agentService.updateAgent(id, data)
    } catch (error) {
      console.error('Failed to update agent:', error)
      throw error
    }
  })

  ipcMain.handle('agents:delete', async (_, id: string) => {
    try {
      await agentService.deleteAgent(id)
    } catch (error) {
      console.error('Failed to delete agent:', error)
      throw error
    }
  })

  // Chat handlers
  ipcMain.handle('chat:send', async (_, options) => {
    try {
      return await chatService.chat(options)
    } catch (error) {
      console.error('Chat error:', error)
      throw error
    }
  })

  ipcMain.on('chat:stream', async (event, options) => {
    const streamId = options.streamId
    const abortController = new AbortController()

    if (streamId) {
      activeStreams.set(streamId, abortController)
    }

    try {
      const result = await chatService.streamChat({
        ...options,
        workspaceRoot: options.workspaceRoot,
        configService,
        abortSignal: abortController.signal,
        onStream: (chunk: {
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
        }) => {
          event.reply('chat:stream:chunk', chunk)
        },
        onError: (error: Error) => {
          event.reply('chat:stream:error', error.message)
        }
      })
      event.reply('chat:stream:end', result.threadId)
    } catch (error) {
      console.error('Stream chat error:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        event.reply('chat:stream:error', '流式响应已停止')
      } else {
        event.reply('chat:stream:error', error instanceof Error ? error.message : 'Unknown error')
      }
    } finally {
      if (streamId) {
        activeStreams.delete(streamId)
      }
    }
  })

  // 停止流式响应
  ipcMain.on('chat:stream:stop', (_, streamId: string) => {
    const abortController = activeStreams.get(streamId)
    if (abortController) {
      abortController.abort()
      activeStreams.delete(streamId)
    }
  })

  // Thread handlers (替代原 Conversation handlers)
  ipcMain.handle('threads:getByAgent', async (_, agentId: string) => {
    try {
      return await chatService.getAgentThreads(agentId)
    } catch (error) {
      console.error('Failed to get threads:', error)
      throw error
    }
  })

  ipcMain.handle('threads:getWithMessages', async (_, threadId: string) => {
    try {
      return await chatService.getThreadHistory(threadId)
    } catch (error) {
      console.error('Failed to get thread:', error)
      throw error
    }
  })

  ipcMain.handle('threads:delete', async (_, threadId: string) => {
    try {
      await chatService.deleteThread(threadId)
    } catch (error) {
      console.error('Failed to delete thread:', error)
      throw error
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

  ipcMain.handle('config:setPreference', async (_, key: string, value: boolean) => {
    try {
      configService.setPreference(key as any, value)
    } catch (error) {
      console.error('Failed to set preference:', error)
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

  // Tool handlers (支持 MCP/Custom)
  ipcMain.handle('tools:getAll', async (_, agentId?: string) => {
    try {
      return await ToolService.getAllTools(agentId)
    } catch (error) {
      console.error('Failed to get tools:', error)
      throw error
    }
  })

  ipcMain.handle('tools:getTop', async (_, limit: number = 10, agentId?: string) => {
    try {
      return await ToolService.getTopTools(limit, agentId)
    } catch (error) {
      console.error('Failed to get top tools:', error)
      throw error
    }
  })

  ipcMain.handle('tools:getStatsByServer', async (_, agentId?: string) => {
    try {
      return await ToolService.getToolStatsByServer(agentId)
    } catch (error) {
      console.error('Failed to get tool stats by server:', error)
      throw error
    }
  })

  ipcMain.handle('tools:importFromMCP', async (_, serverId: string) => {
    try {
      const count = await ToolService.importMCPTools(serverId)
      return { success: true, count }
    } catch (error) {
      console.error('Failed to import MCP tools:', error)
      throw error
    }
  })

  ipcMain.handle('tools:syncMCPServer', async (_, serverId: string) => {
    try {
      await ToolService.syncMCPServerTools(serverId)
      return { success: true }
    } catch (error) {
      console.error('Failed to sync MCP server tools:', error)
      throw error
    }
  })

  ipcMain.handle('tools:createCustom', async (_, data) => {
    try {
      return await ToolService.createCustomTool(data)
    } catch (error) {
      console.error('Failed to create custom tool:', error)
      throw error
    }
  })

  ipcMain.handle('tools:update', async (_, id: string, data) => {
    try {
      return await ToolService.updateTool(id, data)
    } catch (error) {
      console.error('Failed to update tool:', error)
      throw error
    }
  })

  ipcMain.handle('tools:delete', async (_, id: string) => {
    try {
      await ToolService.deleteTool(id)
    } catch (error) {
      console.error('Failed to delete tool:', error)
      throw error
    }
  })

  // MCP Server handlers
  ipcMain.handle('mcp:getAll', async () => {
    try {
      return await MCPService.getAllServers()
    } catch (error) {
      console.error('Failed to get MCP servers:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:create', async (_, data) => {
    try {
      const newServer = await MCPService.createServer(data)

      // 重新初始化 MCP Client 以包含新服务器
      const mcpClientManager = getMCPClientManager()
      await mcpClientManager.reinitialize()

      return newServer
    } catch (error) {
      console.error('Failed to create MCP server:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:update', async (_, id: string, data) => {
    try {
      const updatedServer = await MCPService.updateServer(id, data)

      // 重新初始化 MCP Client 以反映更新
      const mcpClientManager = getMCPClientManager()
      await mcpClientManager.reinitialize()

      return updatedServer
    } catch (error) {
      console.error('Failed to update MCP server:', error)
      throw error
    }
  })

  ipcMain.handle('mcp:delete', async (_, id: string) => {
    try {
      // 从数据库删除
      await MCPService.deleteServer(id)

      // 重新初始化 MCP Client 以移除该服务器
      const mcpClientManager = getMCPClientManager()
      await mcpClientManager.reinitialize()
    } catch (error) {
      console.error('Failed to delete MCP server:', error)
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

  ipcMain.handle('files:listDirectory', async (_, dirPath: string) => {
    try {
      return await FileService.listDirectory(dirPath)
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
  ipcMain.handle('project:openDialog', async () => {
    try {
      const projectPath = await ProjectService.openProjectDialog()
      if (projectPath) {
        await ProjectService.addRecentProject(projectPath, configService)

        // 开始监听文件变化
        const window = BrowserWindow.getFocusedWindow()
        if (window) {
          FileWatcherService.startWatching(projectPath, window)
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
      return ProjectService.getRecentProjects(configService)
    } catch (error) {
      console.error('Failed to get recent projects:', error)
      throw error
    }
  })

  ipcMain.handle('project:getCurrent', async () => {
    try {
      return ProjectService.getCurrentProject(configService)
    } catch (error) {
      console.error('Failed to get current project:', error)
      throw error
    }
  })

  ipcMain.handle('project:setCurrent', async (_, projectPath: string | null) => {
    try {
      const window = BrowserWindow.getFocusedWindow()

      // 停止之前的监听
      const currentProject = ProjectService.getCurrentProject(configService)
      if (currentProject) {
        await FileWatcherService.stopWatching(currentProject)
      }

      // 设置新项目
      ProjectService.setCurrentProject(projectPath, configService)

      // 如果有新项目，开始监听并添加到最近项目
      if (projectPath && window) {
        await ProjectService.addRecentProject(projectPath, configService)
        FileWatcherService.startWatching(projectPath, window)
      }
    } catch (error) {
      console.error('Failed to set current project:', error)
      throw error
    }
  })

  ipcMain.handle('project:close', async () => {
    try {
      const currentProject = ProjectService.getCurrentProject(configService)
      if (currentProject) {
        await FileWatcherService.stopWatching(currentProject)
      }
      ProjectService.setCurrentProject(null, configService)
    } catch (error) {
      console.error('Failed to close project:', error)
      throw error
    }
  })

  // Git handlers

  ipcMain.handle('git:extractRepoName', async (_, url: string) => {
    try {
      return GitService.extractRepoName(url)
    } catch (error) {
      console.error('Failed to extract repo name:', error)
      throw error
    }
  })

  ipcMain.handle('git:selectTargetDirectory', async () => {
    try {
      return await GitService.selectTargetDirectory()
    } catch (error) {
      console.error('Failed to select target directory:', error)
      throw error
    }
  })

  ipcMain.handle('git:cloneRepository', async (_, repoUrl: string, targetPath: string) => {
    try {
      const window = BrowserWindow.getFocusedWindow()

      const clonedPath = await GitService.cloneRepository(repoUrl, targetPath, (message) => {
        window?.webContents.send('git:cloneProgress', message)
      })

      // 克隆成功后，设置为当前项目
      if (window) {
        await ProjectService.addRecentProject(clonedPath, configService)
        ProjectService.setCurrentProject(clonedPath, configService)
        FileWatcherService.startWatching(clonedPath, window)
      }

      return clonedPath
    } catch (error) {
      console.error('Failed to clone repository:', error)
      throw error
    }
  })

  ipcMain.handle('git:createNewProject', async (_, parentPath: string, projectName: string) => {
    try {
      const window = BrowserWindow.getFocusedWindow()

      const projectPath = await GitService.createNewProject(parentPath, projectName)

      // 创建成功后，设置为当前项目
      if (window) {
        await ProjectService.addRecentProject(projectPath, configService)
        ProjectService.setCurrentProject(projectPath, configService)
        FileWatcherService.startWatching(projectPath, window)
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
    async (_, projectPath: string, branchName: string, checkout: boolean) => {
      try {
        await GitService.createBranch(projectPath, branchName, checkout)
      } catch (error) {
        console.error('Failed to create branch:', error)
        throw error
      }
    }
  )

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

  ipcMain.handle('git:pull', async (_, projectPath: string, remote: string, branch?: string) => {
    try {
      await GitService.pull(projectPath, remote, branch)
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

  ipcMain.handle('git:revertFile', async (_, projectPath: string, filePath: string) => {
    try {
      await GitService.revertFile(projectPath, filePath)
    } catch (error) {
      console.error('Failed to revert file:', error)
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

  ipcMain.handle('git:getRemotes', async (_, projectPath: string) => {
    try {
      return await GitService.getRemotes(projectPath)
    } catch (error) {
      console.error('Failed to get remotes:', error)
      throw error
    }
  })

  // Avatar handlers
  ipcMain.handle('avatar:select', async () => {
    try {
      return await AvatarService.selectAvatarFile()
    } catch (error) {
      console.error('Failed to select avatar:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:save', async (_, sourcePath: string, agentId: string) => {
    try {
      return await AvatarService.saveAvatar(sourcePath, agentId)
    } catch (error) {
      console.error('Failed to save avatar:', error)
      throw error
    }
  })

  ipcMain.handle('avatar:delete', async (_, agentId: string) => {
    try {
      await AvatarService.deleteAgentAvatars(agentId)
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
      const configPath = configService.getConfigPath()
      console.log('🔍 Debug Config Info:')
      console.log('   Path:', configPath)
      console.log('   Current Project:', config.currentProject)
      console.log('   Recent Projects:', config.recentProjects)
      return {
        path: configPath,
        config
      }
    } catch (error) {
      console.error('Failed to debug config:', error)
      throw error
    }
  })

  // Coding Agent handlers - AI 项目创建
  ipcMain.handle('coding-agent:selectProjectFolder', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) throw new Error('No active window')

      const result = await dialog.showOpenDialog(window, {
        title: '选择项目文件夹',
        message: '请选择一个文件夹来创建您的项目',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: '选择此文件夹'
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
    'coding-agent:createProject',
    async (_, userPrompt: string, projectPath: string) => {
      try {
        const window = BrowserWindow.getFocusedWindow()

        // 使用系统 Coding Agent
        const result = await chatService.streamChat({
          agentId: 'system-coding-agent',
          message: userPrompt,
          workspaceRoot: projectPath,
          configService,
          onStream: (chunk) => {
            if (chunk.type === 'text') {
              window?.webContents.send('coding-agent:stream:chunk', chunk.content)
            }
          },
          onError: (error) => {
            console.error('Coding agent stream error:', error)
          }
        })

        // 项目创建完成后的处理
        await ProjectService.addRecentProject(projectPath, configService)
        ProjectService.setCurrentProject(projectPath, configService)

        if (window) {
          FileWatcherService.startWatching(projectPath, window)
        }

        return {
          success: true,
          threadId: result.threadId,
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
      const window = BrowserWindow.getFocusedWindow()
      if (!window) throw new Error('No active window')

      const terminalId = TerminalService.createTerminal(cwd, window)
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
  ipcMain.handle('codebase:index', async (_, projectPath: string) => {
    try {
      const { CodebaseIndexService } = await import('../services/codebase-index.service')
      const indexService = CodebaseIndexService.getInstance()
      const window = BrowserWindow.getFocusedWindow()
      if (!window) throw new Error('No active window')

      const index = await indexService.indexProject(projectPath, (progress, total, message) => {
        window.webContents.send('codebase:index:progress', {
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
        const results = await indexService.searchCodebase(projectPath, query, options)
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
      await indexService.deleteIndex(projectPath)
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

  ipcMain.handle('completion:generate', async (_, request) => {
    try {
      completionServiceSingleton ??= new CompletionService(configService)
      return await completionServiceSingleton.generateCompletion(request)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { type: 'error', error: msg }
    }
  })

  console.log('✅ IPC handlers registered')
}
