import * as keytar from 'keytar'
import * as winston from 'winston'

const SERVICE_NAME = 'maidel2.1'

export class KeychainManager {
  private logger: winston.Logger

  constructor(logLevel: winston.LogLevelString = 'info') {
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] [Keychain] ${message}`
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/security.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    })
  }

  async setClaudeApiKey(apiKey: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'claude-api-key', apiKey)
      this.logger.info('Claude API key stored successfully')
    } catch (error) {
      this.logger.error('Failed to store Claude API key', { error: error.message })
      throw error
    }
  }

  async getClaudeApiKey(): Promise<string | null> {
    try {
      const apiKey = await keytar.getPassword(SERVICE_NAME, 'claude-api-key')
      if (apiKey) {
        this.logger.debug('Claude API key retrieved')
      } else {
        this.logger.warn('Claude API key not found in keychain')
      }
      return apiKey
    } catch (error) {
      this.logger.error('Failed to retrieve Claude API key', { error: error.message })
      return null
    }
  }

  async setGoogleCredentials(credentials: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'google-credentials', credentials)
      this.logger.info('Google credentials stored successfully')
    } catch (error) {
      this.logger.error('Failed to store Google credentials', { error: error.message })
      throw error
    }
  }

  async getGoogleCredentials(): Promise<string | null> {
    try {
      const credentials = await keytar.getPassword(SERVICE_NAME, 'google-credentials')
      if (credentials) {
        this.logger.debug('Google credentials retrieved')
      } else {
        this.logger.warn('Google credentials not found in keychain')
      }
      return credentials
    } catch (error) {
      this.logger.error('Failed to retrieve Google credentials', { error: error.message })
      return null
    }
  }

  async deleteClaudeApiKey(): Promise<void> {
    try {
      const deleted = await keytar.deletePassword(SERVICE_NAME, 'claude-api-key')
      if (deleted) {
        this.logger.info('Claude API key deleted from keychain')
      } else {
        this.logger.warn('Claude API key was not found in keychain')
      }
    } catch (error) {
      this.logger.error('Failed to delete Claude API key', { error: error.message })
      throw error
    }
  }

  async deleteGoogleCredentials(): Promise<void> {
    try {
      const deleted = await keytar.deletePassword(SERVICE_NAME, 'google-credentials')
      if (deleted) {
        this.logger.info('Google credentials deleted from keychain')
      } else {
        this.logger.warn('Google credentials were not found in keychain')
      }
    } catch (error) {
      this.logger.error('Failed to delete Google credentials', { error: error.message })
      throw error
    }
  }

  async clearAll(): Promise<void> {
    this.logger.info('Clearing all stored credentials')
    await Promise.all([
      this.deleteClaudeApiKey(),
      this.deleteGoogleCredentials()
    ])
  }

  async verifyCredentials(): Promise<{ claude: boolean, google: boolean }> {
    const [claude, google] = await Promise.all([
      this.getClaudeApiKey(),
      this.getGoogleCredentials()
    ])

    return {
      claude: claude !== null && claude.length > 0,
      google: google !== null && google.length > 0
    }
  }
}