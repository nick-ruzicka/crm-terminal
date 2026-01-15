'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Greeting Component
export function Greeting({
  pendingReviews,
  tasksDueToday
}: {
  pendingReviews: number
  tasksDueToday: number
}) {
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState('Good day')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setMounted(true)
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')

    setDateStr(new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }))
  }, [])

  if (!mounted) {
    return (
      <div className="greeting-section">
        <h1 className="greeting-title">Good day, Nick</h1>
        <p className="greeting-date">Loading...</p>
      </div>
    )
  }

  return (
    <div className="greeting-section">
      <h1 className="greeting-title">{greeting}, Nick</h1>
      <p className="greeting-date">{dateStr}</p>
      <p className="greeting-summary">
        {pendingReviews > 0 || tasksDueToday > 0 ? (
          <>
            You have{' '}
            {pendingReviews > 0 && (
              <span className="highlight-warning">{pendingReviews} pending review{pendingReviews !== 1 ? 's' : ''}</span>
            )}
            {pendingReviews > 0 && tasksDueToday > 0 && ' and '}
            {tasksDueToday > 0 && (
              <span className="highlight-accent">{tasksDueToday} task{tasksDueToday !== 1 ? 's' : ''} due today</span>
            )}
          </>
        ) : (
          <span className="text-muted">All clear - no urgent items today</span>
        )}
      </p>
    </div>
  )
}

// Quick Actions Component
export function QuickActions() {
  const router = useRouter()

  const handleTodaysFocus = () => {
    router.push('/chat?prompt=' + encodeURIComponent('What should I focus on today based on my deals and tasks?'))
  }

  return (
    <div className="quick-actions">
      <Link href="/deals?new=true" className="quick-action-btn primary">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" />
        </svg>
        New Deal
      </Link>
      <Link href="/review" className="quick-action-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M5 8l2 2 4-4" />
        </svg>
        Review Meetings
      </Link>
      <button onClick={handleTodaysFocus} className="quick-action-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2" />
        </svg>
        Today's Focus
      </button>
    </div>
  )
}

// Pending Reviews Widget
export function PendingReviewsWidget({ count }: { count: number }) {
  return (
    <Link href="/review" className={`widget-card ${count > 0 ? 'warning' : ''}`}>
      <div className="widget-header">
        <div className="widget-icon warning">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="14" height="14" rx="2" />
            <path d="M7 10l2 2 4-4" />
          </svg>
        </div>
        <span className="widget-arrow">→</span>
      </div>
      <div className="widget-content">
        <div className="widget-value">{count}</div>
        <div className="widget-label">Pending Reviews</div>
      </div>
      {count > 0 && (
        <div className="widget-hint">Click to review meetings</div>
      )}
    </Link>
  )
}

// Tasks Due Today Widget
interface TaskDueToday {
  gid: string
  name: string
  assignee?: { name: string } | null
}

export function TasksDueTodayWidget({ tasks }: { tasks: TaskDueToday[] }) {
  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="widget-icon accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6v4l3 2" />
          </svg>
        </div>
        <span className="widget-title">Due Today</span>
      </div>
      <div className="widget-tasks">
        {tasks.length > 0 ? (
          tasks.slice(0, 4).map(task => (
            <div key={task.gid} className="widget-task-item">
              <div className="task-checkbox-small"></div>
              <span className="task-name-small">{task.name}</span>
            </div>
          ))
        ) : (
          <div className="widget-empty">No tasks due today</div>
        )}
      </div>
      {tasks.length > 4 && (
        <Link href="/tasks" className="widget-more">
          +{tasks.length - 4} more tasks
        </Link>
      )}
    </div>
  )
}

// Activity Feed Widget
interface ActivityItem {
  id: string
  type: 'deal_moved' | 'deal_created' | 'task_completed' | 'note_added'
  title: string
  subtitle: string
  timestamp: string
}

export function ActivityFeedWidget({ activities }: { activities: ActivityItem[] }) {
  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'deal_moved':
        return (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7h8M8 4l3 3-3 3" />
          </svg>
        )
      case 'deal_created':
        return (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 3v8M3 7h8" />
          </svg>
        )
      case 'task_completed':
        return (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 7l2 2 4-4" />
          </svg>
        )
      case 'note_added':
        return (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3h8M3 7h6M3 11h4" />
          </svg>
        )
    }
  }

  const getColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'deal_moved': return 'accent'
      case 'deal_created': return 'success'
      case 'task_completed': return 'success'
      case 'note_added': return 'muted'
    }
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="widget-icon muted">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 10h14M3 5h14M3 15h14" />
          </svg>
        </div>
        <span className="widget-title">Recent Activity</span>
      </div>
      <div className="activity-list">
        {activities.length > 0 ? (
          activities.slice(0, 5).map(activity => (
            <div key={activity.id} className="activity-item">
              <div className={`activity-icon ${getColor(activity.type)}`}>
                {getIcon(activity.type)}
              </div>
              <div className="activity-content">
                <div className="activity-title">{activity.title}</div>
                <div className="activity-meta">
                  <span>{activity.subtitle}</span>
                  <span className="activity-time">{activity.timestamp}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="widget-empty">No recent activity</div>
        )}
      </div>
    </div>
  )
}

// Stat Card with hover glow
export function StatCard({
  label,
  value,
  trend,
  color = 'default'
}: {
  label: string
  value: number | string
  trend?: { value: string; direction: 'up' | 'down' }
  color?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <div className={`stat-card-enhanced ${color}`}>
      <h3>{label}</h3>
      <div className="value">{value}</div>
      {trend && (
        <div className={`trend ${trend.direction}`}>
          <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}
