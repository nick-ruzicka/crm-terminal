import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { deal_id } = body

    if (!deal_id) {
      return NextResponse.json({ error: 'deal_id is required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Verify note exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: note, error: noteError } = await (supabase as any)
      .from('notes')
      .select('id')
      .eq('id', id)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Verify deal exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal, error: dealError } = await (supabase as any)
      .from('deals')
      .select('id, name, company')
      .eq('id', deal_id)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Link note to deal and mark as approved
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('notes')
      .update({
        deal_id: deal_id,
        review_status: 'approved',
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error linking note:', updateError)
      return NextResponse.json({ error: 'Failed to link note' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deal })
  } catch (error) {
    console.error('Link API error:', error)
    return NextResponse.json({ error: 'Failed to link note' }, { status: 500 })
  }
}
