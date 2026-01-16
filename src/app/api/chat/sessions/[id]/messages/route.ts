import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/chat/sessions/[id]/messages - Get all messages for a session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error('Messages API error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST /api/chat/sessions/[id]/messages - Add message to session
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { role, content } = body as { role: string; content: string }

    if (!role || !content) {
      return NextResponse.json({ error: 'Role and content are required' }, { status: 400 })
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json({ error: 'Role must be user or assistant' }, { status: 400 })
    }

    // Insert the message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: message, error: messageError } = await (supabase as any)
      .from('chat_messages')
      .insert({
        session_id: params.id,
        role,
        content,
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error saving message:', messageError)
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    // Update session's updated_at timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Save message API error:', error)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
