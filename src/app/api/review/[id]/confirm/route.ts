import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()

    // Verify note exists and has a deal_id
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, deal_id')
      .eq('id', id)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (!note.deal_id) {
      return NextResponse.json(
        { error: 'Note is not linked to a deal. Use approve to create a new deal.' },
        { status: 400 }
      )
    }

    // Mark as approved (keep existing deal_id)
    const { error: updateError } = await supabase
      .from('notes')
      .update({ review_status: 'approved' })
      .eq('id', id)

    if (updateError) {
      console.error('Error confirming note:', updateError)
      return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Confirm API error:', error)
    return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 })
  }
}
