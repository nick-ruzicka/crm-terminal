/**
 * Date and stage formatting utilities
 * Consolidates duplicate formatting functions from across the codebase
 */

// Stage labels for display
export const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  discovery: 'Discovery',
  evaluation: 'Evaluation',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

/**
 * Format a stage name for display
 * Converts snake_case to Title Case with proper labels
 */
export function formatStageName(stage: string | null): string {
  if (!stage) return 'Unknown'
  return STAGE_LABELS[stage] || stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Get due date status for deals (3-day threshold for "soon")
 */
export function getDealDueDateStatus(dueDate: string | null): 'overdue' | 'soon' | 'normal' {
  if (!dueDate) return 'normal'

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'soon'
  return 'normal'
}

/**
 * Get due date status for tasks (7-day threshold for "week", includes "today")
 */
export function getTaskDueDateStatus(
  dueOn: string | null,
  completed: boolean
): 'overdue' | 'today' | 'week' | 'normal' {
  if (!dueOn || completed) return 'normal'

  const due = new Date(dueOn)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'normal'
}

/**
 * Format a due date for display
 * Returns "Today", "Tomorrow", or short date format
 */
export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Format a due date for deals (returns em-dash for null)
 */
export function formatDealDueDate(dueDate: string | null): string {
  if (!dueDate) return '—'
  return formatDueDate(dueDate)
}

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Format seconds elapsed as relative time (for last updated displays)
 */
export function formatLastUpdated(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes === 1) return '1 min ago'
  return `${minutes} mins ago`
}
