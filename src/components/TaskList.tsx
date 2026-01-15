'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { AsanaTask, GroupedTasks } from '@/lib/asana'
import { TaskDetailModal } from './TaskDetailModal'
import { getTaskDueDateStatus, formatDueDate, formatLastUpdated } from '@/lib/dateUtils'

const REFRESH_INTERVAL = 30000 // 30 seconds

interface TaskListProps {
  initialData: GroupedTasks[]
}

interface SubtaskRowProps {
  task: AsanaTask
  onComplete: (gid: string, completed: boolean) => void
}

function SubtaskRow({ task, onComplete }: SubtaskRowProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleComplete = async () => {
    const newState = !isCompleted
    setIsCompleted(newState)
    setIsUpdating(true)

    try {
      await fetch(`/api/tasks/${task.gid}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newState }),
      })
      onComplete(task.gid, newState)
    } catch {
      setIsCompleted(!newState)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="subtask-row">
      <button
        className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
        onClick={handleComplete}
        disabled={isUpdating}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted && <span className="check-icon">✓</span>}
      </button>
      <span className={`subtask-name ${isCompleted ? 'completed' : ''}`}>
        {task.name}
      </span>
    </div>
  )
}

interface TaskRowProps {
  task: AsanaTask
  onTaskClick: (task: AsanaTask) => void
  onComplete: (gid: string, completed: boolean) => void
}

function TaskRow({ task, onTaskClick, onComplete }: TaskRowProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [subtasks, setSubtasks] = useState<AsanaTask[]>([])
  const [loadingSubtasks, setLoadingSubtasks] = useState(false)

  const hasSubtasks = (task.num_subtasks || 0) > 0
  const dueDateStatus = getTaskDueDateStatus(task.due_on, isCompleted)

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newState = !isCompleted
    setIsCompleted(newState)
    setIsUpdating(true)

    try {
      await fetch(`/api/tasks/${task.gid}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newState }),
      })
      onComplete(task.gid, newState)
    } catch {
      setIsCompleted(!newState)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasSubtasks) return

    if (!isExpanded && subtasks.length === 0) {
      setLoadingSubtasks(true)
      try {
        const res = await fetch(`/api/tasks/${task.gid}/subtasks`)
        const data = await res.json()
        setSubtasks(data.subtasks || [])
      } catch {
        console.error('Failed to load subtasks')
      } finally {
        setLoadingSubtasks(false)
      }
    }

    setIsExpanded(!isExpanded)
  }

  const handleSubtaskComplete = (gid: string, completed: boolean) => {
    setSubtasks(prev =>
      prev.map(st => (st.gid === gid ? { ...st, completed } : st))
    )
  }

  return (
    <>
      <div className={`task-row ${isCompleted ? 'completed' : ''}`}>
        <div className="task-row-left">
          {hasSubtasks ? (
            <button
              className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={handleExpand}
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          ) : (
            <div className="expand-placeholder" />
          )}
          <button
            className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
            onClick={handleComplete}
            disabled={isUpdating}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && <span className="check-icon">✓</span>}
          </button>
          <button className="task-name-btn" onClick={() => onTaskClick(task)}>
            <span className={`task-name ${isCompleted ? 'completed' : ''}`}>
              {task.name}
            </span>
            {hasSubtasks && (
              <span className="subtask-count">{task.num_subtasks} subtasks</span>
            )}
          </button>
        </div>
        <div className="task-row-right">
          {task.due_on && (
            <span className={`task-due-date ${dueDateStatus}`}>
              {formatDueDate(task.due_on)}
            </span>
          )}
          {task.assignee && (
            <span className="task-assignee">{task.assignee.name}</span>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="subtasks-container">
          {loadingSubtasks ? (
            <div className="subtasks-loading">Loading...</div>
          ) : subtasks.length > 0 ? (
            subtasks.map(st => (
              <SubtaskRow
                key={st.gid}
                task={st}
                onComplete={handleSubtaskComplete}
              />
            ))
          ) : (
            <div className="subtasks-empty">No subtasks</div>
          )}
        </div>
      )}
    </>
  )
}

interface SectionProps {
  section: { gid: string; name: string }
  tasks: AsanaTask[]
  onTaskClick: (task: AsanaTask) => void
  onComplete: (gid: string, completed: boolean) => void
}

function Section({ section, tasks, onTaskClick, onComplete }: SectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const incompleteTasks = tasks.filter(t => !t.completed).length

  return (
    <div className="task-section">
      <button
        className="section-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <svg
          className={`section-chevron ${isCollapsed ? '' : 'expanded'}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
        <span className="section-name">{section.name}</span>
        <span className="section-count">{incompleteTasks}</span>
      </button>
      {!isCollapsed && (
        <div className="section-tasks">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <TaskRow
                key={task.gid}
                task={task}
                onTaskClick={onTaskClick}
                onComplete={onComplete}
              />
            ))
          ) : (
            <div className="section-empty">No tasks in this section</div>
          )}
        </div>
      )}
    </div>
  )
}

export function TaskList({ initialData }: TaskListProps) {
  const [data, setData] = useState(initialData)
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(Date.now())
  const [lastUpdatedText, setLastUpdatedText] = useState('Just now')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTasks = useCallback(async (isManual = false) => {
    if (isRefreshing && !isManual) return

    setIsRefreshing(true)
    try {
      const res = await fetch('/api/tasks')
      const json = await res.json()
      if (json.data) {
        setData(json.data)
        setLastUpdated(Date.now())
      }
    } catch (error) {
      console.error('Failed to refresh tasks:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchTasks(false)
    }, REFRESH_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchTasks])

  // Update "last updated" text every second
  useEffect(() => {
    const updateText = () => {
      setLastUpdatedText(formatLastUpdated(lastUpdated))
    }
    updateText()
    const timer = setInterval(updateText, 1000)
    return () => clearInterval(timer)
  }, [lastUpdated])

  const handleRefresh = useCallback(() => {
    fetchTasks(true)
  }, [fetchTasks])

  const handleComplete = useCallback((gid: string, completed: boolean) => {
    setData(prev =>
      prev.map(group => ({
        ...group,
        tasks: group.tasks.map(task =>
          task.gid === gid ? { ...task, completed } : task
        ),
      }))
    )
  }, [])

  const handleTaskClick = useCallback((task: AsanaTask) => {
    setSelectedTask(task)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedTask(null)
  }, [])

  const handleTaskUpdate = useCallback((gid: string, updates: Partial<AsanaTask>) => {
    setData(prev =>
      prev.map(group => ({
        ...group,
        tasks: group.tasks.map(task =>
          task.gid === gid ? { ...task, ...updates } : task
        ),
      }))
    )
    if (selectedTask?.gid === gid) {
      setSelectedTask(prev => (prev ? { ...prev, ...updates } : null))
    }
  }, [selectedTask])

  return (
    <div className="task-list-wrapper">
      <div className="task-list-toolbar">
        <span className="last-updated">Updated {lastUpdatedText}</span>
        <button
          className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh tasks"
        >
          <svg
            className="refresh-icon"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M1.5 7a5.5 5.5 0 1 0 1.1-3.3M1.5 1.5v2.2h2.2" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      <div className="task-list-container">
        {data.map(({ section, tasks }) => (
          <Section
            key={section.gid}
            section={section}
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onComplete={handleComplete}
          />
        ))}
      </div>
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={handleCloseModal}
          onUpdate={handleTaskUpdate}
        />
      )}
    </div>
  )
}
