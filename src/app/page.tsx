'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from '@/components/Toast'
import { SuggestionCardsContainer, type Suggestion } from '@/components/SuggestionCard'
import { Package, AlertCircle, ClipboardList, Trash2, FileText, RotateCcw, ArrowRightCircle, Sparkles, RefreshCw } from 'lucide-react'

interface TokenUsage {
  input: number
  output: number
  total: number
  cost: number
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  activeTool?: string | null
  suggestions?: Suggestion[]
  usage?: TokenUsage
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

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low']

// localStorage keys and TTL for persistence across tab switches
const SUGGESTIONS_CACHE_KEY = 'dashboard_suggestions'
const SUGGESTIONS_CACHE_TIME_KEY = 'dashboard_suggestions_time'
const SUGGESTIONS_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const ACTIVE_CHAT_SESSION_KEY = 'active_chat_session'
const CHAT_DRAFT_KEY = 'chat_draft'

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

  // Welcome experience state
  const [showWelcome, setShowWelcome] = useState(true)
  const [backgroundSuggestions, setBackgroundSuggestions] = useState<Suggestion[] | null>(null)
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats>({ totalDeals: 0, overdueTasks: 0, pendingReviews: 0 })
  const [greeting, setGreeting] = useState('Good day')

  // Activity drawer state
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [activityData, setActivityData] = useState<Array<{
    type: string
    name: string
    time: string
    relative: string
    metadata?: {
      count?: number
      companies?: string[]
      to_stage?: string
    }
  }>>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const isLoadingActivityRef = useRef(false)

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

  // Fetch overdue tasks count for stats
  const fetchOverdueTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/bulk-analyze', { method: 'POST' })
      const data = await res.json()
      const overdueCount = (data.overdue || []).length
      setStats(prev => ({ ...prev, overdueTasks: overdueCount }))
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
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

  // Build conversational greeting message
  const buildConversationalGreeting = useCallback((suggestions: Suggestion[]) => {
    const hour = new Date().getHours()
    const timeGreeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

    if (!suggestions || suggestions.length === 0) {
      return `Hey Nick 👋 You're all caught up! Nothing urgent on your radar.\n\nWhat would you like to work on?`
    }

    // Sort by priority (critical first, then high, etc.)
    const sorted = [...suggestions].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
    })

    // Get top 3 priorities
    const top3 = sorted.slice(0, 3)
    const total = suggestions.length

    // Varied, warm greetings that rotate by day of week
    const greetings = [
      `Hey Nick 👋 Here's what's on your radar:`,
      `Good ${timeGreeting}, Nick! A few things need attention:`,
      `Hey Nick 👋 Quick ${timeGreeting} update:`,
      `Hi Nick! Here's your priority list:`,
      `Good ${timeGreeting} Nick 👋 Here's what needs attention:`,
      `Hey Nick, here's your ${timeGreeting} briefing:`,
      `Hey Nick 👋 Happy ${timeGreeting}! Here's what's up:`
    ]
    const greetingIndex = new Date().getDay() % greetings.length
    console.log('[GREETING] Day:', new Date().getDay(), 'Index:', greetingIndex, 'Text:', greetings[greetingIndex])

    let content = `${greetings[greetingIndex]}\n\n`
    content += `You've got **${total} item${total !== 1 ? 's' : ''}** to review. Top priorities:\n\n`

