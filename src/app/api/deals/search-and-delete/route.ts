import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { logBulkDeletion } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

interface Match {
  id: string
  company: string
  search_term: string
}

export async function POST(request: NextRequest) {
  try {
    const { search_terms, confirm } = await request.json()

    if (!search_terms || !Array.isArray(search_terms) || search_terms.length === 0) {
      return NextResponse.json(
        { error: 'search_terms array is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Get all non-deleted deals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allDeals, error: fetchError } = await (supabase as any)
      .from('deals')
      .select('id, company')
      .is('deleted_at', null)

    if (fetchError) {
      console.error('[SEARCH AND DELETE] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }

    const deals: Array<{ id: string; company: string | null }> = allDeals || []

    // Find matches for each search term (fuzzy matching)
    const matches: Match[] = []
    const matchedIds = new Set<string>()

    for (const term of search_terms) {
      const normalizedTerm = term.toLowerCase().trim()
      if (!normalizedTerm) continue

      for (const deal of deals) {
        if (!deal.company) continue

        // Fuzzy match: company contains the search term
        if (deal.company.toLowerCase().includes(normalizedTerm)) {
          if (!matchedIds.has(deal.id)) {
            matchedIds.add(deal.id)
            matches.push({
              id: deal.id,
              company: deal.company,
              search_term: term,
            })
          }
        }
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({
        matches: [],
        count: 0,
        message: 'No matching deals found'
      })
    }

    // If not confirmed, return preview
    if (!confirm) {
      // Group by search term for cleaner output
      const byTerm: Record<string, string[]> = {}
      for (const match of matches) {
        if (!byTerm[match.search_term]) {
          byTerm[match.search_term] = []
        }
        byTerm[match.search_term].push(match.company)
      }

      return NextResponse.json({
        preview: true,
        matches,
        byTerm,
        count: matches.length,
        ids: matches.map(m => m.id),
        message: `Found ${matches.length} deal(s) matching your search terms. Confirm to delete.`
      })
    }

    // Soft delete the matching deals
    const idsToDelete = matches.map(m => m.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('deals')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', idsToDelete)

    if (deleteError) {
      console.error('[SEARCH AND DELETE] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete deals' }, { status: 500 })
    }

    const deletedCompanies = matches.map(m => m.company)
    console.log(`[SEARCH AND DELETE] Soft deleted ${matches.length} deals: ${deletedCompanies.join(', ')}`)

    // Log bulk deletion to activity log with search query
    await logBulkDeletion(idsToDelete, deletedCompanies, {
      searchQuery: search_terms.join(', '),
      triggeredBy: 'chat'
    })

    return NextResponse.json({
      deleted: matches.length,
      companies: deletedCompanies,
      matches
    })
  } catch (error) {
    console.error('[SEARCH AND DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
