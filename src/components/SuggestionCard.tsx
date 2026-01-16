'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'

export interface Suggestion {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'action_item' | 'follow_up' | 'stage_change' | 'task_create' | 'review_needed'
  title: string
  description: string
  source: {
    type: 'deal' | 'note' | 'task' | 'gap_analysis'
    id: string
    name: string
  }
  suggested_action: string
  source_quote?: string
  source_date?: string
  deal_id?: string
  note_id?: string
  task_name?: string
  new_stage?: string
  available_actions: Array<'create_task' | 'open_deal' | 'view_note' | 'change_stage' | 'go_review' | 'dismiss'>
}

interface SuggestionCardProps {
  suggestion: Suggestion
  isExpanded: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onDismiss: (id: string) => void
  onActionComplete?: () => void
}

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
}

const PRIORITY_ICONS = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
}

export function SuggestionCard({
  suggestion,
  isExpanded,
  onMouseEnter,
  onMouseLeave,
  onDismiss,
  onActionComplete,
}: SuggestionCardProps) {
  const router = useRouter()
  const { addToast } = useToast()
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
  const [isDismissing, setIsDismissing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  // Measure content height for animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [isExpanded, suggestion])

  // Format date for display
  const formatSourceDate = (dateStr?: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  // Action handlers
  const handleCreateTask = async () => {
    setIsActionLoading('create_task')
    try {
      const taskName = suggestion.task_name || suggestion.title
      const res = await fetch('/api/asana/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: taskName,
          notes: suggestion.description,
        }),
      })

      if (!res.ok) throw new Error('Failed to create task')

      addToast('success', 'Task created', taskName)
      handleDismiss()
      onActionComplete?.()
    } catch (error) {
      console.error('Failed to create task:', error)
      addToast('error', 'Failed to create task')
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleOpenDeal = () => {
    if (suggestion.deal_id) {
      router.push(`/deals/${suggestion.deal_id}`)
    } else if (suggestion.source.type === 'deal') {
      router.push(`/deals/${suggestion.source.id}`)
    }
  }

  const handleViewNote = () => {
    // For now, navigate to the deal if we have one, or show toast
    if (suggestion.note_id) {
      // Could open a note modal here in the future
      addToast('info', 'Opening note...', suggestion.source.name)
      // If we have a deal_id, go to that deal's page
      if (suggestion.deal_id) {
        router.push(`/deals/${suggestion.deal_id}`)
      }
    }
  }

  const handleChangeStage = async () => {
    if (!suggestion.deal_id || !suggestion.new_stage) {
      addToast('error', 'Missing deal or stage information')
      return
    }

    setIsActionLoading('change_stage')
    try {
      const res = await fetch(`/api/deals/${suggestion.deal_id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: suggestion.new_stage }),
      })

      if (!res.ok) throw new Error('Failed to update stage')

      addToast('success', 'Stage updated', `Moved to ${suggestion.new_stage}`)
      handleDismiss()
      onActionComplete?.()
    } catch (error) {
      console.error('Failed to change stage:', error)
      addToast('error', 'Failed to update stage')
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleGoReview = () => {
    router.push('/review')
  }

  const handleDismiss = () => {
    setIsDismissing(true)
    // Animate out then call onDismiss
    setTimeout(() => {
      onDismiss(suggestion.id)
    }, 300)
  }

  // Get action button config
  const getActionButton = (action: string) => {
    switch (action) {
      case 'create_task':
        return {
          label: suggestion.type === 'follow_up' ? 'Create Follow-up Task' : 'Create Task',
          onClick: handleCreateTask,
          primary: true,
          icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 3v8M3 7h8" />
            </svg>
          ),
        }
      case 'open_deal':
        return {
          label: 'Open Deal',
          onClick: handleOpenDeal,
          primary: false,
          icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 11L11 3M11 3H6M11 3v5" />
            </svg>
          ),
        }
      case 'view_note':
        return {
          label: 'View Note',
          onClick: handleViewNote,
          primary: false,
          icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h10M2 7h7M2 11h4" />
            </svg>
          ),
        }
      case 'change_stage':
        return {
          label: `Move to ${formatStageName(suggestion.new_stage || '')}`,
          onClick: handleChangeStage,
          primary: true,
          icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7h8M8 4l3 3-3 3" />
            </svg>
          ),
        }
      case 'go_review':
        return {
          label: 'Go to Review',
          onClick: handleGoReview,
          primary: true,
          icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="10" height="10" rx="2" />
              <path d="M5 7l2 2 3-3" />
            </svg>
          ),
        }
      case 'dismiss':
        return {
          label: 'Dismiss',
          onClick: handleDismiss,
          primary: false,
          icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l6 6M10 4l-6 6" />
            </svg>
          ),
        }
      default:
        return null
    }
  }

  // Safe accessors with fallbacks
  const priority = suggestion.priority || 'medium'
  const source = suggestion.source || { type: 'deal', id: '', name: 'Unknown' }
  const availableActions = suggestion.available_actions || ['dismiss']

  return (
    <div
      className={`suggestion-card-expandable ${isExpanded ? 'expanded' : ''} ${isDismissing ? 'dismissing' : ''}`}
      style={{
        '--priority-color': PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium,
      } as React.CSSProperties}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Collapsed Header - Always visible */}
      <div className="suggestion-card-header">
        <div className="suggestion-card-priority">
          <span className="priority-icon">{PRIORITY_ICONS[priority] || '⚪'}</span>
        </div>
        <div className="suggestion-card-title-row">
          <span className="suggestion-card-title">{suggestion.title || 'Untitled'}</span>
          {!isExpanded && (
            <span className="suggestion-card-source-compact">{source.name}</span>
          )}
        </div>
        <div className="suggestion-card-chevron">
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>

      {/* Expanded Content */}
      <div
        className="suggestion-card-content"
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="suggestion-card-content-inner">
          {/* Description */}
          <p className="suggestion-card-description">{suggestion.description || ''}</p>

          {/* Source Quote */}
          {suggestion.source_quote && (
            <blockquote className="suggestion-card-quote">
              "{suggestion.source_quote}"
            </blockquote>
          )}

          {/* Source Reference */}
          <div className="suggestion-card-source-ref">
            <span className="source-type">{source.type}:</span>
            <span className="source-name">{source.name}</span>
            {suggestion.source_date && (
              <span className="source-date">• {formatSourceDate(suggestion.source_date)}</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="suggestion-card-actions">
            {availableActions.map((action) => {
              const config = getActionButton(action)
              if (!config) return null

              const isLoading = isActionLoading === action

              return (
                <button
                  key={action}
                  className={`suggestion-action-btn ${config.primary ? 'primary' : 'secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    config.onClick()
                  }}
                  disabled={isActionLoading !== null}
                >
                  {isLoading ? (
                    <span className="action-spinner" />
                  ) : (
                    config.icon
                  )}
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper to format stage names
function formatStageName(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

// Container component that manages which card is expanded
interface SuggestionCardsContainerProps {
  suggestions: Suggestion[]
  onDismiss: (id: string) => void
  onActionComplete?: () => void
}

export function SuggestionCardsContainer({
  suggestions,
  onDismiss,
  onActionComplete,
}: SuggestionCardsContainerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = (id: string) => {
    // Clear any pending collapse
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    setExpandedId(id)
  }

  const handleMouseLeave = () => {
    // Delay collapse by 200ms to prevent flickering
    collapseTimerRef.current = setTimeout(() => {
      setExpandedId(null)
    }, 200)
  }

  const handleDismiss = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    }
    onDismiss(id)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
      }
    }
  }, [])

  // Guard against null/undefined suggestions
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    return null
  }

  // Group suggestions by priority
  const groupedSuggestions = suggestions.reduce((acc: Record<string, Suggestion[]>, s) => {
    const priority = s.priority || 'medium'
    if (!acc[priority]) acc[priority] = []
    acc[priority].push(s)
    return acc
  }, {})

  const priorityOrder = ['critical', 'high', 'medium', 'low']

  return (
    <div className="suggestion-cards-container">
      {priorityOrder.map((priority) => {
        const items = groupedSuggestions[priority]
        if (!items || items.length === 0) return null

        return (
          <div key={priority} className="suggestion-priority-section">
            {items.map((suggestion, index) => {
              const id = suggestion.id || `suggestion-${priority}-${index}`
              return (
                <SuggestionCard
                  key={id}
                  suggestion={{ ...suggestion, id }}
                  isExpanded={expandedId === id}
                  onMouseEnter={() => handleMouseEnter(id)}
                  onMouseLeave={handleMouseLeave}
                  onDismiss={handleDismiss}
                  onActionComplete={onActionComplete}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
