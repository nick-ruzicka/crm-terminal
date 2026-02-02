import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface TokenUsageRow {
  id: string
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  model: string
  loops: number
  duration_ms: number
  tools_used: string[]
  created_at: string
}

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // Get recent usage (last 50 queries)
    const { data: recent, error: recentError } = await sb
      .from('token_usage')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (recentError) throw recentError
    const recentRows = (recent || []) as TokenUsageRow[]

    // Get today's totals
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: todayData, error: todayError } = await sb
      .from('token_usage')
      .select('input_tokens, output_tokens, estimated_cost')
      .gte('created_at', today.toISOString())

    if (todayError) throw todayError
    const todayRows = (todayData || []) as TokenUsageRow[]

    const todayStats = {
      queries: todayRows.length,
      inputTokens: todayRows.reduce((sum, r) => sum + r.input_tokens, 0),
      outputTokens: todayRows.reduce((sum, r) => sum + r.output_tokens, 0),
      totalTokens: todayRows.reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0),
      totalCost: todayRows.reduce((sum, r) => sum + Number(r.estimated_cost), 0),
    }

    // Get this week's totals
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: weekData, error: weekError } = await sb
      .from('token_usage')
      .select('input_tokens, output_tokens, estimated_cost')
      .gte('created_at', weekAgo.toISOString())

    if (weekError) throw weekError
    const weekRows = (weekData || []) as TokenUsageRow[]

    const weekStats = {
      queries: weekRows.length,
      inputTokens: weekRows.reduce((sum, r) => sum + r.input_tokens, 0),
      outputTokens: weekRows.reduce((sum, r) => sum + r.output_tokens, 0),
      totalTokens: weekRows.reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0),
      totalCost: weekRows.reduce((sum, r) => sum + Number(r.estimated_cost), 0),
    }

    // Find high-usage queries (>10k tokens)
    const highUsage = recentRows.filter(r => (r.input_tokens + r.output_tokens) > 10000)

    return NextResponse.json({
      recent: recentRows.slice(0, 20),
      today: todayStats,
      week: weekStats,
      highUsage: highUsage.slice(0, 10),
      avgTokensPerQuery: weekStats.queries > 0
        ? Math.round(weekStats.totalTokens / weekStats.queries)
        : 0,
    })
  } catch (error) {
    console.error('Failed to fetch usage stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage stats' },
      { status: 500 }
    )
  }
}
