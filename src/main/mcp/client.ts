import { EventEmitter } from 'events'
import * as winston from 'winston'
import { MCPServerManager } from './server-manager'
import { MCPServerConfig, MCPTool, ToolCallResponse } from './types'

export class MCPClient extends EventEmitter {
  private servers = new Map<string, MCPServerManager>()
  private logger: winston.Logger

  constructor(private logLevel: winston.LogLevelString = 'info') {
    super()

    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `${timestamp} [${level}] [MCPClient] ${message} ${metaStr}`
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/mcp.client.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    })
  }

  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server ${config.name} already exists`)
    }

    this.logger.info(`Adding MCP server: ${config.name}`)

    const manager = new MCPServerManager(config, this.logLevel)

    // Forward events
    manager.on('ready', () => {
      this.logger.info(`Server ${config.name} is ready`)
      this.emit('serverReady', config.name)
    })

    manager.on('error', (error) => {
      this.logger.error(`Server ${config.name} error: ${error}`)
      this.emit('serverError', config.name, error)
    })

    manager.on('disconnected', (info) => {
      this.logger.info(`Server ${config.name} disconnected`, info)
      this.emit('serverDisconnected', config.name, info)
    })

    manager.on('statusChanged', (status) => {
      this.emit('serverStatusChanged', config.name, status)
    })

    this.servers.set(config.name, manager)

    try {
      await manager.start()
    } catch (error) {
      this.servers.delete(config.name)
      throw error
    }
  }

  async removeServer(name: string): Promise<void> {
    const manager = this.servers.get(name)
    if (!manager) {
      return
    }

    this.logger.info(`Removing MCP server: ${name}`)
    await manager.stop()
    this.servers.delete(name)
  }

  getServerStatus(name: string) {
    const manager = this.servers.get(name)
    return manager ? {
      name,
      status: manager.status,
      tools: manager.tools
    } : null
  }

  getAllServers() {
    return Array.from(this.servers.keys()).map(name => this.getServerStatus(name)!)
  }

  getAllTools(): Array<MCPTool & { serverName: string }> {
    const tools: Array<MCPTool & { serverName: string }> = []

    for (const [serverName, manager] of this.servers) {
      if (manager.status === 'ready') {
        for (const tool of manager.tools) {
          tools.push({ ...tool, serverName })
        }
      }
    }

    return tools
  }

  async callTool(toolName: string, args: Record<string, any>, serverName?: string): Promise<ToolCallResponse> {
    // If server name is specified, use that server
    if (serverName) {
      const manager = this.servers.get(serverName)
      if (!manager) {
        throw new Error(`Server ${serverName} not found`)
      }
      return await manager.callTool(toolName, args)
    }

    // Otherwise, find the first server that has this tool
    for (const [name, manager] of this.servers) {
      if (manager.status === 'ready' && manager.tools.some(tool => tool.name === toolName)) {
        this.logger.info(`Calling tool ${toolName} on server ${name}`)
        return await manager.callTool(toolName, args)
      }
    }

    throw new Error(`Tool ${toolName} not found on any ready server`)
  }

  async getTool(toolName: string, serverName?: string): Promise<MCPTool & { serverName: string } | null> {
    const allTools = this.getAllTools()

    if (serverName) {
      return allTools.find(tool => tool.name === toolName && tool.serverName === serverName) || null
    }

    return allTools.find(tool => tool.name === toolName) || null
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MCP client')

    const promises = Array.from(this.servers.values()).map(manager => manager.stop())
    await Promise.all(promises)

    this.servers.clear()
    this.logger.info('MCP client shutdown complete')
  }

  // Convenience method for initializing common servers
  static async createWithGoogleCalendar(logLevel?: winston.LogLevelString): Promise<MCPClient> {
    const client = new MCPClient(logLevel)

    // Add Google Calendar MCP server
    await client.addServer({
      name: 'google-calendar',
      command: 'npx',
      args: ['@cocal/google-calendar-mcp']
    })

    return client
  }
}