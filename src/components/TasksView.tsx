'use client'

import { useState, useEffect } from 'react'
import { ViewToggle, type ViewMode } from './ViewToggle'
import { TaskList } from './TaskList'
import { TaskBoard } from './TaskBoard'
import type { GroupedTasks } from '@/lib/asana'

interface TasksViewProps {
  initialData: GroupedTasks[]
}

export function TasksView({ initialData }: TasksViewProps) {
  const [view, setView] = useState<ViewMode>('list')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('tasks-view') as ViewMode | null
    if (stored === 'list' || stored === 'board') {
      setView(stored)
    }
  }, [])

  const handleViewChange = (newView: ViewMode) => {
    setView(newView)
    localStorage.setItem('tasks-view', newView)
  }

  if (!mounted) {
    return (
      <div className="tasks-view">
        <div className="view-header">
          <h1>Tasks</h1>
          <ViewToggle storageKey="tasks-view" defaultView="list" />
        </div>
        <div className="loading-placeholder">Loading...</div>
      </div>
    )
  }

  return (
    <div className="tasks-view">
      <div className="view-header">
        <h1>Tasks</h1>
        <ViewToggle storageKey="tasks-view" defaultView={view} onChange={handleViewChange} />
      </div>
      {view === 'list' ? (
        <TaskList initialData={initialData} />
      ) : (
        <TaskBoard initialData={initialData} />
      )}
    </div>
  )
}
