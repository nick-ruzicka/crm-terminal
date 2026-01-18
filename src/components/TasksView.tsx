'use client'

import { useState, useEffect, useMemo } from 'react'
import { ViewToggle, type ViewMode } from './ViewToggle'
import { TaskList } from './TaskList'
import { TaskBoard } from './TaskBoard'
import { useToast } from './Toast'
import { DatePicker } from './DatePicker'
import type { GroupedTasks, AsanaSection } from '@/lib/asana'

interface TasksViewProps {
  initialData: GroupedTasks[]
}

type StatusFilter = 'all' | 'incomplete' | 'completed'

export function TasksView({ initialData }: TasksViewProps) {
  const [view, setView] = useState<ViewMode>('list')
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [data, setData] = useState(initialData)
  const { addToast } = useToast()

  // New task modal state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskNotes, setNewTaskNotes] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskSection, setNewTaskSection] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Get sections from data
  const sections: AsanaSection[] = useMemo(() => {
    return data.map(g => g.section)
  }, [data])

  // Filter tasks based on search and status
  const filteredData = useMemo(() => {
    return data.map(group => ({
      ...group,
      tasks: group.tasks.filter(task => {
        // Search filter
        const matchesSearch = searchQuery === '' ||
          task.name.toLowerCase().includes(searchQuery.toLowerCase())

        // Status filter - when filtering for completed, also show tasks with subtasks
        // so users can expand and see completed subtasks
        const hasSubtasks = (task.num_subtasks || 0) > 0
        const matchesStatus = statusFilter === 'all' ||
          (statusFilter === 'completed' && (task.completed || hasSubtasks)) ||
          (statusFilter === 'incomplete' && !task.completed)

        return matchesSearch && matchesStatus
      })
    })).filter(group => group.tasks.length > 0) // Remove empty groups
  }, [data, searchQuery, statusFilter])

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('tasks-view') as ViewMode | null
    if (stored === 'list' || stored === 'board') {
      setView(stored)
    }
  }, [])

  // Sync with initialData changes
  useEffect(() => {
    setData(initialData)
  }, [initialData])

  const handleViewChange = (newView: ViewMode) => {
    setView(newView)
    localStorage.setItem('tasks-view', newView)
  }

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTaskName.trim(),
          notes: newTaskNotes,
          due_on: newTaskDueDate || undefined,
          section_gid: newTaskSection || undefined,
        }),
      })

      if (res.ok) {
        const { task } = await res.json()
        addToast('success', 'Task created')

        // Add task to local data
        if (task) {
          setData(prev => {
            // Find the section to add to (first section if not specified)
            const targetSectionGid = newTaskSection || prev[0]?.section.gid
            return prev.map(group => {
              if (group.section.gid === targetSectionGid) {
                return {
                  ...group,
                  tasks: [task, ...group.tasks],
                }
              }
              return group
            })
          })
        }

        // Reset form and close modal
        setNewTaskName('')
        setNewTaskNotes('')
        setNewTaskDueDate('')
        setNewTaskSection('')
        setShowNewTaskModal(false)
      } else {
        addToast('error', 'Failed to create task')
      }
    } catch {
      addToast('error', 'Failed to create task')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancelNewTask = () => {
    setNewTaskName('')
    setNewTaskNotes('')
    setNewTaskDueDate('')
    setNewTaskSection('')
    setShowNewTaskModal(false)
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
        <div className="view-header-actions">
          <button className="btn btn-primary" onClick={() => setShowNewTaskModal(true)}>
            + New Task
          </button>
          <ViewToggle storageKey="tasks-view" defaultView={view} onChange={handleViewChange} />
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="deals-filter-bar">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="deals-search-input"
        />
        <div className="stage-filter-pills">
          {(['all', 'incomplete', 'completed'] as StatusFilter[]).map(status => (
            <button
              key={status}
              className={`stage-filter-pill ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <TaskList initialData={filteredData} statusFilter={statusFilter} />
      ) : (
        <TaskBoard initialData={filteredData} statusFilter={statusFilter} />
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div className="modal-overlay" onClick={handleCancelNewTask}>
          <div className="modal-drawer new-task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Task</h3>
              <button className="modal-close" onClick={handleCancelNewTask} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="modal-content">
              <div className="edit-form">
                <div className="edit-field">
                  <label className="edit-label">Task name *</label>
                  <input
                    type="text"
                    className="edit-input"
                    value={newTaskName}
                    onChange={e => setNewTaskName(e.target.value)}
                    placeholder="What needs to be done?"
                    autoFocus
                  />
                </div>

                <div className="edit-field">
                  <label className="edit-label">Section</label>
                  <select
                    className="edit-input"
                    value={newTaskSection}
                    onChange={e => setNewTaskSection(e.target.value)}
                  >
                    <option value="">Select a section...</option>
                    {sections.map(section => (
                      <option key={section.gid} value={section.gid}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="edit-field">
                  <label className="edit-label">Due date</label>
                  <DatePicker
                    value={newTaskDueDate}
                    onChange={setNewTaskDueDate}
                    placeholder="No due date"
                    disabled={isCreating}
                  />
                </div>

                <div className="edit-field">
                  <label className="edit-label">Description</label>
                  <textarea
                    className="edit-textarea"
                    value={newTaskNotes}
                    onChange={e => setNewTaskNotes(e.target.value)}
                    placeholder="Add details..."
                    rows={3}
                  />
                </div>

                <div className="edit-actions">
                  <button
                    className="btn-cancel"
                    onClick={handleCancelNewTask}
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={handleCreateTask}
                    disabled={isCreating || !newTaskName.trim()}
                  >
                    {isCreating ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
