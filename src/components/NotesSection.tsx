'use client'

import { useState } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import type { Note } from '@/types/database'

interface NotesSectionProps {
  dealId: string
  initialNotes: Note[]
}

export function NotesSection({ dealId, initialNotes }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [content, setContent] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          content: content.trim(),
          meeting_date: meetingDate || new Date().toISOString()
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create note')
      }

      const newNote = await res.json()

      // Add to notes list at the top
      setNotes(prev => [newNote, ...prev])

      // Reset form and close modal
      setContent('')
      setMeetingDate('')
      setIsModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="notes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Notes ({notes.length})</h2>
        <button
          className="add-note-btn"
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '8px 14px',
            background: '#6366f1',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          + Add Note
        </button>
      </div>

      {notes.length > 0 ? (
        <div className="notes-list">
          {notes.map(note => (
            <div key={note.id} className="note-card">
              {note.meeting_date && (
                <div className="date">
                  {new Date(note.meeting_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              )}
              <MarkdownContent content={note.content || 'Empty note'} compact />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '30px' }}>
          No notes yet
        </div>
      )}

      {/* Add Note Modal */}
      {isModalOpen && (
        <>
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)} />
          <div className="note-modal">
            <div className="modal-header">
              <h3>Add Note</h3>
              <button
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <textarea
                  className="note-textarea"
                  placeholder="Enter note content..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  autoFocus
                />

                <div className="date-field">
                  <label>Meeting date (optional)</label>
                  <input
                    type="date"
                    className="date-input"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="error-message">{error}</div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={isSubmitting || !content.trim()}
                >
                  {isSubmitting ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
