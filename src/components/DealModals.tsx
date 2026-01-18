'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Deal, Contact, Note } from '@/types/database'
import { useToast } from './Toast'
import { restoreMarkdownFormatting } from '@/lib/markdown'
import { STAGES, DEAL_TYPES, SOURCES } from '@/constants/stages'

// New Deal Modal
interface NewDealModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (deal: Deal) => void
}

export function NewDealModal({ isOpen, onClose, onCreated }: NewDealModalProps) {
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    stage: 'lead',
    deal_type: '',
    source: '',
    next_step: '',
    next_step_due: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.company.trim()) {
      setError('Company name is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name: formData.name || formData.company,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to create deal')
      }

      const { deal } = await res.json()
      onCreated(deal)
      addToast('success', 'Deal Created', `${formData.company} has been added`)
      onClose()
      setFormData({
        company: '',
        name: '',
        stage: 'lead',
        deal_type: '',
        source: '',
        next_step: '',
        next_step_due: '',
      })
    } catch {
      setError('Failed to create deal. Please try again.')
      addToast('error', 'Error', 'Failed to create deal')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay centered" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h2>New Deal</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            {error && <div className="form-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="company">Company Name *</label>
              <input
                id="company"
                type="text"
                value={formData.company}
                onChange={e => setFormData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Enter company name"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">Deal Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Optional - defaults to company name"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stage">Stage</label>
                <select
                  id="stage"
                  value={formData.stage}
                  onChange={e => setFormData(prev => ({ ...prev, stage: e.target.value }))}
                >
                  {STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="deal_type">Deal Type</label>
                <select
                  id="deal_type"
                  value={formData.deal_type}
                  onChange={e => setFormData(prev => ({ ...prev, deal_type: e.target.value }))}
                >
                  <option value="">Select type</option>
                  {DEAL_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="source">Source</label>
              <select
                id="source"
                value={formData.source}
                onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
              >
                <option value="">Select source</option>
                {SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="next_step">Next Step</label>
              <input
                id="next_step"
                type="text"
                value={formData.next_step}
                onChange={e => setFormData(prev => ({ ...prev, next_step: e.target.value }))}
                placeholder="What's the next action?"
              />
            </div>

            <div className="form-group">
              <label htmlFor="next_step_due">Next Step Due Date</label>
              <input
                id="next_step_due"
                type="date"
                value={formData.next_step_due}
                onChange={e => setFormData(prev => ({ ...prev, next_step_due: e.target.value }))}
              />
            </div>
          </div>

          <div className="modal-dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Deal Detail Panel
interface DealDetailPanelProps {
  deal: Deal
  onClose: () => void
  onUpdate: (deal: Deal) => void
  onDelete: (dealId: string) => void
}

export function DealDetailPanel({ deal, onClose, onUpdate, onDelete }: DealDetailPanelProps) {
  const { addToast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteMeetingDate, setNoteMeetingDate] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
        } else if (isEditing) {
          setIsEditing(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose, isEditing, showDeleteConfirm])

  useEffect(() => {
    async function loadDealData() {
      try {
        const res = await fetch(`/api/deals/${deal.id}`)
        const data = await res.json()
        setContacts(data.contacts || [])
        setNotes(data.notes || [])
      } catch {
        console.error('Failed to load deal data')
      } finally {
        setLoading(false)
      }
    }
    loadDealData()
  }, [deal.id])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete(deal.id)
        addToast('success', 'Deal Deleted', `${deal.company || deal.name} has been removed`)
        onClose()
      } else {
        addToast('error', 'Error', 'Failed to delete deal')
      }
    } catch {
      console.error('Failed to delete deal')
      addToast('error', 'Error', 'Failed to delete deal')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatStageName = (stage: string | null) => {
    if (!stage) return 'Unknown'
    return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return

    setIsSubmittingNote(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: deal.id,
          content: noteContent.trim(),
          meeting_date: noteMeetingDate || new Date().toISOString()
        })
      })

      if (!res.ok) throw new Error('Failed to create note')

      const newNote = await res.json()
      setNotes(prev => [newNote, ...prev])
      setNoteContent('')
      setNoteMeetingDate('')
      setShowAddNote(false)
      addToast('success', 'Note Added', 'Your note has been saved')
    } catch {
      addToast('error', 'Error', 'Failed to add note')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-drawer wide" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className={`stage-pill ${deal.stage || ''}`}>
              {formatStageName(deal.stage)}
            </span>
          </div>
          <div className="drawer-header-right">
            <button className="btn-icon" onClick={() => setIsEditing(true)} title="Edit">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" />
              </svg>
            </button>
            <button className="btn-icon danger" onClick={() => setShowDeleteConfirm(true)} title="Delete">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" />
              </svg>
            </button>
            <button className="modal-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="drawer-content">
          <div className="drawer-title">{deal.company || deal.name}</div>
          {deal.company && deal.name !== deal.company && (
            <div className="drawer-subtitle">{deal.name}</div>
          )}

          <div className="drawer-section">
            <h3 className="section-label">Details</h3>
            <div className="detail-grid-compact">
              <div className="detail-item">
                <span className="detail-label">Deal Type</span>
                <span className="detail-value">{deal.deal_type || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Source</span>
                <span className="detail-value">{deal.source || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Next Step</span>
                <span className="detail-value">{deal.next_step || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Due Date</span>
                <span className="detail-value">{formatDate(deal.next_step_due)}</span>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <h3 className="section-label">
              Contacts
              <span className="section-count">{contacts.length}</span>
            </h3>
            {loading ? (
              <div className="loading-text">Loading...</div>
            ) : contacts.length > 0 ? (
              <div className="contacts-list">
                {contacts.map(contact => (
                  <div key={contact.id} className="contact-row">
                    <div className="contact-avatar">
                      {(contact.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name">
                        {contact.name || 'Unknown'}
                        {contact.is_primary && <span className="primary-tag">Primary</span>}
                      </div>
                      <div className="contact-meta">
                        {contact.role && <span>{contact.role}</span>}
                        {contact.email && <span>{contact.email}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-text">No contacts linked</div>
            )}
          </div>

          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-label">
                Notes
                <span className="section-count">{notes.length}</span>
              </h3>
              <button
                onClick={() => setShowAddNote(true)}
                style={{
                  padding: '6px 12px',
                  background: '#6366f1',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                + Add Note
              </button>
            </div>
            {loading ? (
              <div className="loading-text">Loading...</div>
            ) : notes.length > 0 ? (
              <div className="notes-list-compact">
                {notes.map(note => (
                  <div key={note.id} className="note-item">
                    <div className="note-date">{formatDate(note.meeting_date)}</div>
                    <div className="markdown-content compact">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{restoreMarkdownFormatting(note.content || '')}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-text">No notes yet</div>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <h3>Delete Deal?</h3>
              <p>Are you sure you want to delete "{deal.company || deal.name}"? This action cannot be undone.</p>
              <div className="confirm-actions">
                <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditing && (
          <EditDealModal
            deal={deal}
            onClose={() => setIsEditing(false)}
            onSaved={onUpdate}
          />
        )}

        {/* Add Note Modal */}
        {showAddNote && (
          <div className="modal-overlay centered" onClick={() => setShowAddNote(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-dialog-header">
                <h2>Add Note</h2>
                <button className="modal-close" onClick={() => setShowAddNote(false)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddNote}>
                <div className="modal-dialog-body">
                  <div className="form-group">
                    <label htmlFor="note-content">Note Content</label>
                    <textarea
                      id="note-content"
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      placeholder="Enter your note..."
                      rows={6}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="note-date">Meeting Date (optional)</label>
                    <input
                      id="note-date"
                      type="date"
                      value={noteMeetingDate}
                      onChange={e => setNoteMeetingDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-dialog-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddNote(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingNote || !noteContent.trim()}>
                    {isSubmittingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Edit Deal Modal
interface EditDealModalProps {
  deal: Deal
  onClose: () => void
  onSaved: (deal: Deal) => void
}

function EditDealModal({ deal, onClose, onSaved }: EditDealModalProps) {
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    company: deal.company || '',
    name: deal.name || '',
    stage: deal.stage || 'lead',
    deal_type: deal.deal_type || '',
    source: deal.source || '',
    next_step: deal.next_step || '',
    next_step_due: deal.next_step_due || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const { deal: updatedDeal } = await res.json()
        onSaved(updatedDeal)
        addToast('success', 'Deal Updated', 'Changes have been saved')
        onClose()
      } else {
        addToast('error', 'Error', 'Failed to save changes')
      }
    } catch {
      console.error('Failed to update deal')
      addToast('error', 'Error', 'Failed to save changes')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay centered" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h2>Edit Deal</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            <div className="form-group">
              <label htmlFor="edit-company">Company Name</label>
              <input
                id="edit-company"
                type="text"
                value={formData.company}
                onChange={e => setFormData(prev => ({ ...prev, company: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-name">Deal Name</label>
              <input
                id="edit-name"
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-stage">Stage</label>
                <select
                  id="edit-stage"
                  value={formData.stage}
                  onChange={e => setFormData(prev => ({ ...prev, stage: e.target.value }))}
                >
                  {STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-deal_type">Deal Type</label>
                <select
                  id="edit-deal_type"
                  value={formData.deal_type}
                  onChange={e => setFormData(prev => ({ ...prev, deal_type: e.target.value }))}
                >
                  <option value="">Select type</option>
                  {DEAL_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="edit-source">Source</label>
              <select
                id="edit-source"
                value={formData.source}
                onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
              >
                <option value="">Select source</option>
                {SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-next_step">Next Step</label>
              <input
                id="edit-next_step"
                type="text"
                value={formData.next_step}
                onChange={e => setFormData(prev => ({ ...prev, next_step: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-next_step_due">Next Step Due Date</label>
              <input
                id="edit-next_step_due"
                type="date"
                value={formData.next_step_due}
                onChange={e => setFormData(prev => ({ ...prev, next_step_due: e.target.value }))}
              />
            </div>
          </div>

          <div className="modal-dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
