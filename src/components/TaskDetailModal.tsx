'use client'

import { useState, useEffect } from 'react'
import type { AsanaTask } from '@/lib/asana'
import { useToast } from './Toast'
import { DatePicker } from './DatePicker'

interface TaskDetailModalProps {
  task: AsanaTask
  onClose: () => void
  onUpdate: (gid: string, updates: Partial<AsanaTask>) => void
  onDelete?: (gid: string) => void
}

export function TaskDetailModal({ task, onClose, onUpdate, onDelete }: TaskDetailModalProps) {
  const [isCompleted, setIsCompleted] = useState(task.completed)
  const [isUpdating, setIsUpdating] = useState(false)
  const [subtasks, setSubtasks] = useState<AsanaTask[]>([])
  const [loadingSubtasks, setLoadingSubtasks] = useState(true)
  const [fullNotes, setFullNotes] = useState(task.notes || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { addToast } = useToast()

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(task.name)
  const [editNotes, setEditNotes] = useState(task.notes || '')
  const [editDueDate, setEditDueDate] = useState(task.due_on || '')
  const [isSaving, setIsSaving] = useState(false)

  // New subtask state
  const [showNewSubtask, setShowNewSubtask] = useState(false)
  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('')
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false)
  const [deletingSubtaskId, setDeletingSubtaskId] = useState<string | null>(null)

  useEffect(() => {
    async function loadTaskData() {
      try {
        const res = await fetch(`/api/tasks/${task.gid}`)
        const data = await res.json()
        if (data.task) {
          setSubtasks(data.task.subtasks || [])
          setFullNotes(data.task.notes || '')
          setEditNotes(data.task.notes || '')
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
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
          // Reset edit values
          setEditName(task.name)
          setEditNotes(fullNotes)
          setEditDueDate(task.due_on || '')
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, isEditing, task.name, fullNotes, task.due_on])

  const handleComplete = async () => {
    const newState = !isCompleted
    setIsCompleted(newState)
    setIsUpdating(true)

    try {
      await fetch(`/api/tasks/${task.gid}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newState, taskName: task.name }),
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
        body: JSON.stringify({ completed: newState, taskName: subtask.name }),
      })
    } catch {
      setSubtasks(prev =>
        prev.map(st => (st.gid === subtask.gid ? { ...st, completed: !newState } : st))
      )
    }
  }

  const handleCreateSubtask = async () => {
    if (!newSubtaskName.trim()) return

    setIsCreatingSubtask(true)
    try {
      const res = await fetch(`/api/tasks/${task.gid}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubtaskName.trim(),
          parentTaskName: task.name,
          due_on: newSubtaskDueDate || undefined,
        }),
      })

      if (res.ok) {
        const { subtask } = await res.json()
        setSubtasks(prev => [...prev, { ...subtask, completed: false, due_on: newSubtaskDueDate || null }])
        setNewSubtaskName('')
        setNewSubtaskDueDate('')
        setShowNewSubtask(false)
        addToast('success', 'Subtask added')
      } else {
        addToast('error', 'Failed to create subtask')
      }
    } catch {
      addToast('error', 'Failed to create subtask')
    } finally {
      setIsCreatingSubtask(false)
    }
  }

  const handleDeleteSubtask = async (subtask: AsanaTask) => {
    setDeletingSubtaskId(subtask.gid)
    try {
      const res = await fetch(`/api/tasks/${subtask.gid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: subtask.name }),
      })

      if (res.ok) {
        setSubtasks(prev => prev.filter(st => st.gid !== subtask.gid))
        addToast('success', 'Subtask deleted')
      } else {
        addToast('error', 'Failed to delete subtask')
      }
    } catch {
      addToast('error', 'Failed to delete subtask')
    } finally {
      setDeletingSubtaskId(null)
    }
  }

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreatingSubtask) {
      e.preventDefault()
      handleCreateSubtask()
    } else if (e.key === 'Escape') {
      setNewSubtaskName('')
      setNewSubtaskDueDate('')
      setShowNewSubtask(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${task.gid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: task.name }),
      })

      if (res.ok) {
        addToast('success', 'Task deleted')
        onDelete?.(task.gid)
        onClose()
      } else {
        addToast('error', 'Failed to delete task')
      }
    } catch {
      addToast('error', 'Failed to delete task')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/tasks/${task.gid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          notes: editNotes,
          due_on: editDueDate || null,
        }),
      })

      if (res.ok) {
        addToast('success', 'Task updated')
        onUpdate(task.gid, {
          name: editName,
          notes: editNotes,
          due_on: editDueDate || null,
        })
        setFullNotes(editNotes)
        setIsEditing(false)
      } else {
        addToast('error', 'Failed to update task')
      }
    } catch {
      addToast('error', 'Failed to update task')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName(task.name)
    setEditNotes(fullNotes)
    setEditDueDate(task.due_on || '')
  }

  const sectionName = task.memberships?.[0]?.section?.name || 'No section'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-drawer" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <button
            className="modal-delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete task"
            title="Delete task"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          {!isEditing && (
            <button
              className="modal-edit-btn"
              onClick={() => setIsEditing(true)}
              aria-label="Edit task"
              title="Edit task"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          {isEditing ? (
            // Edit mode
            <>
              <div className="edit-form">
                <div className="edit-field">
                  <label className="edit-label">Task name</label>
                  <input
                    type="text"
                    className="edit-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Task name"
                  />
                </div>

                <div className="edit-field">
                  <label className="edit-label">Due date</label>
                  <DatePicker
                    value={editDueDate}
                    onChange={setEditDueDate}
                    placeholder="No due date"
                    disabled={isSaving}
                  />
                </div>

                <div className="edit-field">
                  <label className="edit-label">Description</label>
                  <textarea
                    className="edit-textarea"
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add a description..."
                    rows={4}
                  />
                </div>

                <div className="edit-actions">
                  <button
                    className="btn-cancel"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            // View mode
            <>
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
                ) : (
                  <>
                    {subtasks.length > 0 && (
                      <div className="modal-subtasks">
                        {subtasks.map(subtask => (
                          <div key={subtask.gid} className="modal-subtask">
                            <button
                              className={`task-checkbox ${subtask.completed ? 'checked' : ''}`}
                              onClick={() => handleSubtaskComplete(subtask)}
                            >
                              {subtask.completed && <span className="check-icon">✓</span>}
                            </button>
                            <div className="subtask-content">
                              <span className={`subtask-name ${subtask.completed ? 'completed' : ''}`}>
                                {subtask.name}
                              </span>
                              {subtask.due_on && (
                                <span className="subtask-due-date">
                                  {new Date(subtask.due_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <button
                              className="subtask-delete-btn"
                              onClick={() => handleDeleteSubtask(subtask)}
                              disabled={deletingSubtaskId === subtask.gid}
                              aria-label="Delete subtask"
                            >
                              {deletingSubtaskId === subtask.gid ? (
                                <span className="deleting-indicator">...</span>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M2 4h10M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4M6 7v3M8 7v3M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showNewSubtask ? (
                      <div className="new-subtask-form">
                        <div className="new-subtask-input">
                          <input
                            type="text"
                            placeholder="Subtask name..."
                            value={newSubtaskName}
                            onChange={e => setNewSubtaskName(e.target.value)}
                            onKeyDown={handleSubtaskKeyDown}
                            disabled={isCreatingSubtask}
                            autoFocus
                          />
                        </div>
                        <div className="new-subtask-options">
                          <DatePicker
                            value={newSubtaskDueDate}
                            onChange={setNewSubtaskDueDate}
                            placeholder="Due date"
                            disabled={isCreatingSubtask}
                          />
                          <div className="new-subtask-actions">
                            <button
                              className="btn-cancel-small"
                              onClick={() => {
                                setNewSubtaskName('')
                                setNewSubtaskDueDate('')
                                setShowNewSubtask(false)
                              }}
                              disabled={isCreatingSubtask}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn-save-small"
                              onClick={handleCreateSubtask}
                              disabled={isCreatingSubtask || !newSubtaskName.trim()}
                            >
                              {isCreatingSubtask ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="add-subtask-btn"
                        onClick={() => setShowNewSubtask(true)}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 3v8M3 7h8" />
                        </svg>
                        Add subtask
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
              <h3>Delete this task?</h3>
              <p>This will permanently delete the task from Asana. This cannot be undone.</p>
              <div className="delete-confirm-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="btn-delete"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
