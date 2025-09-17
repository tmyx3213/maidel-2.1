import React from 'react'
import ChatWindow from './components/Chat/ChatWindow'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Maidel 2.1</h1>
          <span className="app-subtitle">AI-powered Personal Assistant</span>
        </div>
        <div className="app-status">
          <div className="status-indicator online"></div>
          <span>オンライン</span>
        </div>
      </header>
      <main className="app-main">
        <ChatWindow />
      </main>
    </div>
  )
}

export default App