import { app, BrowserWindow, ipcMain } from 'electron'
import * as winston from 'winston'
import { MCPClient } from './mcp/client'
import { ClaudeAPIClient } from './claude/api'
import { KeychainManager } from './security/keychain'
import { ConfigManager } from './security/config'
import { createWindow } from './window'

export class MaidelApp {
  private mainWindow: BrowserWindow | null = null
  private mcpClient: MCPClient | null = null
  private claudeClient: ClaudeAPIClient | null = null
  private keychain: KeychainManager
  private config: ConfigManager
  private logger: winston.Logger

  constructor() {
    this.keychain = new KeychainManager()
    this.config = new ConfigManager()

    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `${timestamp} [${level}] [App] ${message} ${metaStr}`
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/app.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    })
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Maidel 2.1...')

    try {
      // Load configuration
      await this.config.load()

      // Update logger level from config
      this.logger.level = this.config.getLoggingConfig().level

      // Initialize credentials
      await this.initializeCredentials()

      // Initialize MCP client
      await this.initializeMCPClient()

      // Initialize Claude client
      await this.initializeClaudeClient()

      // Set up IPC handlers
      this.setupIPCHandlers()

      this.logger.info('Maidel 2.1 initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize Maidel 2.1', { error: error.message })
      throw error
    }
  }

  async createMainWindow(): Promise<BrowserWindow> {
    const uiConfig = this.config.getUIConfig()

    this.mainWindow = createWindow({
      width: uiConfig.windowWidth,
      height: uiConfig.windowHeight
    })

    // Handle window events
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    this.mainWindow.on('resize', () => {
      if (this.mainWindow) {
        const [width, height] = this.mainWindow.getSize()
        this.config.setWindowSize(width, height)
      }
    })

    return this.mainWindow
  }

  private async initializeCredentials(): Promise<void> {
    const credentials = await this.keychain.verifyCredentials()

    if (!credentials.claude) {
      this.logger.warn('Claude API key not found in keychain')
    }

    if (!credentials.google) {
      this.logger.warn('Google credentials not found in keychain')
    }

    this.logger.info('Credential verification complete', credentials)
  }

  private async initializeMCPClient(): Promise<void> {
    this.logger.info('Initializing MCP client...')

    this.mcpClient = new MCPClient(this.config.getLoggingConfig().level)

    // Set up event handlers
    this.mcpClient.on('serverReady', (serverName) => {
      this.logger.info(`MCP server ready: ${serverName}`)
      if (this.mainWindow) {
        this.mainWindow.webContents.send('mcp:server-ready', serverName)
      }
    })

    this.mcpClient.on('serverError', (serverName, error) => {
      this.logger.error(`MCP server error: ${serverName}`, { error })
      if (this.mainWindow) {
        this.mainWindow.webContents.send('mcp:server-error', { serverName, error: error.message })
      }
    })

    // Add Google Calendar server
    const mcpConfig = this.config.getMCPConfig()

    try {
      await this.mcpClient.addServer({
        name: 'google-calendar',
        command: mcpConfig.googleCalendar.serverPath,
        args: mcpConfig.googleCalendar.serverArgs,
        env: {
          ...process.env,
          // Google credentials will be set by the MCP server itself
          // We just ensure the keychain has the credentials available
        }
      })

      this.logger.info('Google Calendar MCP server added successfully')
    } catch (error) {
      this.logger.error('Failed to add Google Calendar MCP server', { error: error.message })
      // Don't throw - the app can still function without the MCP server
    }
  }

  private async initializeClaudeClient(): Promise<void> {
    const apiKey = await this.keychain.getClaudeApiKey()

    if (!apiKey) {
      this.logger.warn('Claude API key not available - client not initialized')
      return
    }

    this.logger.info('Initializing Claude API client...')

    this.claudeClient = new ClaudeAPIClient(
      apiKey,
      this.config.getLoggingConfig().level
    )

    this.logger.info('Claude API client initialized successfully')
  }

  private setupIPCHandlers(): void {
    this.logger.info('Setting up IPC handlers...')

    // Claude API handlers
    ipcMain.handle('claude:sendMessage', async (event, message: string) => {
      if (!this.claudeClient) {
        throw new Error('Claude API client not initialized')
      }

      if (!this.mcpClient) {
        throw new Error('MCP client not initialized')
      }

      try {
        const tools = this.mcpClient.getAllTools()
        const response = await this.claudeClient.sendMessage(message, tools)

        // If Claude wants to use tools, execute them
        if (this.claudeClient.hasToolUse(response)) {
          const toolResults = await this.claudeClient.handleToolUse(response, async (toolName, args) => {
            return await this.mcpClient!.callTool(toolName, args)
          })

          // Continue the conversation with tool results
          const finalResponse = await this.claudeClient.continueConversation(response, toolResults, [], tools)
          return this.claudeClient.getTextContent(finalResponse)
        }

        return this.claudeClient.getTextContent(response)
      } catch (error) {
        this.logger.error('Claude message failed', { error: error.message })
        throw error
      }
    })

    // Calendar handlers
    ipcMain.handle('calendar:getEvents', async (event, { timeMin, timeMax }) => {
      if (!this.mcpClient) {
        throw new Error('MCP client not initialized')
      }

      try {
        const result = await this.mcpClient.callTool('list-events', {
          calendarId: 'primary',
          timeMin,
          timeMax
        })

        return result.content[0]?.text ? JSON.parse(result.content[0].text) : []
      } catch (error) {
        this.logger.error('Failed to get calendar events', { error: error.message })
        throw error
      }
    })

    ipcMain.handle('calendar:createEvent', async (event, eventData) => {
      if (!this.mcpClient) {
        throw new Error('MCP client not initialized')
      }

      try {
        const result = await this.mcpClient.callTool('create-event', {
          calendarId: 'primary',
          ...eventData
        })

        return result.content[0]?.text ? JSON.parse(result.content[0].text) : null
      } catch (error) {
        this.logger.error('Failed to create calendar event', { error: error.message })
        throw error
      }
    })

    // Window management handlers
    ipcMain.handle('window:minimize', async () => {
      if (this.mainWindow) {
        this.mainWindow.minimize()
      }
    })

    ipcMain.handle('window:maximize', async () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize()
        } else {
          this.mainWindow.maximize()
        }
      }
    })

    ipcMain.handle('window:close', async () => {
      if (this.mainWindow) {
        this.mainWindow.close()
      }
    })

    // Configuration handlers
    ipcMain.handle('config:get', async () => {
      return this.config.get()
    })

    ipcMain.handle('config:set', async (event, newConfig) => {
      this.config.set(newConfig)
      await this.config.save()
    })

    // Credential management handlers
    ipcMain.handle('credentials:setClaudeApiKey', async (event, apiKey: string) => {
      await this.keychain.setClaudeApiKey(apiKey)
      await this.initializeClaudeClient() // Reinitialize client with new key
    })

    ipcMain.handle('credentials:setGoogleCredentials', async (event, credentials: string) => {
      await this.keychain.setGoogleCredentials(credentials)
    })

    ipcMain.handle('credentials:verify', async () => {
      return await this.keychain.verifyCredentials()
    })

    this.logger.info('IPC handlers set up successfully')
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Maidel 2.1...')

    try {
      // Save configuration
      await this.config.save()

      // Shutdown MCP client
      if (this.mcpClient) {
        await this.mcpClient.shutdown()
      }

      this.logger.info('Maidel 2.1 shutdown complete')
    } catch (error) {
      this.logger.error('Error during shutdown', { error: error.message })
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  getMCPClient(): MCPClient | null {
    return this.mcpClient
  }

  getClaudeClient(): ClaudeAPIClient | null {
    return this.claudeClient
  }
}