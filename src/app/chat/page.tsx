'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useToast } from '@/components/Toast'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  activeTool?: string | null
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToast()

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
    resetTextareaHeight()
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
      let activeTool: string | null = null

      // Tool name mapping for friendly display
      const toolDisplayNames: Record<string, string> = {
        check_pipeline_health: 'Checking pipeline health',
        analyze_pipeline: 'Analyzing pipeline',
        analyze_tasks: 'Analyzing tasks',
        analyze_notes: 'Analyzing notes',
        find_deal_by_company: 'Searching deals',
        bulk_query_deals: 'Querying deals',
        bulk_delete_deals: 'Deleting deals',
        bulk_update_deals: 'Updating deals',
        create_deal: 'Creating deal',
        update_deal_stage: 'Updating stage',
        delete_deal: 'Deleting deal',
        search_notes: 'Searching notes',
        create_task: 'Creating task',
        complete_task: 'Completing task',
        get_deals_by_stage: 'Getting deals',
        get_stage_counts: 'Counting deals',
      }

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulatedContent += chunk

          // Check for tool indicators in the accumulated content
          const toolMatch = accumulatedContent.match(/\[Using (\w+)\.\.\.\]\n?/)
          if (toolMatch) {
            activeTool = toolDisplayNames[toolMatch[1]] || toolMatch[1].replace(/_/g, ' ')
          }

          // Check if tool completed (new content after tool indicator)
          if (activeTool) {
            const afterTool = accumulatedContent.split(/\[Using \w+\.\.\.\]\n?/).pop() || ''
            // If we have substantial content after the tool indicator, tool is done
            if (afterTool.length > 50) {
              activeTool = null
            }
          }

          // Remove tool indicators from displayed content
          const cleanContent = accumulatedContent.replace(/\[Using \w+\.\.\.\]\n?/g, '')

          // Update the assistant message with clean content and active tool
          setMessages(prev => {
            const updated = [...prev]
            updated[assistantMessageIndex] = {
              role: 'assistant',
              content: cleanContent,
              activeTool,
            }
            return updated
          })
        }
      }

      // Final cleanup - remove tool indicators
      const finalContent = (accumulatedContent || 'Action completed.').replace(/\[Using \w+\.\.\.\]\n?/g, '')

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
    setInput(e.target.value)
  }

  const resetTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
    }
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      // Store the session before removing for potential undo
      const deletedSession = sessions.find(s => s.id === sessionId)

      const response = await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          startNewChat()
        }

        // Show toast with undo action
        addToast('info', 'Chat deleted', undefined, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                const restoreResponse = await fetch(`/api/chat/sessions/${sessionId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ restore: true }),
                })
                const restoreResult = await restoreResponse.json()

                if (restoreResult.restored && deletedSession) {
                  setSessions(prev => [deletedSession, ...prev])
                  addToast('success', 'Chat restored')
                }
              } catch {
                addToast('error', 'Failed to restore chat')
              }
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      addToast('error', 'Failed to delete chat')
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
                      {message.activeTool && (
                        <div className="tool-indicator">
                          <span className="tool-spinner" />
                          <span className="tool-name">{message.activeTool}</span>
                        </div>
                      )}
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
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Ask about your deals..."
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
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
