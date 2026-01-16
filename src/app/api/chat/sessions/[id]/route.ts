import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/chat/sessions/[id] - Get a single session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error } = await (supabase as any)
      .from('chat_sessions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching session:', error)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Session API error:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

// PATCH /api/chat/sessions/[id] - Update session (title, updated_at, or restore)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { title, restore } = body

    // Handle restore (undo delete)
    if (restore) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: session, error } = await (supabase as any)
        .from('chat_sessions')
        .update({ deleted_at: null })
        .eq('id', params.id)
        .select()
        .single()

      if (error) {
        console.error('Error restoring session:', error)
        return NextResponse.json({ error: 'Failed to restore session' }, { status: 500 })
      }

      return NextResponse.json({ session, restored: true })
    }

    // Regular update
    const updateData: { title?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (title) {
      updateData.title = title
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error } = await (supabase as any)
      .from('chat_sessions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Update session API error:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

// DELETE /api/chat/sessions/[id] - Soft delete session
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()

    // Soft delete: set deleted_at timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error } = await (supabase as any)
      .from('chat_sessions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, title')
      .single()

    if (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted: session,
      canUndo: true
    })
  } catch (error) {
    console.error('Delete session API error:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
