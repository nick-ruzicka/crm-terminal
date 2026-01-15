import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

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

    // First, find matching deals
    const { data: matchingDeals, error: findError } = await supabase
      .from('deals')
      .select('id, company')

    if (findError) {
      console.error('[DELETE BY COMPANIES] Find error:', findError)
      return NextResponse.json({ error: 'Failed to find deals' }, { status: 500 })
    }

    // Filter deals where company matches (case-insensitive)
    const dealsToDelete = (matchingDeals || []).filter(deal =>
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
        companies: dealsToDelete.map(d => d.company),
        ids: dealsToDelete.map(d => d.id),
        message: `Found ${dealsToDelete.length} deal(s) to delete. Confirm to proceed.`
      })
    }

    // Delete the matching deals
    const idsToDelete = dealsToDelete.map(d => d.id)
    const { error: deleteError } = await supabase
      .from('deals')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      console.error('[DELETE BY COMPANIES] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete deals' }, { status: 500 })
    }

    const deletedCompanies = dealsToDelete.map(d => d.company)
    console.log(`[DELETE BY COMPANIES] Deleted ${dealsToDelete.length} deals: ${deletedCompanies.join(', ')}`)

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
