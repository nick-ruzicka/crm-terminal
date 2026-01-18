import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { logBulkStageChange } from '@/lib/activityLog'

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
    const { ids, updates, triggeredBy } = body

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

    // Fetch current deal info for logging (only non-deleted deals)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dealsToUpdate } = await (supabase as any)
      .from('deals')
      .select('id, company, name, stage')
      .in('id', ids)
      .is('deleted_at', null)

    if (!dealsToUpdate || dealsToUpdate.length === 0) {
      return NextResponse.json({
        updated: 0,
        success: true,
        message: 'No deals found to update'
      })
    }

    const dealIds = dealsToUpdate.map((d: { id: string }) => d.id)
    const companies = dealsToUpdate.map((d: { company?: string; name?: string }) => d.company || d.name || 'Unknown')
    const fromStages = dealsToUpdate.map((d: { stage?: string }) => d.stage || 'Unknown')

    console.log(`[BULK UPDATE] Updating ${dealIds.length} deals at ${new Date().toISOString()}`)
    console.log(`[BULK UPDATE] Fields: ${JSON.stringify(safeUpdates)}`)
    console.log(`[BULK UPDATE] Deal IDs: ${dealIds.join(', ')}`)

    // Execute update with deleted_at filter and return updated rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedDeals, error } = await (supabase as any)
      .from('deals')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .in('id', dealIds)
      .is('deleted_at', null)
      .select('id, company, stage')

    if (error) {
      console.error('[BULK UPDATE] Error:', error)
      return NextResponse.json(
        { error: `Failed to update deals: ${error.message}` },
        { status: 500 }
      )
    }

    const actuallyUpdated = updatedDeals?.length || 0
    console.log(`[BULK UPDATE] Successfully updated ${actuallyUpdated} deals`)

    if (actuallyUpdated === 0) {
      console.warn('[BULK UPDATE] WARNING: No deals were actually updated!')
      return NextResponse.json({
        updated: 0,
        success: false,
        message: 'No deals were updated - they may have been deleted or IDs are invalid'
      })
    }

    // Verify the update by checking the new stages
    console.log(`[BULK UPDATE] Updated deals:`, updatedDeals?.map((d: { company: string; stage: string }) => `${d.company} → ${d.stage}`))

    // Log stage changes to activity log
    if (safeUpdates.stage) {
      await logBulkStageChange(
        dealIds,
        companies,
        fromStages,
        safeUpdates.stage as string,
        triggeredBy || 'ui'
      )
    }

    return NextResponse.json({
      updated: actuallyUpdated,
      fields: Object.keys(safeUpdates),
      companies: updatedDeals?.map((d: { company: string }) => d.company) || companies,
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
