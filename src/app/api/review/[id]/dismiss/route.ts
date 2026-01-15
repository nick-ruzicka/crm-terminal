import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()

    const { error } = await supabase
      .from('notes')
      .update({ review_status: 'dismissed' })
      .eq('id', id)

    if (error) {
      console.error('Error dismissing note:', error)
      return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Dismiss API error:', error)
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 })
  }
}
