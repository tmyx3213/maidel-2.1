import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as winston from 'winston'
import {
  JsonRpcRequest,
  JsonRpcResponse,
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  InitializeRequest,
  InitializeResponse,
  ToolsListResponse,
  ToolCallRequest,
  ToolCallResponse
} from './types'

export class MCPServerManager extends EventEmitter {
  private process: ChildProcess | null = null
  private requestId = 1
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()
  private logger: winston.Logger
  private buffer = ''
  private _status: MCPServerStatus['status'] = 'disconnected'
  private _tools: MCPTool[] = []

  constructor(
    private config: MCPServerConfig,
    private logLevel: winston.LogLevelString = 'info'
  ) {
    super()

    // Configure logger
    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `${timestamp} [${level}] [MCP:${this.config.name}] ${message} ${metaStr}`
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: `logs/mcp.${this.config.name}.log`,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    })
  }

  get status(): MCPServerStatus['status'] {
    return this._status
  }

  get tools(): MCPTool[] {
    return [...this._tools]
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error(`Server ${this.config.name} is already running`)
    }

    this._status = 'initializing'
    this.emit('statusChanged', this._status)

    try {
      this.logger.info(`Starting MCP server: ${this.config.command}`)

      this.process = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.process.stdin?.setEncoding('utf8')
      this.process.stdout?.setEncoding('utf8')
      this.process.stderr?.setEncoding('utf8')

      // Handle stdout (JSON-RPC messages)
      this.process.stdout?.on('data', (data: string) => {
        this.buffer += data
        this.processBuffer()
      })

      // Handle stderr (logs)
      this.process.stderr?.on('data', (data: string) => {
        this.logger.warn(`Server stderr: ${data.toString()}`)
      })

      // Handle process events
      this.process.on('error', (error) => {
        this.logger.error(`Server process error: ${error.message}`)
        this._status = 'error'
        this.emit('error', error)
        this.emit('statusChanged', this._status)
      })

      this.process.on('exit', (code, signal) => {
        this.logger.info(`Server process exited with code ${code}, signal ${signal}`)
        this._status = 'disconnected'
        this.emit('disconnected', { code, signal })
        this.emit('statusChanged', this._status)
        this.cleanup()
      })

      // Initialize MCP connection
      await this.initialize()
      await this.loadTools()

      this._status = 'ready'
      this.emit('ready')
      this.emit('statusChanged', this._status)

    } catch (error) {
      this.logger.error(`Failed to start server: ${error}`)
      this._status = 'error'
      this.emit('error', error)
      this.emit('statusChanged', this._status)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return
    }

    this.logger.info('Stopping MCP server')

    // Clear pending requests
    for (const [id, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout)
      reject(new Error('Server stopping'))
    }
    this.pendingRequests.clear()

    // Terminate process
    if (this.process.kill()) {
      this.logger.info('Server process terminated')
    } else {
      this.logger.warn('Failed to terminate server process gracefully, forcing...')
      this.process.kill('SIGKILL')
    }

    this.cleanup()
  }

  async callTool(name: string, args: Record<string, any>): Promise<ToolCallResponse> {
    if (this._status !== 'ready') {
      throw new Error(`Server ${this.config.name} is not ready (status: ${this._status})`)
    }

    const request: ToolCallRequest = {
      name,
      arguments: args
    }

    this.logger.info(`Calling tool: ${name}`, { args })

    const response = await this.sendRequest('tools/call', request)

    this.logger.info(`Tool ${name} response`, { response })
    return response
  }

  private async initialize(): Promise<void> {
    const initRequest: InitializeRequest = {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: 'Maidel 2.1',
        version: '0.1.0'
      }
    }

    const response: InitializeResponse = await this.sendRequest('initialize', initRequest)

    this.logger.info('MCP server initialized', {
      serverInfo: response.serverInfo,
      capabilities: response.capabilities
    })
  }

  private async loadTools(): Promise<void> {
    const response: ToolsListResponse = await this.sendRequest('tools/list', {})
    this._tools = response.tools

    this.logger.info(`Loaded ${this._tools.length} tools`, {
      tools: this._tools.map(t => t.name)
    })
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Server process not available'))
        return
      }

      const id = this.requestId++
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${method} timed out`))
      }, 30000) // 30 second timeout

      this.pendingRequests.set(id, { resolve, reject, timeout })

      const message = JSON.stringify(request) + '\n'
      this.process.stdin.write(message, 'utf8')

      this.logger.debug(`Sent request: ${method}`, { id, params })
    })
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: JsonRpcResponse = JSON.parse(line)
          this.handleResponse(response)
        } catch (error) {
          this.logger.error(`Failed to parse JSON-RPC response: ${error}`, { line })
        }
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id as number)
    if (!pending) {
      this.logger.warn(`Received response for unknown request ID: ${response.id}`)
      return
    }

    this.pendingRequests.delete(response.id as number)
    clearTimeout(pending.timeout)

    if (response.error) {
      this.logger.error(`Request failed`, {
        id: response.id,
        error: response.error
      })
      pending.reject(new Error(`MCP Error: ${response.error.message}`))
    } else {
      this.logger.debug(`Request completed`, {
        id: response.id,
        result: response.result
      })
      pending.resolve(response.result)
    }
  }

  private cleanup(): void {
    this.process = null
    this._status = 'disconnected'
    this._tools = []
    this.buffer = ''
    this.pendingRequests.clear()
  }
}