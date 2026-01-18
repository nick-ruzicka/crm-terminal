import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { logBulkDeletion } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { companies, confirmed } = await request.json()

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json(
        { error: 'companies array is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Normalize company names to lowercase for matching
    const normalizedNames = companies.map((c: string) => c.toLowerCase().trim())

    // Find matching non-deleted deals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchingDeals, error: findError } = await (supabase as any)
      .from('deals')
      .select('id, company')
      .is('deleted_at', null)

    if (findError) {
      console.error('[DELETE BY COMPANIES] Find error:', findError)
      return NextResponse.json({ error: 'Failed to find deals' }, { status: 500 })
    }

    // Filter deals where company matches (case-insensitive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealsToDelete = (matchingDeals || []).filter((deal: any) =>
      deal.company && normalizedNames.includes(deal.company.toLowerCase().trim())
    )

    if (dealsToDelete.length === 0) {
      return NextResponse.json({
        deleted: 0,
        companies: [],
        message: 'No matching deals found'
      })
    }

    // If not confirmed, return preview
    if (!confirmed) {
      return NextResponse.json({
        preview: true,
        count: dealsToDelete.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        companies: dealsToDelete.map((d: any) => d.company),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ids: dealsToDelete.map((d: any) => d.id),
        message: `Found ${dealsToDelete.length} deal(s) to delete. Confirm to proceed.`
      })
    }

    // Soft delete the matching deals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idsToDelete = dealsToDelete.map((d: any) => d.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('deals')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', idsToDelete)

    if (deleteError) {
      console.error('[DELETE BY COMPANIES] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete deals' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deletedCompanies = dealsToDelete.map((d: any) => d.company)
    console.log(`[DELETE BY COMPANIES] Soft deleted ${dealsToDelete.length} deals: ${deletedCompanies.join(', ')}`)

    // Log bulk deletion to activity log
    await logBulkDeletion(idsToDelete, deletedCompanies, {
      triggeredBy: 'chat'
    })

    return NextResponse.json({
      deleted: dealsToDelete.length,
      companies: deletedCompanies
    })
  } catch (error) {
    console.error('[DELETE BY COMPANIES] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
