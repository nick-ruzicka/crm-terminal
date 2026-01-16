import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { semanticSearch, SemanticSearchResult } from '@/lib/embeddings'
import { getSupabase } from '@/lib/supabase'
import { getProjectTasks } from '@/lib/asana'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Reduced from 60 - should be much faster now

// Simple in-memory cache for suggestions
interface CachedSuggestions {
  suggestions: Suggestion[]
  generated_at: string
  context_summary: Record<string, unknown>
  cached_at: number
}

let suggestionsCache: CachedSuggestions | null = null
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface Suggestion {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'action_item' | 'follow_up' | 'stage_change' | 'task_create' | 'review_needed'
  title: string
  description: string
  source: {
    type: 'deal' | 'note' | 'task' | 'gap_analysis'
    id: string
    name: string
  }
  suggested_action: string
  source_quote?: string
  source_date?: string
  deal_id?: string
  note_id?: string
  task_name?: string
  new_stage?: string
  available_actions: Array<'create_task' | 'open_deal' | 'view_note' | 'change_stage' | 'go_review' | 'dismiss'>
  one_click_action?: {
    endpoint: string
    method: 'POST' | 'PATCH' | 'DELETE'
    payload: Record<string, unknown>
    confirm_message?: string
  }
}

const CHIEF_OF_STAFF_PROMPT = `You are the Chief of Staff for a BD/partnerships team. Your job is to analyze the current pipeline situation and generate highly actionable suggestions.

You will receive:
- Semantically relevant deals that may need follow-up
- Notes containing action items and commitments
- Critical path deals (bridges, oracles, market makers)
- Basic stats (counts, overdue tasks)

Generate 5-8 prioritized suggestions. Each suggestion must be:
1. SPECIFIC - Reference actual company names and details from the context
2. ACTIONABLE - The user should be able to act on it immediately
3. TIMELY - Prioritize overdue items and stale deals

Priority levels:
- critical: Overdue tasks, unfulfilled commitments, deals going cold
- high: Things due soon, deals without recent activity
- medium: Optimization opportunities
- low: Nice-to-haves

Suggestion types:
- action_item: A commitment was made that needs follow-through
- follow_up: A deal needs attention/outreach
- stage_change: A deal should move stages
- task_create: A task should be created
- review_needed: Something needs review

For each suggestion include:
- source_quote: Direct quote from note if applicable
- deal_id: The deal ID (source_id from the context)
- note_id: The note ID if from a note
- task_name: Suggested task name for create_task actions
- new_stage: Target stage for stage_change suggestions
- available_actions: Array from ["create_task", "open_deal", "view_note", "change_stage", "go_review", "dismiss"]

Respond ONLY with a JSON array. No markdown, no explanation.`

