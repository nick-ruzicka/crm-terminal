import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export interface SuggestionResponse {
  id: string
  title: string
  description: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'action_item' | 'follow_up' | 'stage_change' | 'task_create' | 'review_needed'
  source: {
    type: string
    id: string
    name: string
  }
  source_quote: string | null
  suggested_action: {
    action: string
    deal_id?: string
    note_id?: string
    task_name?: string
  } | null
  shown_count: number
  escalated_at: string | null
  created_at: string
}

// Internal names/companies to filter out
const INTERNAL_FILTERS = ['linera', 'bernadette', 'mathieu', 'internal', 'unknown']

// GET - Return active suggestions from database
export async function GET() {
  const supabase = getSupabase()

  try {
    // Fetch active suggestions (not dismissed or completed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('suggestions')
      .select('*')
      .is('dismissed_at', null)
      .is('completed_at', null)
      .order('priority', { ascending: true }) // critical first
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to frontend format and filter out internal suggestions
    const allSuggestions: SuggestionResponse[] = (data || []).map((row: {
      id: string
      title: string
      description: string | null
      priority: string
      type: string
      source_type: string | null
      source_id: string | null
      source_name: string | null
      source_quote: string | null
      suggested_action: Record<string, unknown> | null
      shown_count: number
      escalated_at: string | null
      created_at: string
    }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority as SuggestionResponse['priority'],
      type: row.type as SuggestionResponse['type'],
      source: {
        type: row.source_type || 'deal',
        id: row.source_id || '',
        name: row.source_name || 'Unknown'
      },
      source_quote: row.source_quote,
      suggested_action: row.suggested_action as SuggestionResponse['suggested_action'],
      shown_count: row.shown_count,
      escalated_at: row.escalated_at,
      created_at: row.created_at
    }))

    // Filter out any internal suggestions that slipped through
    const suggestions = allSuggestions.filter(s => {
      const checkText = `${s.title} ${s.source.name} ${s.description || ''}`.toLowerCase()
      const isInternal = INTERNAL_FILTERS.some(filter => checkText.includes(filter))
      if (isInternal) {
        console.log(`[SUGGESTIONS] Filtering internal: ${s.title} (${s.source.name})`)
      }
      return !isInternal
    })

    // Update last_shown_at for all returned suggestions
    if (suggestions.length > 0) {
      const ids = suggestions.map(s => s.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('suggestions')
        .update({ last_shown_at: new Date().toISOString() })
        .in('id', ids)
    }

    // Get stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: totalDeals } = await (supabase as any)
      .from('deals')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      suggestions,
      generated_at: new Date().toISOString(),
      context_summary: {
        total_deals: totalDeals || 0,
        active_suggestions: suggestions.length,
        critical_count: suggestions.filter(s => s.priority === 'critical').length,
        high_count: suggestions.filter(s => s.priority === 'high').length
      }
    })

  } catch (error) {
    console.error('[SUGGESTIONS] GET Error:', error)
    return NextResponse.json(
      {
        suggestions: [],
        error: error instanceof Error ? error.message : 'Failed to get suggestions'
      },
      { status: 500 }
    )
  }
}
