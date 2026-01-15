import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/chat/sessions - List all sessions
export async function GET() {
  try {
    const supabase = getSupabase()

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error('Sessions API error:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

// POST /api/chat/sessions - Create new session
export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { title } = body

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        title: title || 'New Chat',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Create session API error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