// Dedupe search results by source_id
function dedupeResults(results: SemanticSearchResult[]): SemanticSearchResult[] {
  const seen = new Set<string>()
  return results.filter(r => {
    const key = `${r.source_type}:${r.source_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// GET - Return cached suggestions instantly
export async function GET() {
  try {
    if (suggestionsCache) {
      const isFresh = (Date.now() - suggestionsCache.cached_at) < CACHE_TTL_MS
      console.log(`[SUGGESTIONS] GET - Returning ${isFresh ? 'fresh' : 'stale'} cached suggestions`)
      return NextResponse.json({
        suggestions: suggestionsCache.suggestions,
        generated_at: suggestionsCache.generated_at,
        context_summary: suggestionsCache.context_summary,
        cached: true,
        stale: !isFresh,
        cache_age_ms: Date.now() - suggestionsCache.cached_at,
      })
    }

    console.log('[SUGGESTIONS] GET - No cache available')
    return NextResponse.json({
      suggestions: [],
      generated_at: null,
      context_summary: null,
      cached: false,
      stale: true,
    })
  } catch (error) {
    console.error('[SUGGESTIONS] GET Error:', error)
    return NextResponse.json({
      suggestions: [],
      error: error instanceof Error ? error.message : 'Failed to get cached suggestions',
    })
  }
}

// POST - Generate fresh suggestions using semantic search
export async function POST(request: Request) {
  const timings: Record<string, number | string> = {}
  const totalStart = Date.now()

  try {
    const url = new URL(request.url)
    const skipCache = url.searchParams.get('skip_cache') !== 'true'

    // Return cached if fresh
    if (skipCache && suggestionsCache && (Date.now() - suggestionsCache.cached_at) < CACHE_TTL_MS) {
      console.log('[SUGGESTIONS] POST - Returning fresh cached suggestions')
      return NextResponse.json({
        suggestions: suggestionsCache.suggestions,
        generated_at: suggestionsCache.generated_at,
        context_summary: suggestionsCache.context_summary,
        cached: true,
      })
    }

    console.log('[SUGGESTIONS] POST - Generating with semantic search...')

    // Step 1: Parallel semantic searches + basic stats
    const searchStart = Date.now()

    const [
      staleDealsResults,
      actionItemsResults,
      criticalPathResults,
      statsResult,
      tasksResult
    ] = await Promise.all([
      // Deals needing follow-up
      semanticSearch("deals that haven't been contacted recently need follow up stale inactive", {
        sourceTypes: ['deal'],
        limit: 10,
        threshold: 0.65
      }),
      // Notes with action items
      semanticSearch("action items commitments promises to send follow up next steps will send schedule reach out", {
        sourceTypes: ['note'],
        limit: 10,
        threshold: 0.65
      }),
      // Critical path deals
      semanticSearch("bridge oracle market maker liquidity provider onramp fiat chainlink wormhole layerzero", {
        sourceTypes: ['deal'],
        limit: 10,
        threshold: 0.65
      }),
      // Basic stats (fast query)
      (async () => {
        const supabase = getSupabase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [dealsRes, notesRes] = await Promise.all([
          (supabase as any).from('deals').select('id', { count: 'exact', head: true }),
          (supabase as any).from('notes').select('id', { count: 'exact', head: true })
        ])
        return {
          total_deals: dealsRes.count || 0,
          total_notes: notesRes.count || 0
        }
      })(),
      // Overdue tasks from Asana
      (async () => {
        const tasks = await getProjectTasks()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const overdue = (tasks || [])
          .filter(t => !t.completed && t.due_on)
          .filter(t => {
            const due = new Date(t.due_on!)
            due.setHours(0, 0, 0, 0)
            return due < today
          })
          .slice(0, 5)
          .map(t => ({
            name: t.name,
            due_on: t.due_on,
            days_overdue: Math.floor((today.getTime() - new Date(t.due_on!).getTime()) / (1000 * 60 * 60 * 24))
          }))

        return { overdue, total: (tasks || []).filter(t => !t.completed).length }
      })()
    ])

    timings['1_semantic_search_ms'] = Date.now() - searchStart

    // Combine and dedupe results
    const allResults = dedupeResults([
      ...staleDealsResults,
      ...actionItemsResults,
      ...criticalPathResults
    ])

    timings['1a_stale_deals'] = staleDealsResults.length
    timings['1b_action_items'] = actionItemsResults.length
    timings['1c_critical_path'] = criticalPathResults.length
    timings['1d_total_unique'] = allResults.length

    // Step 2: Build focused context
    const buildStart = Date.now()

    const focusedContext = {
      generated_at: new Date().toISOString(),
      stats: {
        total_deals: statsResult.total_deals,
        total_notes: statsResult.total_notes,
        total_tasks: tasksResult.total,
        overdue_tasks: tasksResult.overdue.length
      },
      relevant_items: allResults.map(r => ({
        source_type: r.source_type,
        source_id: r.source_id,
        content: r.content,
        metadata: r.metadata,
        relevance: r.similarity.toFixed(3)
      })),
      overdue_tasks: tasksResult.overdue
    }

    const userMessage = `Here is the current pipeline situation:\n\n${JSON.stringify(focusedContext, null, 2)}\n\nGenerate actionable suggestions based on this context.`

    timings['2_build_prompt_ms'] = Date.now() - buildStart
    timings['2a_prompt_chars'] = userMessage.length
    timings['2b_items_to_claude'] = allResults.length

    // Step 3: Call Claude API
    const claudeStart = Date.now()
    const client = new Anthropic()

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307', // Haiku for speed - 3-5x faster
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      system: CHIEF_OF_STAFF_PROMPT,
    })

    timings['3_claude_api_ms'] = Date.now() - claudeStart
    timings['3a_input_tokens'] = response.usage.input_tokens
    timings['3b_output_tokens'] = response.usage.output_tokens

    // Step 4: Parse response
    const parseStart = Date.now()
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let suggestions: Suggestion[]
    try {
      suggestions = JSON.parse(textContent.text)
    } catch {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse suggestions')
      }
    }
    timings['4_parse_response_ms'] = Date.now() - parseStart

    // Validate and ensure IDs and available_actions
    suggestions = suggestions.map((s, i) => {
      let defaultActions: Suggestion['available_actions'] = ['dismiss']
      switch (s.type) {
        case 'action_item':
        case 'task_create':
          defaultActions = ['create_task', 'dismiss']
          if (s.deal_id) defaultActions.splice(1, 0, 'open_deal')
          if (s.note_id) defaultActions.splice(defaultActions.length - 1, 0, 'view_note')
          break
        case 'follow_up':
          defaultActions = ['create_task', 'dismiss']
          if (s.deal_id) defaultActions.splice(1, 0, 'open_deal')
          break
        case 'stage_change':
          defaultActions = ['change_stage', 'dismiss']
          if (s.deal_id) defaultActions.splice(1, 0, 'open_deal')
          break
        case 'review_needed':
          defaultActions = ['go_review', 'dismiss']
          break
      }

      return {
        ...s,
        id: s.id || `sug_${Date.now()}_${i}`,
        available_actions: s.available_actions || defaultActions,
      }
    })

    // Calculate total and log timings
    timings['5_TOTAL_ms'] = Date.now() - totalStart
    timings['5a_suggestions_count'] = suggestions.length

    console.log('\n=== SUGGESTIONS API TIMING (SEMANTIC) ===')
    console.log(JSON.stringify(timings, null, 2))
    console.log('==========================================\n')

    const result = {
      suggestions,
      generated_at: new Date().toISOString(),
      context_summary: focusedContext.stats,
      timings,
    }

    // Cache the results
    suggestionsCache = {
      ...result,
      cached_at: Date.now(),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[SUGGESTIONS] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
