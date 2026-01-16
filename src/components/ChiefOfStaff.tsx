'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from './Toast'

interface Suggestion {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'action_item' | 'follow_up' | 'stage_change' | 'task_create' | 'review_needed'
  title: string
  description: string
  source: {
    type: 'deal' | 'note' | 'task'
    id: string
    name: string
  }
  suggested_action: string
  one_click_action?: {
    endpoint: string
    method: 'POST' | 'PATCH' | 'DELETE'
    payload: Record<string, unknown>
    confirm_message?: string
  }
}

interface SuggestionsResponse {
  suggestions: Suggestion[]
  generated_at: string
  context_summary: {
    total_deals: number
    active_deals: number
    critical_path_deals: number
    stale_deals: number
    overdue_tasks: number
  }
}

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
}

const TYPE_LABELS = {
  action_item: 'Action',
  follow_up: 'Follow Up',
  stage_change: 'Stage',
  task_create: 'Task',
  review_needed: 'Review',
}

const CACHE_KEY = 'chief_of_staff_suggestions'
const CACHE_TIME_KEY = 'chief_of_staff_time'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export default function ChiefOfStaff() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { addToast } = useToast()

  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    setIsLoading(true)
    try {
      const url = forceRefresh
        ? '/api/suggestions/generate?refresh=true'
        : '/api/suggestions/generate'
      const response = await fetch(url, { method: 'POST' })
      if (!response.ok) {
        const error = await response.json()
        // Handle rate limit errors gracefully
        if (response.status === 429 || error.error?.includes('rate_limit')) {
          addToast('warning', 'Rate limit reached', 'Suggestions will refresh in a few minutes')
          return
        }
        throw new Error(error.error || 'Failed to generate suggestions')
      }
      const data: SuggestionsResponse = await response.json()
      setSuggestions(data.suggestions)
      setLastGenerated(data.generated_at)
      setDismissedIds(new Set())

      // Cache in localStorage for instant load on navigation
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.suggestions))
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString())
      } catch {
        // localStorage might be full or disabled
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
      // Don't show toast for rate limit errors since we already handled them
      if (error instanceof Error && !error.message.includes('rate_limit')) {
        addToast('error', 'Failed to generate suggestions', error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [addToast])

  // Load from cache first, then fetch if stale
  useEffect(() => {
    // Check localStorage for cached suggestions
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY)

      if (cached && cachedTime) {
        const age = Date.now() - parseInt(cachedTime)
        if (age < CACHE_TTL_MS) {
          // Cache is fresh - use it immediately
          setSuggestions(JSON.parse(cached))
          setLastGenerated(new Date(parseInt(cachedTime)).toISOString())
          setIsLoading(false)
          return // Don't fetch
        }
      }
    } catch {
      // localStorage error - continue to fetch
    }

    // No cache or stale - fetch fresh data
    fetchSuggestions()
  }, [fetchSuggestions])

  const dismissSuggestion = (id: string) => {
    setDismissedIds(prev => new Set([...Array.from(prev), id]))
  }

  const executeAction = async (suggestion: Suggestion) => {
    if (!suggestion.one_click_action) return

    const { endpoint, method, payload, confirm_message } = suggestion.one_click_action

    if (confirm_message && !window.confirm(confirm_message)) {
      return
    }

    setExecutingIds(prev => new Set([...Array.from(prev), suggestion.id]))

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Action failed')
      }

      addToast('success', 'Action completed', suggestion.title)
      dismissSuggestion(suggestion.id)
    } catch (error) {
      console.error('Action failed:', error)
      addToast('error', 'Action failed', error instanceof Error ? error.message : undefined)
    } finally {
      setExecutingIds(prev => {
        const next = new Set(prev)
        next.delete(suggestion.id)
        return next
      })
    }
  }

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id))
  const criticalCount = visibleSuggestions.filter(s => s.priority === 'critical').length
  const highCount = visibleSuggestions.filter(s => s.priority === 'high').length

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="chief-of-staff">
      <div className="cos-header">
        <div className="cos-title-row">
          <button
            className="cos-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <h2>Chief of Staff</h2>
          {visibleSuggestions.length > 0 && (
            <div className="cos-badges">
              {criticalCount > 0 && (
                <span className="cos-badge critical">{criticalCount} critical</span>
              )}
              {highCount > 0 && (
                <span className="cos-badge high">{highCount} high</span>
              )}
            </div>
          )}
        </div>
        <div className="cos-actions">
          {lastGenerated && (
            <span className="cos-timestamp">{formatTimeAgo(lastGenerated)}</span>
          )}
          <button
            className="cos-refresh-btn"
            onClick={() => fetchSuggestions(true)}
            disabled={isLoading}
            title="Refresh suggestions"
          >
            {isLoading ? '...' : '↻'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="cos-content">
          {isLoading && suggestions.length === 0 ? (
            <div className="cos-loading">
              <div className="cos-spinner" />
              <span>Analyzing your pipeline...</span>
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div className="cos-empty">
              <span>All caught up! No suggestions right now.</span>
            </div>
          ) : (
            <div className="cos-suggestions">
              {visibleSuggestions.map(suggestion => (
                <div key={suggestion.id} className={`cos-suggestion priority-${suggestion.priority}`}>
                  <div className="cos-suggestion-header">
                    <div className="cos-suggestion-badges">
                      <span
                        className="cos-priority-badge"
                        style={{ backgroundColor: PRIORITY_COLORS[suggestion.priority] }}
                      >
                        {suggestion.priority}
                      </span>
                      <span className="cos-type-badge">
                        {TYPE_LABELS[suggestion.type]}
                      </span>
                    </div>
                    <button
                      className="cos-dismiss-btn"
                      onClick={() => dismissSuggestion(suggestion.id)}
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                  <h3 className="cos-suggestion-title">{suggestion.title}</h3>
                  <p className="cos-suggestion-desc">{suggestion.description}</p>
                  <div className="cos-suggestion-footer">
                    <span className="cos-source">
                      {suggestion.source.type}: {suggestion.source.name}
                    </span>
                    {suggestion.one_click_action && (
                      <button
                        className="cos-action-btn"
                        onClick={() => executeAction(suggestion)}
                        disabled={executingIds.has(suggestion.id)}
                      >
                        {executingIds.has(suggestion.id) ? 'Working...' : suggestion.suggested_action}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
