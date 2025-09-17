import React, { useState, useEffect, useRef } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'こんにちは！私はMaidel 2.1のAIアシスタント「クロコ」です。カレンダーの管理や予定の作成をお手伝いします。何かご用はありませんか？',
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }

    setMessages(prev => [...prev, userMessage, loadingMessage])
    setIsLoading(true)

    try {
      // Send message to Claude API via Electron IPC
      const response = await window.electronAPI.sendMessage(content)

      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessage.id
          ? { ...msg, content: response, isLoading: false }
          : msg
      ))
    } catch (error) {
      console.error('Failed to send message:', error)

      setMessages(prev => prev.map(msg =>
        msg.id === loadingMessage.id
          ? {
              ...msg,
              content: '申し訳ございません。メッセージの処理中にエラーが発生しました。後でもう一度お試しください。',
              isLoading: false
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearMessages = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: '会話履歴をクリアしました。新しい話題でお手伝いできることはありませんか？',
      timestamp: new Date()
    }])
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">
          <h2>クロコ</h2>
          <span className="chat-subtitle">Maidel 2.1 AIアシスタント</span>
        </div>
        <button
          className="clear-button"
          onClick={handleClearMessages}
          disabled={isLoading}
        >
          履歴クリア
        </button>
      </div>

      <div className="chat-content">
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

export default ChatWindow