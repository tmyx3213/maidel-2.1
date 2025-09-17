import * as winston from 'winston'
import { MCPTool } from '../mcp/types'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, any>
}

export interface ClaudeToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export interface ClaudeContent {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, any>
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

export interface ClaudeRequest {
  model: string
  max_tokens: number
  messages: Array<{
    role: 'user' | 'assistant'
    content: ClaudeContent[]
  }>
  tools?: Array<{
    name: string
    description: string
    input_schema: any
  }>
  system?: string
}

export interface ClaudeResponse {
  id: string
  model: string
  role: 'assistant'
  content: ClaudeContent[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export class ClaudeAPIClient {
  private logger: winston.Logger
  private apiKey: string
  private baseURL = 'https://api.anthropic.com'

  constructor(
    apiKey: string,
    private logLevel: winston.LogLevelString = 'info'
  ) {
    this.apiKey = apiKey

    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `${timestamp} [${level}] [Claude] ${message} ${metaStr}`
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/claude.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    })
  }

  async sendMessage(
    userMessage: string,
    tools: MCPTool[] = [],
    conversationHistory: ClaudeMessage[] = []
  ): Promise<ClaudeResponse> {
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: [{ type: 'text' as const, text: msg.content }]
      })),
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: userMessage }]
      }
    ]

    const claudeTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }))

    const request: ClaudeRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages,
      tools: claudeTools.length > 0 ? claudeTools : undefined,
      system: this.getSystemPrompt(tools)
    }

    this.logger.info('Sending request to Claude API', {
      userMessage,
      toolCount: tools.length,
      historyLength: conversationHistory.length
    })

    try {
      const response = await this.makeRequest('/v1/messages', request)

      this.logger.info('Received response from Claude API', {
        stopReason: response.stop_reason,
        contentTypes: response.content.map(c => c.type),
        usage: response.usage
      })

      return response
    } catch (error) {
      this.logger.error('Claude API request failed', { error: error.message })
      throw error
    }
  }

  async handleToolUse(
    response: ClaudeResponse,
    toolExecutor: (toolName: string, args: Record<string, any>) => Promise<any>
  ): Promise<ClaudeContent[]> {
    const toolResults: ClaudeContent[] = []

    for (const content of response.content) {
      if (content.type === 'tool_use' && content.name && content.id) {
        this.logger.info(`Executing tool: ${content.name}`, { args: content.input })

        try {
          const result = await toolExecutor(content.name, content.input || {})

          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          })

          this.logger.info(`Tool ${content.name} executed successfully`)
        } catch (error) {
          this.logger.error(`Tool ${content.name} execution failed: ${error.message}`)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: `Error: ${error.message}`,
            is_error: true
          })
        }
      }
    }

    return toolResults
  }

  async continueConversation(
    originalResponse: ClaudeResponse,
    toolResults: ClaudeContent[],
    conversationHistory: ClaudeMessage[] = [],
    tools: MCPTool[] = []
  ): Promise<ClaudeResponse> {
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: [{ type: 'text' as const, text: msg.content }]
      })),
      {
        role: 'assistant' as const,
        content: originalResponse.content
      },
      {
        role: 'user' as const,
        content: toolResults
      }
    ]

    const claudeTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }))

    const request: ClaudeRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages,
      tools: claudeTools.length > 0 ? claudeTools : undefined,
      system: this.getSystemPrompt(tools)
    }

    this.logger.info('Continuing conversation with tool results', {
      toolResultCount: toolResults.length
    })

    try {
      const response = await this.makeRequest('/v1/messages', request)

      this.logger.info('Received continuation response from Claude API', {
        stopReason: response.stop_reason,
        usage: response.usage
      })

      return response
    } catch (error) {
      this.logger.error('Claude API continuation request failed', { error: error.message })
      throw error
    }
  }

  private getSystemPrompt(tools: MCPTool[]): string {
    const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

    let prompt = `あなたはMaidel 2.1のAIアシスタント「クロコ」です。

現在の日時: ${currentTime} (日本時間)

あなたの役割:
- ユーザーの予定管理をサポートする執事のような存在
- 自然言語でカレンダー操作を行う
- 丁寧で親しみやすい日本語で応答する
- 時間に関する質問では常にJST(+09:00)を基準とする

基本的な応答スタイル:
- 「〜です」「〜します」などの丁寧語を使用
- ユーザーに対して敬語で接する
- 必要に応じて確認を取る`

    if (tools.length > 0) {
      prompt += `\n\n利用可能なツール:\n${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}`
    }

    return prompt
  }

  private async makeRequest(endpoint: string, data: any): Promise<ClaudeResponse> {
    const url = `${this.baseURL}${endpoint}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Claude API error (${response.status}): ${errorData.error?.message || response.statusText}`)
    }

    return await response.json()
  }

  // Utility method to extract text content from response
  getTextContent(response: ClaudeResponse): string {
    return response.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('')
  }

  // Utility method to check if response contains tool use
  hasToolUse(response: ClaudeResponse): boolean {
    return response.content.some(content => content.type === 'tool_use')
  }
}