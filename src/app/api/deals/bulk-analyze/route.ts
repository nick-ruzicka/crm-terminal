import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Categories based on deal types and company patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  bridges: [/bridge/i, /polymer/i, /wormhole/i, /hyperlane/i, /layerzero/i, /axelar/i],
  onramps: [/ramp/i, /fun\.xyz/i, /bastion/i, /crossmint/i, /moonpay/i, /transak/i],
  market_makers: [/jump/i, /wintermute/i, /market.?mak/i, /mm\b/i, /liquidity/i],
  prediction_markets: [/predict/i, /polymarket/i, /kalshi/i, /9lives/i, /fliq/i, /ethosx/i, /d8x/i],
  defi: [/defi/i, /swap/i, /dex/i, /lend/i, /yield/i, /vault/i, /amm/i],
  gaming: [/game/i, /gaming/i, /nft/i, /metaverse/i],
  wallets: [/wallet/i, /phantom/i, /metamask/i, /coinbase.*wallet/i],
  exchanges: [/exchange/i, /binance/i, /coinbase/i, /kraken/i, /okx/i],
  oracles: [/oracle/i, /chainlink/i, /pyth/i, /band/i],
  infra: [/infra/i, /node/i, /rpc/i, /index/i, /graph/i],
}

// Critical path categories (should be prioritized)
const CRITICAL_PATH = ['bridges', 'onramps', 'market_makers', 'prediction_markets', 'oracles']

interface Deal {
  id: string
  name: string
  company: string
  stage: string
  deal_type: string | null
  source: string | null
  updated_at: string
  created_at: string
}

function categorizeDeal(deal: Deal): string {
  const searchText = `${deal.company} ${deal.name} ${deal.deal_type || ''}`.toLowerCase()

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return category
      }
    }
  }

  return 'other'
}

function daysSinceUpdate(updatedAt: string): number {
  const updated = new Date(updatedAt)
  const now = new Date()
  return Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST() {
  try {
    const supabase = getSupabase()

    const { data: deals, error } = await supabase
      .from('deals')
      .select('id, name, company, stage, deal_type, source, updated_at, created_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[BULK ANALYZE] Error:', error)
      return NextResponse.json({ error: 'Failed to analyze deals' }, { status: 500 })
    }

    const allDeals = (deals || []) as Deal[]

    // Count by stage
    const byStage: Record<string, number> = {}
    for (const deal of allDeals) {
      byStage[deal.stage] = (byStage[deal.stage] || 0) + 1
    }

    // Count by category
    const byCategory: Record<string, number> = {}
    const dealCategories: Record<string, string> = {}
    for (const deal of allDeals) {
      const category = categorizeDeal(deal)
      dealCategories[deal.id] = category
      byCategory[category] = (byCategory[category] || 0) + 1
    }

    // Find stale deals (not updated in 90 days)
    const staleDeals = allDeals.filter(d => daysSinceUpdate(d.updated_at) >= 90)
    const stale = staleDeals.length

    // Find deals not updated in 30 days (needs attention)
    const needsAttention = allDeals.filter(d => {
      const days = daysSinceUpdate(d.updated_at)
      return days >= 30 && days < 90
    })

    // Generate suggestions
    const suggestions: Array<{
      action: string
      ids: string[]
      reason: string
      count: number
    }> = []

    // Suggestion 1: Move very stale non-critical deals to closed_lost
    const veryStaleNonCritical = staleDeals.filter(d => {
      const category = dealCategories[d.id]
      return !CRITICAL_PATH.includes(category) && d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    })
    if (veryStaleNonCritical.length > 0) {
      suggestions.push({
        action: 'close_stale',
        ids: veryStaleNonCritical.slice(0, 50).map(d => d.id),
        reason: 'Non-critical deals with no activity in 90+ days',
        count: veryStaleNonCritical.length,
      })
    }

    // Suggestion 2: Move discovery deals that aren't progressing to lead
    const stuckInDiscovery = allDeals.filter(d => {
      const days = daysSinceUpdate(d.updated_at)
      return d.stage === 'discovery' && days >= 60 && !CRITICAL_PATH.includes(dealCategories[d.id])
    })
    if (stuckInDiscovery.length > 0) {
      suggestions.push({
        action: 'move_to_lead',
        ids: stuckInDiscovery.slice(0, 50).map(d => d.id),
        reason: 'Non-critical discovery deals stuck for 60+ days',
        count: stuckInDiscovery.length,
      })
    }

    // Suggestion 3: Prioritize bridge/onramp deals
    const criticalInLead = allDeals.filter(d => {
      const category = dealCategories[d.id]
      return d.stage === 'lead' && CRITICAL_PATH.includes(category)
    })
    if (criticalInLead.length > 0) {
      suggestions.push({
        action: 'prioritize',
        ids: criticalInLead.map(d => d.id),
        reason: 'Critical path deals (bridges, onramps, MMs) still in lead stage',
        count: criticalInLead.length,
      })
    }

    // Suggestion 4: Review stale critical path deals
    const staleCritical = staleDeals.filter(d => {
      const category = dealCategories[d.id]
      return CRITICAL_PATH.includes(category) && d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    })
    if (staleCritical.length > 0) {
      suggestions.push({
        action: 'review_critical',
        ids: staleCritical.map(d => d.id),
        reason: 'Critical path deals that need follow-up (90+ days stale)',
        count: staleCritical.length,
      })
    }

    // Log analysis
    console.log(`[BULK ANALYZE] Analyzed ${allDeals.length} deals, ${stale} stale, ${suggestions.length} suggestions`)

    return NextResponse.json({
      total: allDeals.length,
      byStage,
      byCategory,
      stale,
      needsAttention: needsAttention.length,
      suggestions,
      criticalPath: {
        bridges: byCategory.bridges || 0,
        onramps: byCategory.onramps || 0,
        market_makers: byCategory.market_makers || 0,
        prediction_markets: byCategory.prediction_markets || 0,
        oracles: byCategory.oracles || 0,
      },
    })
  } catch (error) {
    console.error('[BULK ANALYZE] API error:', error)
    return NextResponse.json({ error: 'Failed to analyze deals' }, { status: 500 })
  }
}
