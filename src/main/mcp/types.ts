// MCP Protocol Types (JSON-RPC 2.0 based)

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: any
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: any
  error?: JsonRpcError
}

export interface JsonRpcError {
  code: number
  message: string
  data?: any
}

// MCP Specific Types
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean
  }
  logging?: {
    level?: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'
  }
}

export interface MCPClientCapabilities {
  roots?: {
    listChanged?: boolean
  }
  sampling?: {}
}

export interface InitializeRequest {
  protocolVersion: string
  capabilities: MCPClientCapabilities
  clientInfo: {
    name: string
    version: string
  }
}

export interface InitializeResponse {
  protocolVersion: string
  capabilities: MCPServerCapabilities
  serverInfo: {
    name: string
    version: string
  }
}

export interface ToolsListResponse {
  tools: MCPTool[]
}

export interface ToolCallRequest {
  name: string
  arguments: Record<string, any>
}

export interface ToolCallResponse {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

// Server Configuration
export interface MCPServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

// Server Status
export interface MCPServerStatus {
  name: string
  status: 'initializing' | 'ready' | 'error' | 'disconnected'
  lastError?: string
  tools?: MCPTool[]
}