    if (top3.length > 0) {
      top3.forEach(s => {
        // Shorten action text to 2-4 words max
        const shortenAction = (title: string): string => {
          const t = title.toLowerCase()
          // Extract stage transitions
          if (t.includes('to closing')) return 'move to closing'
          if (t.includes('to implementation')) return 'advance to implementation'
          if (t.includes('to negotiation')) return 'move to negotiation'
          if (t.includes('to discovery')) return 'start discovery'
          // Extract key actions
          if (t.includes('follow up') || t.includes('follow-up')) return 'follow up'
          if (t.includes('schedule')) return 'schedule meeting'
          if (t.includes('send')) return 'send update'
          if (t.includes('review')) return 'needs review'
          // Extract integrations/partnerships
          const integrationMatch = t.match(/(?:progress|advance|discuss)\s+(\w+)\s+integration/i)
          if (integrationMatch) return `${integrationMatch[1]} integration`
          // Default: take first 4 words
          const words = t.split(/\s+/).slice(0, 4).join(' ')
          return words.length > 30 ? words.slice(0, 30) + '...' : words
        }
        content += `• **${s.source.name}** — ${shortenAction(s.title)}\n\n`
      })
    }

    content += `What do you want to tackle?`
    return content
  }, [])

  // Save suggestions to localStorage
  const saveSuggestionsToCache = useCallback((suggestions: Suggestion[]) => {
    try {
      localStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify(suggestions))
      localStorage.setItem(SUGGESTIONS_CACHE_TIME_KEY, Date.now().toString())
    } catch { /* ignore */ }
  }, [])

  // Background refresh - silent, updates state if different
  const refreshSuggestionsInBackground = useCallback(async () => {
    try {
      const res = await fetch('/api/suggestions')
      if (!res.ok) return
      const data = await res.json()
      if (data.suggestions?.length > 0) {
        console.log('[DASHBOARD] Background refresh complete')
        setBackgroundSuggestions(data.suggestions)
        saveSuggestionsToCache(data.suggestions)
      }
    } catch (err) {
      console.error('[DASHBOARD] Background refresh failed:', err)
    }
  }, [saveSuggestionsToCache])

  // Load suggestions - instant from cache, then background refresh
  const loadSuggestions = useCallback(async () => {
    // 1. Try localStorage cache first (instant)
    try {
      const cached = localStorage.getItem(SUGGESTIONS_CACHE_KEY)
      const cacheTime = localStorage.getItem(SUGGESTIONS_CACHE_TIME_KEY)

      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime)
        if (age < SUGGESTIONS_CACHE_TTL) {
          const cachedSuggestions = JSON.parse(cached)
          console.log('[DASHBOARD] Using localStorage cache (age: ' + Math.round(age/1000) + 's)')
          setBackgroundSuggestions(cachedSuggestions)
          setIsLoadingSuggestions(false)
          // Cache is valid - no need to refresh (removes duplicate fetch)
          return cachedSuggestions
        }
      }
    } catch {
      // Cache read failed
    }

    // 2. No valid cache - must fetch (show loading)
    setIsLoadingSuggestions(true)

    try {
      const res = await fetch('/api/suggestions')
      if (!res.ok) {
        if (res.status === 429) {
          addToast('warning', 'Rate limit reached', 'Suggestions will refresh in a few minutes')
        }
        setIsLoadingSuggestions(false)
        return null
      }

      const data = await res.json()
      setIsLoadingSuggestions(false)

      if (data.suggestions?.length > 0) {
        setBackgroundSuggestions(data.suggestions)
        saveSuggestionsToCache(data.suggestions)
      } else {
        setBackgroundSuggestions([])
      }

      return data.suggestions || []
    } catch (error) {
      console.error('Failed to load suggestions:', error)
      setIsLoadingSuggestions(false)
      return null
    }
  }, [addToast, saveSuggestionsToCache, refreshSuggestionsInBackground])

  // Load activity for drawer
  const loadActivity = useCallback(async () => {
    if (isLoadingActivityRef.current) return
    isLoadingActivityRef.current = true
    setIsLoadingActivity(true)
    try {
      const res = await fetch('/api/activity?limit=20')
      if (!res.ok) throw new Error('Failed to load activity')
      const data = await res.json()

      // Format activity items with relative time
      const formatRelativeTime = (dateStr: string) => {
        // Normalize: if no timezone, assume UTC
        const normalized = dateStr.includes('+') || dateStr.includes('Z') ? dateStr : dateStr + 'Z'
        const date = new Date(normalized)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m`
        if (diffHours < 24) return `${diffHours}h`
        return `${diffDays}d`
      }

      interface ActivityApiItem {
        type: string
        title: string
        timestamp: string
        metadata?: {
          count?: number
          companies?: string[]
          to_stage?: string
        }
      }
      const formatted = (data.activities || []).map((item: ActivityApiItem) => ({
        type: item.type.replace(/_/g, ' '),
        name: item.title,
        time: item.timestamp,
        relative: formatRelativeTime(item.timestamp),
        metadata: item.metadata,
      }))

      setActivityData(formatted)
    } catch (err) {
      console.error('Failed to load activity:', err)
    } finally {
      isLoadingActivityRef.current = false
      setIsLoadingActivity(false)
    }
  }, []) // No dependencies - uses ref for guard

  // Open activity drawer - always fetch fresh data
  const openActivityDrawer = useCallback(() => {
    setActivityDrawerOpen(true)
    isLoadingActivityRef.current = false
    setActivityData([])
    loadActivity()
  }, [loadActivity])

  // Initialize on mount
  useEffect(() => {
    fetchStats()
    fetchOverdueTasks()
    fetchSessions()

    // Check for active chat session and restore it
    const activeSessionId = localStorage.getItem(ACTIVE_CHAT_SESSION_KEY)
    if (activeSessionId) {
      loadSession(activeSessionId)
      setShowWelcome(false)
    }

    // Restore draft input text
    const draft = localStorage.getItem(CHAT_DRAFT_KEY)
    if (draft) {
      setInput(draft)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStats, fetchOverdueTasks, fetchSessions])

  // Auto-load suggestions on mount
  useEffect(() => {
    if (messages.length === 0 && !currentSessionId) {
      loadSuggestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId])

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

  // Load messages for a session
  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`)
      const data = await res.json()
      setMessages(data.messages || [])
      setCurrentSessionId(sessionId)
      setShowWelcome(false)
      // Save active session to localStorage for persistence
      localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, sessionId)
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  // Start new chat
  const startNewChat = () => {
    setMessages([])
    setCurrentSessionId(null)
    setShowWelcome(true)
    // Clear active session from localStorage
    localStorage.removeItem(ACTIVE_CHAT_SESSION_KEY)
    // Reload suggestions for welcome screen
    loadSuggestions()
  }

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    localStorage.removeItem(CHAT_DRAFT_KEY) // Clear draft on send
    resetTextareaHeight()
    setIsLoading(true)

    let sessionId = currentSessionId
    const assistantMessageIndex = newMessages.length
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    try {
      // Session management - errors here shouldn't break the chat
      if (!sessionId) {
        sessionId = await createSession(userMessage.content)
        if (sessionId) {
          setCurrentSessionId(sessionId)
          localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, sessionId)
        }
      }

      if (sessionId) {
        await saveMessage(sessionId, 'user', userMessage.content)
      }
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

          const cleanContent = accumulatedContent
            .replace(/\[Using \w+\.\.\.\]\n?/g, '')
            .replace(/\[META:\{.*?\}\]\n?/g, '')
            .replace(/\[DATA_CHANGED\]\n?/g, '')

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

      // Parse metadata from response (includes dataChanged and usage stats)
      let dataChanged = false
      let usage: TokenUsage | undefined
      const metaMatch = accumulatedContent.match(/\[META:(\{.*?\})\]/)
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1])
          dataChanged = meta.dataChanged || false
          usage = meta.usage
        } catch {
          // Failed to parse meta, fallback to old check
          dataChanged = accumulatedContent.includes('[DATA_CHANGED]')
        }
      }

      const finalContent = (accumulatedContent || 'Action completed.')
        .replace(/\[Using \w+\.\.\.\]\n?/g, '')
        .replace(/\[META:\{.*?\}\]\n?/g, '')
        .replace(/\[DATA_CHANGED\]\n?/g, '')

      // Update message with usage info
      if (usage) {
        setMessages(prev => {
          const updated = [...prev]
          updated[assistantMessageIndex] = {
            ...updated[assistantMessageIndex],
            content: finalContent,
            activeTool: null,
            usage,
          }
          return updated
        })
      }

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

      // Only refresh stats if data was actually modified
      if (dataChanged) {
        fetchStats()
        fetchOverdueTasks()
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
    const value = e.target.value
    setInput(value)
    // Save draft to localStorage for persistence across navigation
    if (value) {
      localStorage.setItem(CHAT_DRAFT_KEY, value)
    } else {
      localStorage.removeItem(CHAT_DRAFT_KEY)
    }
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
    fetchOverdueTasks()
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
          New Session
        </button>

        {/* Sidebar Stats */}
        <div className="sidebar-stats">
          <Link href="/deals" className="sidebar-stat">
            <Package size={14} />
            <span>{stats.totalDeals}</span>
          </Link>
          <span className="sidebar-stat-divider">|</span>
          <Link href="/tasks" className={`sidebar-stat ${stats.overdueTasks > 0 ? 'alert' : ''}`}>
            <AlertCircle size={14} />
            <span>{stats.overdueTasks}</span>
          </Link>
          <span className="sidebar-stat-divider">|</span>
          <Link href="/review" className="sidebar-stat">
            <ClipboardList size={14} />
            <span>{stats.pendingReviews}</span>
          </Link>
        </div>

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

        {/* Activity Log Button */}
        <button className="activity-log-btn" onClick={openActivityDrawer}>
          Activity Log
        </button>
      </aside>

      {/* Activity Drawer */}
      {activityDrawerOpen && (
        <>
          <div className="activity-drawer-overlay" onClick={() => setActivityDrawerOpen(false)} />
          <div className="activity-drawer open">
            <div className="activity-drawer-header">
              <span>Activity Log</span>
              <button className="drawer-close" onClick={() => setActivityDrawerOpen(false)}>✕</button>
            </div>
            <div className="activity-drawer-content">
              {isLoadingActivity ? (
                <div className="activity-loading">Loading...</div>
              ) : (
                <>
                  <div className="activity-section">
                    {activityData.length === 0 ? (
                      <div className="activity-empty">No recent activity</div>
                    ) : (
                      activityData.map((item, i) => {
                        const isBulkAction = item.type === 'bulk delete' || item.type === 'bulk stage change'
                        const companies = item.metadata?.companies || []
                        const toStage = item.metadata?.to_stage

                        // Get icon and action text based on type
                        const getActivityDetails = (): { icon: React.ReactNode; action: string } => {
                          switch (item.type) {
                            case 'bulk delete':
                              return { icon: <Trash2 size={16} />, action: `Deleted ${item.metadata?.count || companies.length} deals` }
                            case 'bulk stage change':
                              return { icon: <ArrowRightCircle size={16} />, action: `Moved ${item.metadata?.count || companies.length} deals${toStage ? ` to ${toStage}` : ''}` }
                            case 'deal deleted':
                              return { icon: <Trash2 size={16} />, action: 'Deleted' }
                            case 'deal restored':
                              return { icon: <RotateCcw size={16} />, action: 'Restored' }
                            case 'note added':
                              return { icon: <FileText size={16} />, action: 'Added note to' }
                            case 'task completed':
                              return { icon: <ClipboardList size={16} />, action: 'Completed' }
                            case 'task created':
                              return { icon: <ClipboardList size={16} />, action: 'Created task' }
                            case 'deal created':
                              return { icon: <Sparkles size={16} />, action: 'Created' }
                            case 'deal updated':
                              return { icon: <RefreshCw size={16} />, action: 'Updated' }
                            default:
                              return { icon: <Package size={16} />, action: item.type }
                          }
                        }

                        const { icon, action } = getActivityDetails()
                        const showCompanyList = isBulkAction && companies.length > 0

                        return (
                          <div key={i} className="activity-card">
                            <div className="activity-card-header">
                              <span className="activity-icon">{icon}</span>
                              <span className="activity-action">
                                {isBulkAction ? action : `${action} ${item.name}`}
                              </span>
                              <span className="activity-time">{item.relative}</span>
                            </div>
                            {showCompanyList && (
                              <div className="activity-card-body">
                                <span className="activity-companies-preview">
                                  {companies.slice(0, 3).join(', ')}
                                  {companies.length > 3 && `, +${companies.length - 3} more`}
                                </span>
                                {companies.length > 3 && (
                                  <details className="activity-expand">
                                    <summary>View all deals</summary>
                                    <ul className="activity-companies-list">
                                      {companies.map((c, j) => (
                                        <li key={j}>{c}</li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            )}
                            {!isBulkAction && item.type === 'note added' && (
                              <div className="activity-card-subtitle">
                                Note added to deal
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="system-status">
                    <div className="system-status-divider" />
                    <div className="activity-section-label">System Status</div>
                    <div className="status-item">
                      <span className="status-icon">✅</span>
                      <span>Asana: {stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : 'synced'}</span>
                    </div>
                    <div className="status-item">
                      <span className="status-icon">✅</span>
                      <span>Suggestions: active</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Center - Main Chat */}
      <section className="chat-center">
        {/* Chat Container */}
        <div className="chat-container-glass">
          <div className="chat-messages">
            {showWelcome && messages.length === 0 && !currentSessionId ? (
              <>
                {/* Conversational greeting */}
                <div className="assistant-message welcome-greeting">
                  <div className="markdown-content">
                    {isLoadingSuggestions && !backgroundSuggestions ? (
                      <div className="welcome-loading">
                        <span className="welcome-loading-spinner" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {buildConversationalGreeting(backgroundSuggestions || [])}
                      </ReactMarkdown>
                    )}
                  </div>
                  {/* Show all toggle */}
                  {backgroundSuggestions && backgroundSuggestions.length > 3 && !showAllSuggestions && (
                    <button
                      className="show-all-toggle"
                      onClick={() => setShowAllSuggestions(true)}
                    >
                      View {backgroundSuggestions.filter(s => !dismissedSuggestions.has(s.id)).length} AI-prioritized items →
                    </button>
                  )}
                </div>
                {/* Show suggestion cards only when expanded */}
                {showAllSuggestions && backgroundSuggestions && backgroundSuggestions.length > 0 && (
                  <div className="welcome-suggestions">
                    <div className="suggestions-header">
                      <span>All items needing attention</span>
                      <button
                        className="collapse-toggle"
                        onClick={() => setShowAllSuggestions(false)}
                      >
                        Collapse
                      </button>
                    </div>
                    <SuggestionCardsContainer
                      suggestions={backgroundSuggestions.filter(s => !dismissedSuggestions.has(s.id))}
                      onDismiss={handleDismissSuggestion}
                      onActionComplete={handleSuggestionActionComplete}
                    />
                  </div>
                )}
              </>
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
                      {/* Show typing indicator when content is empty and loading */}
                      {!message.content && isLoading && !message.activeTool ? (
                        <div className="typing-indicator">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      ) : (
                        <>
                          <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                          </div>
                          {message.activeTool && (
                            <div className="tool-indicator">
                              <span className="tool-spinner" />
                              <span className="tool-name">{message.activeTool}</span>
                            </div>
                          )}
                          {/* Token usage indicator */}
                          {message.usage && (
                            <div
                              className={`token-usage ${message.usage.total > 10000 ? 'high-usage' : ''}`}
                              title={`Input: ${message.usage.input.toLocaleString()} | Output: ${message.usage.output.toLocaleString()}`}
                            >
                              <span className="token-count">{message.usage.total.toLocaleString()} tokens</span>
                              <span className="token-cost">${message.usage.cost.toFixed(4)}</span>
                            </div>
                          )}
                        </>
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
    </div>
  )
}

