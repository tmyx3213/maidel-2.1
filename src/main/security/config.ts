import * as path from 'path'
import * as fs from 'fs/promises'
import { app } from 'electron'
import * as winston from 'winston'

export interface AppConfig {
  claude: {
    model: string
    maxTokens: number
    apiUrl: string
  }
  mcp: {
    googleCalendar: {
      serverPath: string
      serverArgs: string[]
    }
  }
  logging: {
    level: winston.LogLevelString
    maxFiles: number
    maxSize: number
  }
  ui: {
    windowWidth: number
    windowHeight: number
    alwaysOnTop: boolean
    startMinimized: boolean
  }
}

const DEFAULT_CONFIG: AppConfig = {
  claude: {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    apiUrl: 'https://api.anthropic.com'
  },
  mcp: {
    googleCalendar: {
      serverPath: 'npx',
      serverArgs: ['@cocal/google-calendar-mcp']
    }
  },
  logging: {
    level: 'info',
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  ui: {
    windowWidth: 1200,
    windowHeight: 800,
    alwaysOnTop: false,
    startMinimized: false
  }
}

export class ConfigManager {
  private config: AppConfig = DEFAULT_CONFIG
  private configPath: string
  private logger: winston.Logger

  constructor(logLevel: winston.LogLevelString = 'info') {
    this.configPath = path.join(app.getPath('userData'), 'config.json')

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] [Config] ${message}`
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/config.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    })
  }

  async load(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8')
      const savedConfig = JSON.parse(configData)

      // Merge with default config to ensure all properties exist
      this.config = this.mergeConfig(DEFAULT_CONFIG, savedConfig)

      this.logger.info('Configuration loaded successfully', {
        path: this.configPath
      })
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.info('Config file not found, using defaults', {
          path: this.configPath
        })
        await this.save() // Create default config file
      } else {
        this.logger.error('Failed to load config', {
          error: error.message,
          path: this.configPath
        })
        // Use default config if loading fails
        this.config = DEFAULT_CONFIG
      }
    }
  }

  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true })

      // Write config file
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      )

      this.logger.info('Configuration saved successfully', {
        path: this.configPath
      })
    } catch (error) {
      this.logger.error('Failed to save config', {
        error: error.message,
        path: this.configPath
      })
      throw error
    }
  }

  get(): AppConfig {
    return { ...this.config }
  }

  set(newConfig: Partial<AppConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig)
    this.logger.debug('Configuration updated', { newConfig })
  }

  // Specific getters for common use cases
  getClaudeConfig() {
    return this.config.claude
  }

  getMCPConfig() {
    return this.config.mcp
  }

  getLoggingConfig() {
    return this.config.logging
  }

  getUIConfig() {
    return this.config.ui
  }

  // Specific setters
  setClaudeModel(model: string): void {
    this.config.claude.model = model
    this.logger.info(`Claude model updated to: ${model}`)
  }

  setLoggingLevel(level: winston.LogLevelString): void {
    this.config.logging.level = level
    this.logger.info(`Logging level updated to: ${level}`)
  }

  setWindowSize(width: number, height: number): void {
    this.config.ui.windowWidth = width
    this.config.ui.windowHeight = height
    this.logger.info(`Window size updated to: ${width}x${height}`)
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.logger.info('Configuration reset to defaults')
  }

  private mergeConfig(target: any, source: any): any {
    const result = { ...target }

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeConfig(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }

    return result
  }
}