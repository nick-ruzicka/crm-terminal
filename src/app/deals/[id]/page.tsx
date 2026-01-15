import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Deal, Contact, Note } from '@/types/database'
import { MarkdownContent } from '@/components/MarkdownContent'

async function getDeal(id: string): Promise<Deal | null> {
  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !deal) {
    return null
  }

  return deal
}

async function getContacts(dealId: string): Promise<Contact[]> {
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('deal_id', dealId)
    .order('is_primary', { ascending: false })

  return contacts || []
}

async function getNotes(dealId: string): Promise<Note[]> {
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('deal_id', dealId)
    .order('meeting_date', { ascending: false })

  return notes || []
}

export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DealPage({ params }: PageProps) {
  const { id } = await params
  const deal = await getDeal(id)

  if (!deal) {
    notFound()
  }

  const [contacts, notes] = await Promise.all([
    getContacts(id),
    getNotes(id),
  ])

  return (
    <div>
      <Link href="/deals" className="back-link">
        ← Back to Deals
      </Link>

      <div className="deal-header">
        <h1>{deal.name}</h1>
        <div className="deal-meta">
          {deal.company && <span>{deal.company}</span>}
          <span className={`stage-pill ${(deal.stage || '').toLowerCase()}`}>
            {deal.stage || 'Unknown'}
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h2>Deal Details</h2>
          <div className="detail-item">
            <label>Deal Type</label>
            <p>{deal.deal_type || '—'}</p>
          </div>
          <div className="detail-item">
            <label>Source</label>
            <p>{deal.source || '—'}</p>
          </div>
          <div className="detail-item">
            <label>Next Step</label>
            <p>{deal.next_step || '—'}</p>
          </div>
          <div className="detail-item">
            <label>Next Step Due</label>
            <p>
              {deal.next_step_due
                ? new Date(deal.next_step_due).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
          {deal.hubspot_id && (
            <div className="detail-item">
              <label>HubSpot ID</label>
              <p style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                {deal.hubspot_id}
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Contacts ({contacts.length})</h2>
          {contacts.length > 0 ? (
            <div>
              {contacts.map(contact => (
                <div key={contact.id} className="contact-item">
                  <div className="contact-avatar">
                    {(contact.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <h4>{contact.name || 'Unknown'}</h4>
                    <p>
                      {[contact.role, contact.email].filter(Boolean).join(' • ') ||
                        'No details'}
                    </p>
                    {contact.telegram && (
                      <p style={{ color: 'var(--accent)', fontSize: '12px' }}>
                        @{contact.telegram}
                      </p>
                    )}
                  </div>
                  {contact.is_primary && (
                    <span className="primary-badge">Primary</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '30px' }}>
              No contacts
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Notes ({notes.length})</h2>
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
      </div>
    </div>
  )
}
