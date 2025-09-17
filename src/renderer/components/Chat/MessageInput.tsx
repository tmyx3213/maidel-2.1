import React, { useState, useRef, KeyboardEvent } from 'react'

interface MessageInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isLoading }) => {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isLoading) {
      onSendMessage(message)
      setMessage('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const suggestionMessages = [
    '今日の予定を教えて',
    '明日の午後2時に会議の予定を入れて',
    '来週の予定を確認して',
    '今日の20時から22時にMaidel開発を追加'
  ]

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion)
    }
  }

  return (
    <div className="message-input-container">
      {message.trim() === '' && (
        <div className="suggestions">
          <div className="suggestions-title">よく使われる質問:</div>
          <div className="suggestions-list">
            {suggestionMessages.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? '処理中...' : 'メッセージを入力してください（Shift+Enterで改行）'}
            disabled={isLoading}
            className="message-textarea"
            rows={1}
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? (
              <div className="loading-spinner">⏳</div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22 2L2 8.667l7.5 3.5L13 19.333L22 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m9.5 12.167 12.5-10.167"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        <div className="input-hint">
          Enterで送信 • Shift+Enterで改行
        </div>
      </form>
    </div>
  )
}

export default MessageInput