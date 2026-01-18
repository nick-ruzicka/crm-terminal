import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { logBulkDeletion } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

const MAX_ITEMS = 500

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { ids, triggeredBy } = body

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

    // Fetch deal info before soft deleting (only non-deleted deals)
    const { data: dealsToDelete } = await supabase
      .from('deals')
      .select('id, company, name')
      .in('id', ids)
      .is('deleted_at', null) as { data: { id: string; company: string | null; name: string | null }[] | null }

    if (!dealsToDelete || dealsToDelete.length === 0) {
      return NextResponse.json({
        deleted: 0,
        success: true,
        message: 'No deals found to delete'
      })
    }

    const dealIds = dealsToDelete.map(d => d.id)
    const companies = dealsToDelete.map(d => d.company || d.name || 'Unknown')

    console.log(`[BULK DELETE] Soft deleting ${dealIds.length} deals at ${new Date().toISOString()}`)

    // Soft delete: set deleted_at timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from('deals')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', dealIds)

    if (error) {
      console.error('[BULK DELETE] Error:', error)
      return NextResponse.json(
        { error: 'Failed to delete deals' },
        { status: 500 }
      )
    }

    console.log(`[BULK DELETE] Successfully soft deleted ${count || dealIds.length} deals`)

    // Log bulk deletion to activity log
    await logBulkDeletion(dealIds, companies, {
      triggeredBy: triggeredBy || 'ui'
    })

    return NextResponse.json({
      deleted: count || dealIds.length,
      success: true,
      companies,
    })
  } catch (error) {
    console.error('[BULK DELETE] API error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk delete' },
      { status: 500 }
    )
  }
}
