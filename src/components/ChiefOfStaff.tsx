'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from './Toast'

interface Suggestion {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'action_item' | 'follow_up' | 'stage_change' | 'task_create' | 'review_needed'
  title: string
  description: string | null
  source: {
    type: string
    id: string
    name: string
  }
  source_quote: string | null
  suggested_action: {
    action: string
    deal_id?: string
    note_id?: string
    task_name?: string
  } | null
  shown_count: number
  escalated_at: string | null
  created_at: string
}

interface SuggestionsResponse {
  suggestions: Suggestion[]
  generated_at: string
  context_summary: {
    total_deals: number
    active_suggestions: number
    critical_count: number
    high_count: number
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

export default function ChiefOfStaff() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { addToast } = useToast()

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true)
    try {
      // Read from database - instant, no generation needed
      const response = await fetch('/api/suggestions')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch suggestions')
      }
      const data: SuggestionsResponse = await response.json()
      setSuggestions(data.suggestions)
      setLastGenerated(data.generated_at)
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
      addToast('error', 'Failed to load suggestions', error instanceof Error ? error.message : undefined)
    } finally {
      setIsLoading(false)
    }
  }, [addToast])

  // Fetch on mount - reading from DB is fast
  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const dismissSuggestion = async (id: string) => {
    // Optimistic update - remove from list immediately
    setSuggestions(prev => prev.filter(s => s.id !== id))

    try {
      await fetch(`/api/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
      // Refetch to restore state
      fetchSuggestions()
    }
  }

  const completeSuggestion = async (id: string) => {
    // Optimistic update
    setSuggestions(prev => prev.filter(s => s.id !== id))

    try {
      await fetch(`/api/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      addToast('success', 'Action completed')
    } catch (error) {
      console.error('Failed to complete suggestion:', error)
      fetchSuggestions()
    }
  }

  const visibleSuggestions = suggestions
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
            onClick={() => fetchSuggestions()}
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
                <div key={suggestion.id} className={`cos-suggestion priority-${suggestion.priority}${suggestion.escalated_at ? ' escalated' : ''}`}>
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
                      {suggestion.escalated_at && (
                        <span className="cos-escalated-badge">escalated</span>
                      )}
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
                  {suggestion.source_quote && (
                    <p className="cos-source-quote">&ldquo;{suggestion.source_quote}&rdquo;</p>
                  )}
                  <div className="cos-suggestion-footer">
                    <span className="cos-source">
                      {suggestion.source.type}: {suggestion.source.name}
                    </span>
                    {suggestion.suggested_action && (
                      <button
                        className="cos-action-btn"
                        onClick={() => completeSuggestion(suggestion.id)}
                        disabled={executingIds.has(suggestion.id)}
                      >
                        {executingIds.has(suggestion.id) ? 'Working...' : suggestion.suggested_action.action}
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
