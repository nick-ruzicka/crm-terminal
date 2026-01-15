import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_ITEMS = 500

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required' },
        { status: 400 }
      )
    }

    if (ids.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ITEMS} items per request` },
        { status: 400 }
      )
    }

    // Log bulk operation for audit
    console.log(`[BULK DELETE] Deleting ${ids.length} deals at ${new Date().toISOString()}`)
    console.log(`[BULK DELETE] IDs: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`)

    const { error, count } = await supabase
      .from('deals')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('[BULK DELETE] Error:', error)
      return NextResponse.json(
        { error: 'Failed to delete deals' },
        { status: 500 }
      )
    }

    console.log(`[BULK DELETE] Successfully deleted ${count || ids.length} deals`)

    return NextResponse.json({
      deleted: count || ids.length,
      success: true,
    })
  } catch (error) {
    console.error('[BULK DELETE] API error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk delete' },
      { status: 500 }
    )
  }
}
