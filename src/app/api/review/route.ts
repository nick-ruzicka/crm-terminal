import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabase()

    // Fetch notes with linked deal info
    const { data: notes, error } = await supabase
      .from('notes')
      .select(`
        *,
        deal:deals(id, name, company, stage, deal_type)
      `)
      .eq('review_status', 'pending')
      .eq('is_potential_deal', true)

    if (error) {
      console.error('Error fetching pending reviews:', error)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    // Sort: auto-linked notes first, then by confidence
    const sortedNotes = (notes || []).sort((a, b) => {
      // Auto-linked (has deal_id) comes first
      const aLinked = a.deal_id ? 1 : 0
      const bLinked = b.deal_id ? 1 : 0
      if (aLinked !== bLinked) return bLinked - aLinked
      // Then by confidence
      return (b.confidence || 0) - (a.confidence || 0)
    })

    return NextResponse.json(
      { notes: sortedNotes },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }
}
