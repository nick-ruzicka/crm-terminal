'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DealSearch } from './DealSearch'
import { useReviewCount } from './ReviewCountContext'
import { formatStageName } from '@/lib/dateUtils'

interface LinkedDeal {
  id: string
  name: string
  company: string | null
  stage: string | null
  deal_type: string | null
}

interface PendingNote {
  id: string
  deal_id: string | null
  content: string | null
  meeting_date: string | null
  confidence: number | null
  suggested_company: string | null
  suggested_contact: string | null
  suggested_deal_type: string | null
  classification_reason: string | null
  deal: LinkedDeal | null
}

type TabType = 'all' | 'auto-linked' | 'needs-action'

export function ReviewQueue() {
  const [notes, setNotes] = useState<PendingNote[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActioning, setIsActioning] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [showDealSearch, setShowDealSearch] = useState(false)
  const [dealSearchMode, setDealSearchMode] = useState<'link' | 'relink'>('link')
  const [isNoteExpanded, setIsNoteExpanded] = useState(false)
  const [editedFields, setEditedFields] = useState<{
    name: string
    company: string
    deal_type: string
  }>({ name: '', company: '', deal_type: '' })

  const { decrementCount } = useReviewCount()

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/review', { cache: 'no-store' })
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

  // Filter notes based on active tab
  const filteredNotes = notes.filter(note => {
    if (activeTab === 'auto-linked') return note.deal_id !== null
    if (activeTab === 'needs-action') return note.deal_id === null
    return true
  })

  const autoLinkedCount = notes.filter(n => n.deal_id !== null).length
  const needsActionCount = notes.filter(n => n.deal_id === null).length

  const currentNote = filteredNotes[currentIndex]
  const isAutoLinked = currentNote?.deal_id !== null

  useEffect(() => {
    if (currentNote && !isAutoLinked) {
      setEditedFields({
        name: currentNote.suggested_company || '',
        company: currentNote.suggested_company || '',
        deal_type: currentNote.suggested_deal_type || '',
      })
    }
  }, [currentNote, isAutoLinked])

  // Reset index and collapse note when tab changes
  useEffect(() => {
    setCurrentIndex(0)
    setIsNoteExpanded(false)
  }, [activeTab])

  // Collapse note when moving between notes
  useEffect(() => {
    setIsNoteExpanded(false)
  }, [currentIndex])

  const removeCurrentNote = () => {
    setNotes(prev => prev.filter(n => n.id !== currentNote.id))
    if (currentIndex >= filteredNotes.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1))
    }
    // Optimistically update the nav badge count immediately
    decrementCount()
  }

  // Confirm auto-linked note
  const handleConfirm = async () => {
    if (!currentNote || isActioning) return
    setIsActioning(true)

    try {
      const res = await fetch(`/api/review/${currentNote.id}/confirm`, {
        method: 'POST',
      })

      if (res.ok) {
        removeCurrentNote()
      }
    } catch (error) {
      console.error('Failed to confirm:', error)
    } finally {
      setIsActioning(false)
    }
  }

  // Create new deal (for unlinked notes)
  const handleCreateDeal = async () => {
    if (!currentNote || isActioning) return
    setIsActioning(true)

    try {
      const res = await fetch(`/api/review/${currentNote.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedFields),
      })

      if (res.ok) {
        removeCurrentNote()
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    } finally {
      setIsActioning(false)
    }
  }

  // Link to existing deal
  const handleLinkToDeal = async (deal: { id: string }) => {
    if (!currentNote || isActioning) return
    setIsActioning(true)
    setShowDealSearch(false)

    try {
      const res = await fetch(`/api/review/${currentNote.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id }),
      })

      if (res.ok) {
        removeCurrentNote()
      }
    } catch (error) {
      console.error('Failed to link:', error)
    } finally {
      setIsActioning(false)
    }
  }

  // Dismiss as not a deal
  const handleDismiss = async () => {
    if (!currentNote || isActioning) return
    setIsActioning(true)

    try {
      const res = await fetch(`/api/review/${currentNote.id}/dismiss`, {
        method: 'POST',
      })

      if (res.ok) {
        removeCurrentNote()
      }
    } catch (error) {
      console.error('Failed to dismiss:', error)
    } finally {
      setIsActioning(false)
    }
  }

  const handleSkip = () => {
    if (currentIndex < filteredNotes.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const openDealSearch = (mode: 'link' | 'relink') => {
    setDealSearchMode(mode)
    setShowDealSearch(true)
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

  // Confidence is 0-100, display as percentage
  const confidencePercent = Math.round(currentNote?.confidence || 0)
  const noteContent = currentNote?.content || ''
  const isLongNote = noteContent.length > 200
  const displayContent = isNoteExpanded ? noteContent : noteContent.slice(0, 200)

  return (
    <div className="review-container">
      {/* Tab Navigation */}
      <div className="review-tabs">
        <button
          className={`review-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({notes.length})
        </button>
        <button
          className={`review-tab ${activeTab === 'auto-linked' ? 'active' : ''}`}
          onClick={() => setActiveTab('auto-linked')}
        >
          Auto-Linked ({autoLinkedCount})
        </button>
        <button
          className={`review-tab ${activeTab === 'needs-action' ? 'active' : ''}`}
          onClick={() => setActiveTab('needs-action')}
        >
          Needs Action ({needsActionCount})
        </button>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="review-empty">
          <div className="empty-icon">✓</div>
          <h2>No notes in this category</h2>
          <p>Try switching to a different tab.</p>
        </div>
      ) : (
        <>
          <div className="review-progress">
            <span className="progress-text">
              {currentIndex + 1} of {filteredNotes.length} notes
            </span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentIndex + 1) / filteredNotes.length) * 100}%` }}
              />
            </div>
          </div>

          <div className={`review-card ${isAutoLinked ? 'auto-linked' : 'needs-action'}`}>
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
                {isAutoLinked && (
                  <span className="linked-badge">Auto-Linked</span>
                )}
              </div>
            </div>

            {/* Prominent Linked Deal Card */}
            {isAutoLinked && currentNote.deal && (
              <Link
                href={`/deals/${currentNote.deal.id}`}
                className="linked-deal-card"
              >
                <div className="linked-deal-card-header">
                  <span className="linked-deal-icon">🔗</span>
                  <span className="linked-deal-label">Linked to:</span>
                </div>
                <div className="linked-deal-card-body">
                  <h4 className="linked-deal-company">
                    {currentNote.deal.company || currentNote.deal.name}
                  </h4>
                  <div className="linked-deal-meta">
                    <span className={`stage-pill ${currentNote.deal.stage || ''}`}>
                      {formatStageName(currentNote.deal.stage)}
                    </span>
                    {currentNote.deal.deal_type && (
                      <span className="linked-deal-type">
                        {currentNote.deal.deal_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="linked-deal-card-footer">
                  <span className="view-deal-link">View Deal →</span>
                </div>
              </Link>
            )}

            <div className="review-content">
              <div className={`note-snippet ${isNoteExpanded ? 'expanded' : ''}`}>
                {displayContent || 'No content'}
                {!isNoteExpanded && isLongNote && '...'}
              </div>

              {isLongNote && (
                <button
                  className="expand-note-btn"
                  onClick={() => setIsNoteExpanded(!isNoteExpanded)}
                >
                  {isNoteExpanded ? 'Show less ▲' : 'Show full note ▼'}
                </button>
              )}

              {currentNote.classification_reason && (
                <div className="classification-reason">
                  <span className="reason-label">Why this might be a deal:</span>
                  <span className="reason-text">{currentNote.classification_reason}</span>
                </div>
              )}
            </div>

            {/* Show form only for unlinked notes */}
            {!isAutoLinked && (
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
            )}

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

                {isAutoLinked ? (
                  <>
                    <button
                      className="review-btn secondary relink"
                      onClick={() => openDealSearch('relink')}
                      disabled={isActioning}
                    >
                      Change Deal
                    </button>
                    <button
                      className="review-btn approve"
                      onClick={handleConfirm}
                      disabled={isActioning}
                    >
                      {isActioning ? 'Confirming...' : 'Confirm Link'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="review-btn secondary"
                      onClick={() => openDealSearch('link')}
                      disabled={isActioning}
                    >
                      Link to Existing
                    </button>
                    <button
                      className="review-btn skip"
                      onClick={handleSkip}
                      disabled={currentIndex >= filteredNotes.length - 1 || isActioning}
                    >
                      Skip
                    </button>
                    <button
                      className="review-btn approve"
                      onClick={handleCreateDeal}
                      disabled={isActioning}
                    >
                      {isActioning ? 'Creating...' : 'Create Deal'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="review-keyboard-hints">
            <span>
              {isAutoLinked
                ? 'Tip: Confirm to keep the link, or change the linked deal'
                : 'Tip: Create a new deal or link to an existing one'}
            </span>
          </div>
        </>
      )}

      {/* Deal Search Modal */}
      {showDealSearch && (
        <DealSearch
          onSelect={handleLinkToDeal}
          onCancel={() => setShowDealSearch(false)}
          excludeDealId={dealSearchMode === 'relink' ? currentNote?.deal_id || undefined : undefined}
        />
      )}
    </div>
  )
}
