import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

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

    // Get all deals
    const { data: allDeals, error: fetchError } = await supabase
      .from('deals')
      .select('id, company')

    if (fetchError) {
      console.error('[SEARCH AND DELETE] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }

    const deals = allDeals || []

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

    // Delete the matching deals
    const idsToDelete = matches.map(m => m.id)
    const { error: deleteError } = await supabase
      .from('deals')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      console.error('[SEARCH AND DELETE] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete deals' }, { status: 500 })
    }

    const deletedCompanies = matches.map(m => m.company)
    console.log(`[SEARCH AND DELETE] Deleted ${matches.length} deals: ${deletedCompanies.join(', ')}`)

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
