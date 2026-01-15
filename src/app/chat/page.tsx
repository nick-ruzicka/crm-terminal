'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch sessions on mount
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Load messages for a session
  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`)
      const data = await res.json()
      setMessages(data.messages || [])
      setCurrentSessionId(sessionId)
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  // Create new chat
  const startNewChat = () => {
    setMessages([])
    setCurrentSessionId(null)
  }

  // Save message to database
  const saveMessage = async (sessionId: string, role: 'user' | 'assistant', content: string) => {
    try {
      await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      })
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }

  // Create session with title from first message
  const createSession = async (firstMessage: string) => {
    try {
      const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const data = await res.json()
      if (data.session) {
        setSessions(prev => [data.session, ...prev])
        return data.session.id
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
    return null
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    let sessionId = currentSessionId

    // Create new session if this is the first message
    if (!sessionId) {
      sessionId = await createSession(userMessage.content)
      if (sessionId) {
        setCurrentSessionId(sessionId)
      }
    }

    // Save user message
    if (sessionId) {
      await saveMessage(sessionId, 'user', userMessage.content)
    }

    // Add empty assistant message that we'll stream into
    const assistantMessageIndex = newMessages.length
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Request failed')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulatedContent += chunk

          // Update the assistant message with accumulated content
          setMessages(prev => {
            const updated = [...prev]
            updated[assistantMessageIndex] = {
              role: 'assistant',
              content: accumulatedContent,
            }
            return updated
          })
        }
      }

      const finalContent = accumulatedContent || 'Action completed.'

      // Save assistant message
      if (sessionId) {
        await saveMessage(sessionId, 'assistant', finalContent)
        // Update session in list (move to top)
        setSessions(prev => {
          const updated = prev.find(s => s.id === sessionId)
          if (updated) {
            return [{ ...updated, updated_at: new Date().toISOString() }, ...prev.filter(s => s.id !== sessionId)]
          }
          return prev
        })
      }
    } catch (error) {
      const errorContent = error instanceof Error ? `Error: ${error.message}` : 'Failed to connect to the server.'
      setMessages(prev => {
        const updated = [...prev]
        updated[assistantMessageIndex] = {
          role: 'assistant',
          content: errorContent,
        }
        return updated
      })
      if (sessionId) {
        await saveMessage(sessionId, 'assistant', errorContent)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (currentSessionId === sessionId) {
        startNewChat()
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="chat-page-layout">
      {/* Sidebar */}
      <div className={`chat-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="chat-sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            + New Chat
          </button>
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? '«' : '»'}
          </button>
        </div>

        {isSidebarOpen && (
          <div className="chat-sessions-list">
            {isLoadingSessions ? (
              <div className="sessions-loading">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="sessions-empty">No conversations yet</div>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  className={`chat-session-item ${currentSessionId === session.id ? 'active' : ''}`}
                  onClick={() => loadSession(session.id)}
                >
                  <div className="session-title">{session.title}</div>
                  <div className="session-meta">
                    <span className="session-date">{formatDate(session.updated_at)}</span>
                    <button
                      className="session-delete"
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Delete conversation"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          {!isSidebarOpen && (
            <button
              className="sidebar-toggle-floating"
              onClick={() => setIsSidebarOpen(true)}
              title="Show history"
            >
              ≡
            </button>
          )}
          <h1>CRM Assistant</h1>
        </div>

        <div className="card chat-container">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <p>Ask me anything about your deals, contacts, or notes.</p>
                <div className="chat-suggestions">
                  {[
                    'How many deals are in the pipeline?',
                    'Show deals in Proposal stage',
                    'What deals are due this week?',
                    'Summarize recent notes',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="chat-suggestion-btn"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              placeholder="Ask about your deals..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
