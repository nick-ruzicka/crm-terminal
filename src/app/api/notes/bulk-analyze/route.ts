import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface NoteAnalysis {
  total: number
  pendingReview: number
  byReviewStatus: {
    pending: number
    confirmed: number
    dismissed: number
    approved: number
  }
  orphaned: number
  recentMeetings: Array<{
    id: string
    suggested_company: string | null
    created_at: string
  }>
  byDeal: Record<string, { deal_name: string; note_count: number }>
}

export async function POST() {
  try {
    const supabase = getSupabase()

    // Get all notes with deal info
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, deal_id, review_status, suggested_company, is_potential_deal, created_at, meeting_date')
      .order('created_at', { ascending: false })

    if (notesError) {
      console.error('[NOTES ANALYZE] Error fetching notes:', notesError)
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    // Get deals for name lookup
    const { data: deals } = await supabase
      .from('deals')
      .select('id, name, company')

    const dealMap = new Map(
      (deals || []).map(d => [d.id, d.company || d.name])
    )

    const allNotes = notes || []

    // Calculate 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const analysis: NoteAnalysis = {
      total: allNotes.length,
      pendingReview: 0,
      byReviewStatus: {
        pending: 0,
        confirmed: 0,
        dismissed: 0,
        approved: 0,
      },
      orphaned: 0,
      recentMeetings: [],
      byDeal: {},
    }

    for (const note of allNotes) {
      // Count by review status
      const status = note.review_status || 'pending'
      if (status in analysis.byReviewStatus) {
        analysis.byReviewStatus[status as keyof typeof analysis.byReviewStatus]++
      }

      // Count pending reviews (potential deals needing review)
      if (note.is_potential_deal && status === 'pending') {
        analysis.pendingReview++
      }

      // Count orphaned (no deal_id)
      if (!note.deal_id) {
        analysis.orphaned++
      } else {
        // Track by deal
        const dealName = dealMap.get(note.deal_id) || 'Unknown Deal'
        if (!analysis.byDeal[note.deal_id]) {
          analysis.byDeal[note.deal_id] = { deal_name: dealName, note_count: 0 }
        }
        analysis.byDeal[note.deal_id].note_count++
      }

      // Recent meetings (last 7 days, potential deals)
      const createdAt = new Date(note.created_at)
      if (createdAt >= sevenDaysAgo && note.is_potential_deal) {
        analysis.recentMeetings.push({
          id: note.id,
          suggested_company: note.suggested_company,
          created_at: note.created_at,
        })
      }
    }

    // Limit recent meetings to 20
    analysis.recentMeetings = analysis.recentMeetings.slice(0, 20)

    console.log(`[NOTES ANALYZE] ${analysis.total} notes, ${analysis.pendingReview} pending review, ${analysis.orphaned} orphaned`)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('[NOTES ANALYZE] Error:', error)
    return NextResponse.json({ error: 'Failed to analyze notes' }, { status: 500 })
  }
}
