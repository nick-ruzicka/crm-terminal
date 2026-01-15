'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import type { AsanaTask, GroupedTasks } from '@/lib/asana'
import { TaskDetailModal } from './TaskDetailModal'

const SECTION_COLORS: Record<string, string> = {
  'To Do': '#6b7280',
  'In Progress': '#3b82f6',
  'In Review': '#8b5cf6',
  'Blocked': '#ef4444',
  'Done': '#10b981',
  'Backlog': '#6b7280',
}

const REFRESH_INTERVAL = 30000

interface TaskBoardProps {
  initialData: GroupedTasks[]
}

function getDueDateStatus(dueOn: string | null, completed: boolean): 'overdue' | 'today' | 'week' | 'normal' {
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

function formatDueDate(dueOn: string | null): string {
  if (!dueOn) return ''
  const date = new Date(dueOn)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface TaskCardProps {
  task: AsanaTask
  index: number
  onClick: (task: AsanaTask) => void
}

function TaskCard({ task, index, onClick }: TaskCardProps) {
  const dueStatus = getDueDateStatus(task.due_on, task.completed)
  const hasSubtasks = (task.num_subtasks || 0) > 0

  return (
    <Draggable draggableId={task.gid} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`board-card task-card ${snapshot.isDragging ? 'dragging' : ''} ${dueStatus} ${task.completed ? 'completed' : ''}`}
          onClick={() => onClick(task)}
        >
          <div className="card-content">
            <span className={`card-title ${task.completed ? 'completed' : ''}`}>
              {task.name}
            </span>
          </div>
          <div className="card-footer">
            <div className="card-meta">
              {task.due_on && (
                <span className={`card-due-date ${dueStatus}`}>
                  {formatDueDate(task.due_on)}
                </span>
              )}
              {hasSubtasks && (
                <span className="card-subtasks">
                  {task.num_subtasks} subtask{task.num_subtasks !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {task.assignee && (
              <div className="card-assignee" title={task.assignee.name}>
                {getInitials(task.assignee.name)}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}

interface SectionColumnProps {
  section: { gid: string; name: string }
  tasks: AsanaTask[]
  onTaskClick: (task: AsanaTask) => void
}

function SectionColumn({ section, tasks, onTaskClick }: SectionColumnProps) {
  const incompleteTasks = tasks.filter(t => !t.completed).length
  const color = SECTION_COLORS[section.name] || '#6b7280'

  return (
    <div className="board-column">
      <div className="column-header" style={{ borderTopColor: color }}>
        <span className="column-title">{section.name}</span>
        <span className="column-count">{incompleteTasks}</span>
      </div>
      <Droppable droppableId={section.gid}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-content ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.gid} task={task} index={index} onClick={onTaskClick} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

function formatLastUpdated(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes === 1) return '1 min ago'
  return `${minutes} mins ago`
}

export function TaskBoard({ initialData }: TaskBoardProps) {
  const [data, setData] = useState(initialData)
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
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

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return
    }

    const taskGid = draggableId
    const newSectionGid = destination.droppableId
    const oldSectionGid = source.droppableId

    // Find the task and move it optimistically
    const task = data
      .flatMap(g => g.tasks)
      .find(t => t.gid === taskGid)

    if (!task) return

    // Optimistic update
    setData(prev => {
      const newData = prev.map(group => {
        if (group.section.gid === oldSectionGid) {
          return {
            ...group,
            tasks: group.tasks.filter(t => t.gid !== taskGid),
          }
        }
        if (group.section.gid === newSectionGid) {
          const newTasks = [...group.tasks]
          newTasks.splice(destination.index, 0, task)
          return {
            ...group,
            tasks: newTasks,
          }
        }
        return group
      })
      return newData
    })

    // Update via Asana API
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/tasks/${taskGid}/section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_gid: newSectionGid }),
      })

      if (!res.ok) {
        // Revert on error
        setData(prev => {
          const newData = prev.map(group => {
            if (group.section.gid === newSectionGid) {
              return {
                ...group,
                tasks: group.tasks.filter(t => t.gid !== taskGid),
              }
            }
            if (group.section.gid === oldSectionGid) {
              const newTasks = [...group.tasks]
              newTasks.splice(source.index, 0, task)
              return {
                ...group,
                tasks: newTasks,
              }
            }
            return group
          })
          return newData
        })
      }
    } catch {
      // Revert on error
      setData(prev => {
        const newData = prev.map(group => {
          if (group.section.gid === newSectionGid) {
            return {
              ...group,
              tasks: group.tasks.filter(t => t.gid !== taskGid),
            }
          }
          if (group.section.gid === oldSectionGid) {
            const newTasks = [...group.tasks]
            newTasks.splice(source.index, 0, task)
            return {
              ...group,
              tasks: newTasks,
            }
          }
          return group
        })
        return newData
      })
    } finally {
      setIsUpdating(false)
    }
  }, [data])

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
    <div className={`task-board ${isUpdating ? 'updating' : ''}`}>
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
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="board-columns">
          {data.map(({ section, tasks }) => (
            <SectionColumn key={section.gid} section={section} tasks={tasks} onTaskClick={handleTaskClick} />
          ))}
        </div>
      </DragDropContext>
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
