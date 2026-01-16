'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useToast } from '@/components/Toast'
import { SuggestionCardsContainer, type Suggestion } from '@/components/SuggestionCard'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  activeTool?: string | null
  suggestions?: Suggestion[]
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface DashboardStats {
  totalDeals: number
  overdueTasks: number
  pendingReviews: number
}

interface TaskDue {
  gid: string
  name: string
  due_on: string | null
  linked_deal?: string | null
}

interface ActivityItem {
  id: string
  type: 'deal_created' | 'deal_updated' | 'deal_moved' | 'task_completed' | 'task_created' | 'note_added'
  title: string
  subtitle: string
  timestamp: string
}

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low']

export default function Dashboard() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats>({ totalDeals: 0, overdueTasks: 0, pendingReviews: 0 })
  const [tasksDue, setTasksDue] = useState<TaskDue[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [greeting, setGreeting] = useState('Good day')
  const [isLoadingActivity, setIsLoadingActivity] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToast()

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const [dealsRes, reviewsRes] = await Promise.all([
        fetch('/api/deals'),
        fetch('/api/review/count'),
      ])

      const dealsData = await dealsRes.json()
      const reviewsData = await reviewsRes.json()

      setStats({
        totalDeals: dealsData.deals?.length || 0,
        overdueTasks: 0, // Will be updated by tasks fetch
        pendingReviews: reviewsData.count || 0,
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [])

  // Fetch tasks due soon
  const fetchTasksDue = useCallback(async () => {
    setIsLoadingTasks(true)
    try {
      const res = await fetch('/api/tasks/bulk-analyze', { method: 'POST' })
      const data = await res.json()

      // Combine overdue and due this week
      const overdue = (data.overdue || []).map((t: TaskDue) => ({ ...t, isOverdue: true }))
      const dueThisWeek = data.dueThisWeek || []

      setTasksDue([...overdue, ...dueThisWeek].slice(0, 5))
      setStats(prev => ({ ...prev, overdueTasks: overdue.length }))
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoadingTasks(false)
    }
  }, [])

  // Fetch recent activity from aggregated endpoint
  const fetchRecentActivity = useCallback(async () => {
    setIsLoadingActivity(true)
    try {
      const res = await fetch('/api/activity')
      const data = await res.json()

      const activity: ActivityItem[] = (data.activities || []).map((item: { id: string; type: string; title: string; subtitle: string; timestamp: string }) => ({
        id: item.id,
        type: item.type as ActivityItem['type'],
        title: item.title,
        subtitle: item.subtitle,
        timestamp: formatTimeAgo(item.timestamp),
      }))

      setRecentActivity(activity)
    } catch (error) {
      console.error('Failed to fetch activity:', error)
    } finally {
      setIsLoadingActivity(false)
    }
  }, [])

  // Fetch chat sessions
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

  // Build greeting message with suggestions
  const buildSuggestionsMessage = useCallback((suggestions: Suggestion[]) => {
    // Group by priority
    const grouped = suggestions.reduce((acc: Record<string, Suggestion[]>, s: Suggestion) => {
      if (!acc[s.priority]) acc[s.priority] = []
      acc[s.priority].push(s)
      return acc
    }, {})

    // Build message content
    const criticalCount = grouped.critical?.length || 0
    const highCount = grouped.high?.length || 0
    const totalItems = criticalCount + highCount

    let content = `${greeting}, Nick.\n\n`
    if (totalItems > 0) {
      content += `You have **${totalItems} priority item${totalItems !== 1 ? 's' : ''}** to review:\n\n`
    }

    // Add suggestion summaries by priority
    for (const priority of PRIORITY_ORDER) {
      const items = grouped[priority]
      if (items && items.length > 0) {
        content += `**${priority.charAt(0).toUpperCase() + priority.slice(1)}:**\n`
        items.slice(0, 3).forEach((item: Suggestion) => {
          content += `• ${item.title}\n`
        })
        if (items.length > 3) {
          content += `• _...and ${items.length - 3} more_\n`
        }
        content += '\n'
      }
    }

    content += 'What should we tackle first?'
    return content
  }, [greeting])

  // Load suggestions - try cache first, then generate in background
  const loadSuggestions = useCallback(async () => {
    try {
      // First, try to get cached suggestions (instant)
      const cachedRes = await fetch('/api/suggestions/generate')
      const cachedData = await cachedRes.json()

      if (cachedData.suggestions && cachedData.suggestions.length > 0) {
        // We have cached suggestions - show them immediately
        const content = buildSuggestionsMessage(cachedData.suggestions)
        setMessages([{
          role: 'assistant',
          content,
          suggestions: cachedData.suggestions,
        }])

        // If cache is stale, regenerate in background
        if (cachedData.stale) {
          console.log('[DASHBOARD] Cache is stale, regenerating in background...')
          fetch('/api/suggestions/generate?skip_cache=true', { method: 'POST' })
            .then(res => res.json())
            .then(freshData => {
              if (freshData.suggestions && freshData.suggestions.length > 0) {
                console.log('[DASHBOARD] Fresh suggestions ready, updating UI')
                const freshContent = buildSuggestionsMessage(freshData.suggestions)
                setMessages([{
                  role: 'assistant',
                  content: freshContent,
                  suggestions: freshData.suggestions,
                }])
              }
            })
            .catch(err => console.error('[DASHBOARD] Background refresh failed:', err))
        }
        return cachedData.suggestions
      }

      // No cache - need to generate fresh (show loading state)
      setIsLoadingSuggestions(true)
      console.log('[DASHBOARD] No cache, generating suggestions...')

      const res = await fetch('/api/suggestions/generate?skip_cache=true', { method: 'POST' })
      if (!res.ok) {
        if (res.status === 429) {
          addToast('warning', 'Rate limit reached', 'Suggestions will refresh in a few minutes')
          setIsLoadingSuggestions(false)
          return null
        }
        throw new Error('Failed to load suggestions')
      }

      const data = await res.json()
      setIsLoadingSuggestions(false)

      if (data.suggestions && data.suggestions.length > 0) {
        const content = buildSuggestionsMessage(data.suggestions)
        setMessages([{
          role: 'assistant',
          content,
          suggestions: data.suggestions,
        }])
      }

      return data.suggestions || []
    } catch (error) {
      console.error('Failed to load suggestions:', error)
      setIsLoadingSuggestions(false)
      return null
    }
  }, [addToast, buildSuggestionsMessage])

  // Initialize on mount
  useEffect(() => {
    fetchStats()
    fetchTasksDue()
    fetchRecentActivity()
    fetchSessions()
  }, [fetchStats, fetchTasksDue, fetchRecentActivity, fetchSessions])

  // Auto-load suggestions for new chat
  useEffect(() => {
    if (messages.length === 0 && !currentSessionId) {
      loadSuggestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId])

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

  // Start new chat
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

  // Create session
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

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    resetTextareaHeight()
    setIsLoading(true)

    let sessionId = currentSessionId

    if (!sessionId) {
      sessionId = await createSession(userMessage.content)
      if (sessionId) {
        setCurrentSessionId(sessionId)
      }
    }

    if (sessionId) {
      await saveMessage(sessionId, 'user', userMessage.content)
    }

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

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''
      let activeTool: string | null = null

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

          const toolMatch = accumulatedContent.match(/\[Using (\w+)\.\.\.\]\n?/)
          if (toolMatch) {
            activeTool = toolDisplayNames[toolMatch[1]] || toolMatch[1].replace(/_/g, ' ')
          }

          if (activeTool) {
            const afterTool = accumulatedContent.split(/\[Using \w+\.\.\.\]\n?/).pop() || ''
            if (afterTool.length > 50) {
              activeTool = null
            }
          }

          const cleanContent = accumulatedContent.replace(/\[Using \w+\.\.\.\]\n?/g, '')

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

      const finalContent = (accumulatedContent || 'Action completed.').replace(/\[Using \w+\.\.\.\]\n?/g, '')

      if (sessionId) {
        await saveMessage(sessionId, 'assistant', finalContent)
        setSessions(prev => {
          const updated = prev.find(s => s.id === sessionId)
          if (updated) {
            return [{ ...updated, updated_at: new Date().toISOString() }, ...prev.filter(s => s.id !== sessionId)]
          }
          return prev
        })
      }

      // Refresh stats after chat action
      fetchStats()
      fetchTasksDue()
      fetchRecentActivity()
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

  // Handle suggestion dismissal
  const handleDismissSuggestion = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...Array.from(prev), suggestionId]))
  }

  // Handle action complete - refresh data
  const handleSuggestionActionComplete = () => {
    fetchStats()
    fetchTasksDue()
    fetchRecentActivity()
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const deletedSession = sessions.find(s => s.id === sessionId)

      const response = await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          startNewChat()
        }

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

  // Group sessions by date
  const groupedSessions = sessions.reduce((acc: Record<string, ChatSession[]>, session) => {
    const dateLabel = formatDate(session.updated_at)
    if (!acc[dateLabel]) acc[dateLabel] = []
    acc[dateLabel].push(session)
    return acc
  }, {})

  return (
    <div className="dashboard-chat-layout">
      {/* Left Sidebar - Chat History */}
      <aside className="chat-history-sidebar">
        <button className="new-chat-btn" onClick={startNewChat}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          New Chat
        </button>

        <div className="chat-sessions-grouped">
          {isLoadingSessions ? (
            <div className="sessions-loading">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="sessions-empty">No conversations yet</div>
          ) : (
            Object.entries(groupedSessions).map(([dateLabel, dateSessions]) => (
              <div key={dateLabel} className="session-group">
                <div className="session-group-label">{dateLabel}</div>
                {dateSessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                    onClick={() => loadSession(session.id)}
                  >
                    <span className="session-title">{session.title}</span>
                    <button
                      className="session-delete"
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Center - Main Chat */}
      <section className="chat-center">
        {/* Compact Metrics Bar */}
        <div className="metrics-bar">
          <Link href="/deals" className="metric-pill">
            <span className="metric-value">{stats.totalDeals}</span>
            <span className="metric-label">deals</span>
          </Link>
          <Link href="/tasks" className={`metric-pill ${stats.overdueTasks > 0 ? 'warning' : ''}`}>
            <span className="metric-value">{stats.overdueTasks}</span>
            <span className="metric-label">overdue</span>
          </Link>
          <Link href="/review" className={`metric-pill ${stats.pendingReviews > 0 ? 'accent' : ''}`}>
            <span className="metric-value">{stats.pendingReviews}</span>
            <span className="metric-label">review</span>
          </Link>
        </div>

        {/* Chat Container */}
        <div className="chat-container-glass">
          <div className="chat-messages">
            {isLoadingSuggestions && messages.length === 0 ? (
              <div className="chat-loading-state">
                <div className="loading-greeting">
                  <h2>{greeting}, Nick</h2>
                  <p>Analyzing your pipeline...</p>
                </div>
                <div className="suggestion-skeletons">
                  <div className="suggestion-skeleton" />
                  <div className="suggestion-skeleton" />
                  <div className="suggestion-skeleton" />
                  <div className="suggestion-skeleton" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty-state">
                <h2>{greeting}, Nick</h2>
                <p>How can I help you today?</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.role === 'assistant' ? (
                    <div className="assistant-message">
                      <div className="markdown-content">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      {message.activeTool && (
                        <div className="tool-indicator">
                          <span className="tool-spinner" />
                          <span className="tool-name">{message.activeTool}</span>
                        </div>
                      )}
                      {/* Render expandable suggestion cards if present */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <SuggestionCardsContainer
                          suggestions={message.suggestions.filter(s => !dismissedSuggestions.has(s.id))}
                          onDismiss={handleDismissSuggestion}
                          onActionComplete={handleSuggestionActionComplete}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="user-message">{message.content}</div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input-glass"
              placeholder="Ask anything..."
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              className="send-btn-glass"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <span className="btn-spinner" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12M12 4l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Right Sidebar - Glanceable */}
      <aside className="glanceable-sidebar">
        {/* Due Soon Widget */}
        <div className="glanceable-widget">
          <h3 className="widget-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 1.5" />
            </svg>
            Due Soon
          </h3>
          <div className="widget-list">
            {isLoadingTasks ? (
              <>
                <div className="widget-skeleton" />
                <div className="widget-skeleton" />
                <div className="widget-skeleton" />
              </>
            ) : tasksDue.length > 0 ? (
              tasksDue.map(task => (
                <div key={task.gid} className={`widget-list-item ${(task as TaskDue & { isOverdue?: boolean }).isOverdue ? 'overdue' : ''}`}>
                  <div className="task-checkbox" />
                  <div className="task-info">
                    <span className="task-name">{task.name}</span>
                    <span className="task-due">
                      {task.due_on ? formatDueDate(task.due_on) : 'No date'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="widget-empty">No upcoming deadlines</div>
            )}
          </div>
        </div>

        {/* Recent Activity Widget */}
        <div className="glanceable-widget">
          <h3 className="widget-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8h10M3 4h10M3 12h6" />
            </svg>
            Activity
          </h3>
          <div className="widget-list">
            {isLoadingActivity ? (
              <>
                <div className="widget-skeleton" />
                <div className="widget-skeleton" />
                <div className="widget-skeleton" />
              </>
            ) : recentActivity.length > 0 ? (
              recentActivity.map(activity => (
                <div key={activity.id} className="widget-list-item activity">
                  <div className={`activity-dot ${activity.type}`} />
                  <div className="activity-info">
                    <span className="activity-title">
                      {getActivityLabel(activity.type)}: {activity.title}
                    </span>
                    <span className="activity-meta">{activity.timestamp}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="widget-empty">No recent activity</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

// Helper functions
function getActivityLabel(type: string): string {
  switch (type) {
    case 'deal_created': return 'New deal'
    case 'deal_updated': return 'Deal updated'
    case 'deal_moved': return 'Stage changed'
    case 'note_added': return 'Note added'
    case 'task_completed': return 'Task done'
    case 'task_created': return 'New task'
    default: return 'Updated'
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
