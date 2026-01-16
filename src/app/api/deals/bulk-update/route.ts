import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_ITEMS = 500

// Allowed fields that can be bulk updated
const ALLOWED_UPDATE_FIELDS = [
  'stage',
  'status',
  'deal_type',
  'priority',
  'source',
  'notes',
]

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { ids, updates } = body

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

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'updates object is required with at least one field' },
        { status: 400 }
      )
    }

    // Filter to only allowed fields
    const safeUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.includes(key)) {
        safeUpdates[key] = value
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: `No valid update fields. Allowed: ${ALLOWED_UPDATE_FIELDS.join(', ')}` },
        { status: 400 }
      )
    }

    // Log bulk operation for audit
    console.log(`[BULK UPDATE] Updating ${ids.length} deals at ${new Date().toISOString()}`)
    console.log(`[BULK UPDATE] Fields: ${JSON.stringify(safeUpdates)}`)
    console.log(`[BULK UPDATE] IDs: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from('deals')
      .update(safeUpdates)
      .in('id', ids)

    if (error) {
      console.error('[BULK UPDATE] Error:', error)
      return NextResponse.json(
        { error: 'Failed to update deals' },
        { status: 500 }
      )
    }

    console.log(`[BULK UPDATE] Successfully updated ${count || ids.length} deals`)

    return NextResponse.json({
      updated: count || ids.length,
      fields: Object.keys(safeUpdates),
      success: true,
    })
  } catch (error) {
    console.error('[BULK UPDATE] API error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk update' },
      { status: 500 }
    )
  }
}
