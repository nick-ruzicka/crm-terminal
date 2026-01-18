import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_RESULTS = 500

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { filters } = body

    if (!filters || typeof filters !== 'object') {
      return NextResponse.json(
        { error: 'filters object is required' },
        { status: 400 }
      )
    }

    // Start query - only non-deleted deals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('deals')
      .select('id, name, company, stage, deal_type, created_at, updated_at')
      .is('deleted_at', null)

    // Apply filters
    if (filters.stage) {
      query = query.eq('stage', filters.stage)
    }

    if (filters.deal_type) {
      query = query.eq('deal_type', filters.deal_type)
    }

    if (filters.source) {
      query = query.eq('source', filters.source)
    }

    if (filters.company) {
      query = query.ilike('company', `%${filters.company}%`)
    }

    if (filters.name) {
      query = query.ilike('name', `%${filters.name}%`)
    }

    // Date filters
    if (filters.created_before) {
      query = query.lt('created_at', filters.created_before)
    }

    if (filters.created_after) {
      query = query.gt('created_at', filters.created_after)
    }

    if (filters.updated_before) {
      query = query.lt('updated_at', filters.updated_before)
    }

    if (filters.updated_after) {
      query = query.gt('updated_at', filters.updated_after)
    }

    // Limit results
    query = query.limit(MAX_RESULTS)

    const { data: deals, error } = await query

    if (error) {
      console.error('[BULK QUERY] Error:', error)
      return NextResponse.json(
        { error: 'Failed to query deals' },
        { status: 500 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = deals?.map((d: any) => d.id) || []

    // Log query for audit
    console.log(`[BULK QUERY] Found ${ids.length} deals matching filters: ${JSON.stringify(filters)}`)

    return NextResponse.json({
      ids,
      count: ids.length,
      deals: deals || [], // Include deal details for preview
      filters_applied: filters,
      truncated: ids.length >= MAX_RESULTS,
    })
  } catch (error) {
    console.error('[BULK QUERY] API error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk query' },
      { status: 500 }
    )
  }
}
