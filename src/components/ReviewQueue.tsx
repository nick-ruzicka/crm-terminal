'use client'

import { useState, useEffect, useCallback } from 'react'

interface PendingNote {
  id: string
  content: string | null
  meeting_date: string | null
  confidence: number | null
  suggested_company: string | null
  suggested_contact: string | null
  suggested_deal_type: string | null
  classification_reason: string | null
}

export function ReviewQueue() {
  const [notes, setNotes] = useState<PendingNote[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActioning, setIsActioning] = useState(false)
  const [editedFields, setEditedFields] = useState<{
    name: string
    company: string
    deal_type: string
  }>({ name: '', company: '', deal_type: '' })

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/review')
      const data = await res.json()
      setNotes(data.notes || [])
      setCurrentIndex(0)
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const currentNote = notes[currentIndex]

  useEffect(() => {
    if (currentNote) {
      setEditedFields({
        name: currentNote.suggested_company || '',
        company: currentNote.suggested_company || '',
        deal_type: currentNote.suggested_deal_type || '',
      })
    }
  }, [currentNote])

  const handleApprove = async () => {
    if (!currentNote || isActioning) return
    setIsActioning(true)

    try {
      const res = await fetch(`/api/review/${currentNote.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedFields),
      })

      if (res.ok) {
        setNotes(prev => prev.filter((_, i) => i !== currentIndex))
        if (currentIndex >= notes.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1))
        }
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    } finally {
      setIsActioning(false)
    }
  }

  const handleDismiss = async () => {
    if (!currentNote || isActioning) return
    setIsActioning(true)

    try {
      const res = await fetch(`/api/review/${currentNote.id}/dismiss`, {
        method: 'POST',
      })

      if (res.ok) {
        setNotes(prev => prev.filter((_, i) => i !== currentIndex))
        if (currentIndex >= notes.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1))
        }
      }
    } catch (error) {
      console.error('Failed to dismiss:', error)
    } finally {
      setIsActioning(false)
    }
  }

  const handleSkip = () => {
    if (currentIndex < notes.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (isLoading) {
    return (
      <div className="review-loading">
        <div className="loading-spinner" />
        <span>Loading reviews...</span>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="review-empty">
        <div className="empty-icon">✓</div>
        <h2>All caught up!</h2>
        <p>No pending meeting notes to review.</p>
      </div>
    )
  }

  const confidencePercent = Math.round((currentNote.confidence || 0) * 100)

  return (
    <div className="review-container">
      <div className="review-progress">
        <span className="progress-text">
          {currentIndex + 1} of {notes.length} notes
        </span>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentIndex + 1) / notes.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="review-card">
        <div className="review-card-header">
          <div className="review-meta">
            {currentNote.meeting_date && (
              <span className="review-date">
                {new Date(currentNote.meeting_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            <span
              className={`confidence-badge ${
                confidencePercent >= 80
                  ? 'high'
                  : confidencePercent >= 50
                  ? 'medium'
                  : 'low'
              }`}
            >
              {confidencePercent}% confidence
            </span>
          </div>
        </div>

        <div className="review-content">
          <div className="note-snippet">
            {currentNote.content?.slice(0, 200) || 'No content'}
            {(currentNote.content?.length || 0) > 200 && '...'}
          </div>

          {currentNote.classification_reason && (
            <div className="classification-reason">
              <span className="reason-label">Why this might be a deal:</span>
              <span className="reason-text">{currentNote.classification_reason}</span>
            </div>
          )}
        </div>

        <div className="review-suggestions">
          <h3>Suggested Deal Details</h3>
          <div className="suggestion-fields">
            <div className="field-group">
              <label>Deal Name</label>
              <input
                type="text"
                value={editedFields.name}
                onChange={e =>
                  setEditedFields(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter deal name"
              />
            </div>
            <div className="field-group">
              <label>Company</label>
              <input
                type="text"
                value={editedFields.company}
                onChange={e =>
                  setEditedFields(prev => ({ ...prev, company: e.target.value }))
                }
                placeholder="Enter company name"
              />
            </div>
            <div className="field-group">
              <label>Deal Type</label>
              <input
                type="text"
                value={editedFields.deal_type}
                onChange={e =>
                  setEditedFields(prev => ({ ...prev, deal_type: e.target.value }))
                }
                placeholder="Enter deal type"
              />
            </div>
            {currentNote.suggested_contact && (
              <div className="field-group">
                <label>Suggested Contact</label>
                <div className="static-field">{currentNote.suggested_contact}</div>
              </div>
            )}
          </div>
        </div>

        <div className="review-actions">
          <button
            className="review-btn secondary"
            onClick={handlePrevious}
            disabled={currentIndex === 0 || isActioning}
          >
            ← Previous
          </button>
          <div className="action-group">
            <button
              className="review-btn dismiss"
              onClick={handleDismiss}
              disabled={isActioning}
            >
              Not a Deal
            </button>
            <button
              className="review-btn skip"
              onClick={handleSkip}
              disabled={currentIndex >= notes.length - 1 || isActioning}
            >
              Skip
            </button>
            <button
              className="review-btn approve"
              onClick={handleApprove}
              disabled={isActioning}
            >
              {isActioning ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </div>
      </div>

      <div className="review-keyboard-hints">
        <span>Tip: Review notes to keep your pipeline up to date</span>
      </div>
    </div>
  )
}
