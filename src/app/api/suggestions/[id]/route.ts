import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface PatchBody {
  action: 'dismiss' | 'complete' | 'increment_shown'
}

// PATCH - Update suggestion status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()

  try {
    const { id } = await params
    const body: PatchBody = await request.json()

    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    switch (body.action) {
      case 'dismiss':
        updateData.dismissed_at = new Date().toISOString()
        break
      case 'complete':
        updateData.completed_at = new Date().toISOString()
        break
      case 'increment_shown':
        // First get current count
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: current } = await (supabase as any)
          .from('suggestions')
          .select('shown_count')
          .eq('id', id)
          .single()

        updateData = {
          ...updateData,
          shown_count: (current?.shown_count || 0) + 1,
          last_shown_at: new Date().toISOString()
        }
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('suggestions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      suggestion: data
    })

  } catch (error) {
    console.error('[SUGGESTIONS] PATCH Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update suggestion' },
      { status: 500 }
    )
  }
}

// GET - Get single suggestion
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()

  try {
    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('suggestions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ suggestion: data })

  } catch (error) {
    console.error('[SUGGESTIONS] GET Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get suggestion' },
      { status: 500 }
    )
  }
}
