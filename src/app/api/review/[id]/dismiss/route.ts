import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use untyped client for flexible operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
