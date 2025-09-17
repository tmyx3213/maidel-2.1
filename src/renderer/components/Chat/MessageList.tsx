import React from 'react'
import { Message } from './ChatWindow'

interface MessageListProps {
  messages: Message[]
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.role} ${message.isLoading ? 'loading' : ''}`}
        >
          <div className="message-avatar">
            {message.role === 'user' ? (
              <div className="user-avatar">👤</div>
            ) : (
              <div className="assistant-avatar">🤖</div>
            )}
          </div>

          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">
                {message.role === 'user' ? 'あなた' : 'クロコ'}
              </span>
              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
            </div>

            <div className="message-body">
              {message.isLoading ? (
                <div className="loading-indicator">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="loading-text">考え中...</span>
                </div>
              ) : (
                <div
                  className="message-text"
                  dangerouslySetInnerHTML={{
                    __html: formatContent(message.content)
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default MessageList