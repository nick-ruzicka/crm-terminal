'use client'

import { useState, useEffect } from 'react'
import type { AsanaTask } from '@/lib/asana'

interface TaskDetailModalProps {
  task: AsanaTask
  onClose: () => void
  onUpdate: (gid: string, updates: Partial<AsanaTask>) => void
}

export function TaskDetailModal({ task, onClose, onUpdate }: TaskDetailModalProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [isUpdating, setIsUpdating] = useState(false)
  const [subtasks, setSubtasks] = useState<AsanaTask[]>([])
  const [loadingSubtasks, setLoadingSubtasks] = useState(true)
  const [fullNotes, setFullNotes] = useState(task.notes || '')

  useEffect(() => {
    async function loadTaskData() {
      try {
        const res = await fetch(`/api/tasks/${task.gid}`)
        const data = await res.json()
        if (data.task) {
          setSubtasks(data.task.subtasks || [])
          setFullNotes(data.task.notes || '')
        }
      } catch {
        console.error('Failed to load task details')
      } finally {
        setLoadingSubtasks(false)
      }
    }
    loadTaskData()
  }, [task.gid])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

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
      onUpdate(task.gid, { completed: newState })
    } catch {
      setIsCompleted(!newState)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSubtaskComplete = async (subtask: AsanaTask) => {
    const newState = !subtask.completed
    setSubtasks(prev =>
      prev.map(st => (st.gid === subtask.gid ? { ...st, completed: newState } : st))
    )

    try {
      await fetch(`/api/tasks/${subtask.gid}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newState }),
      })
    } catch {
      setSubtasks(prev =>
        prev.map(st => (st.gid === subtask.gid ? { ...st, completed: !newState } : st))
      )
    }
  }

  const sectionName = task.memberships?.[0]?.section?.name || 'No section'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-drawer" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="modal-title-row">
            <button
              className={`task-checkbox large ${isCompleted ? 'checked' : ''}`}
              onClick={handleComplete}
              disabled={isUpdating}
            >
              {isCompleted && <span className="check-icon">✓</span>}
            </button>
            <h2 className={`modal-title ${isCompleted ? 'completed' : ''}`}>
              {task.name}
            </h2>
          </div>

          <div className="modal-meta">
            <div className="meta-item">
              <span className="meta-label">Section</span>
              <span className="meta-value">{sectionName}</span>
            </div>
            {task.assignee && (
              <div className="meta-item">
                <span className="meta-label">Assignee</span>
                <span className="meta-value">{task.assignee.name}</span>
              </div>
            )}
            {task.due_on && (
              <div className="meta-item">
                <span className="meta-label">Due date</span>
                <span className="meta-value">
                  {new Date(task.due_on).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {fullNotes && (
            <div className="modal-section">
              <h3 className="section-label">Description</h3>
              <div className="modal-description">{fullNotes}</div>
            </div>
          )}

          <div className="modal-section">
            <h3 className="section-label">
              Subtasks
              {subtasks.length > 0 && (
                <span className="subtask-progress">
                  {subtasks.filter(s => s.completed).length}/{subtasks.length}
                </span>
              )}
            </h3>
            {loadingSubtasks ? (
              <div className="subtasks-loading">Loading subtasks...</div>
            ) : subtasks.length > 0 ? (
              <div className="modal-subtasks">
                {subtasks.map(subtask => (
                  <div key={subtask.gid} className="modal-subtask">
                    <button
                      className={`task-checkbox ${subtask.completed ? 'checked' : ''}`}
                      onClick={() => handleSubtaskComplete(subtask)}
                    >
                      {subtask.completed && <span className="check-icon">✓</span>}
                    </button>
                    <span className={`subtask-name ${subtask.completed ? 'completed' : ''}`}>
                      {subtask.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-subtasks">No subtasks</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
