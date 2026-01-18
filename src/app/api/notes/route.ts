import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = getSupabase()

  try {
    const { deal_id, content, meeting_date } = await request.json()

    if (!deal_id || !content) {
      return NextResponse.json(
        { error: 'deal_id and content are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        deal_id,
        content,
        meeting_date: meeting_date || new Date().toISOString(),
        review_status: 'approved'
      })
      .select()
      .single()

    if (error) {
      console.error('[NOTES] Create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[NOTES] Created note:', data.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[NOTES] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create note' },
      { status: 500 }
    )
  }
}
