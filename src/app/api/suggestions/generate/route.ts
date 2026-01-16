import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
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
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes - suggestions don't change fast

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

const CHIEF_OF_STAFF_PROMPT = `You are a Chief of Staff assistant. Analyze the pipeline and generate actionable suggestions.

You will receive:
1. semantic_matches: Deals and notes found by relevance search
2. action_notes: Recent notes with FULL CONTENT containing action keywords - look for commitments!
3. overdue_tasks: Tasks past their due date

PRIORITIZE action_notes - these contain real commitments like:
- "I will send..." / "I'll follow up..."
- "We need to..." / "Next step is..."
- "Action item: ..." / "TODO: ..."

Extract a BRIEF summary as source_quote when you find a commitment (max 100 chars, NO double quotes - use single quotes if needed).

REQUIRED: Each suggestion MUST have ALL these fields:
{
  "id": "sug_1",
  "priority": "critical" | "high" | "medium" | "low",
  "type": "action_item" | "follow_up" | "stage_change" | "task_create" | "review_needed",
  "title": "Short action headline (5-10 words)",
  "description": "Why this matters and what to do",
  "source": {
    "type": "deal" | "note",
    "id": "the source_id/note_id from context",
    "name": "Company name"
  },
  "source_quote": "Exact quote from note if applicable",
  "suggested_action": "What the user should do",
  "deal_id": "deal_id if available",
  "note_id": "note_id if from action_notes",
  "task_name": "Suggested task name",
  "available_actions": ["create_task", "open_deal", "view_note", "dismiss"]
}

Generate 5-8 suggestions. Output ONLY a JSON array, no markdown.`

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

// Attempt to parse JSON with multiple strategies
function parseJsonResponse(text: string): Suggestion[] {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(text)
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract JSON array and parse
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Use jsonrepair library
  try {
    const json = jsonMatch?.[0] || text
    const repaired = jsonrepair(json)
    console.log('[SUGGESTIONS] Used jsonrepair to fix malformed JSON')
    return JSON.parse(repaired)
  } catch (e) {
    // Log the failed JSON for debugging
    console.error('[SUGGESTIONS] JSON repair failed. First 500 chars:', text.slice(0, 500))
    console.error('[SUGGESTIONS] Parse error:', e)
    throw new Error('Failed to parse suggestions JSON')
  }
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

    console.log('[SUGGESTIONS] POST - Generating with hybrid search...')

    // Step 1: Parallel semantic searches + action notes + stats
    const searchStart = Date.now()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const [
      staleDealsResults,
      actionItemsResults,
      criticalPathResults,
      actionNotesResult,
      statsResult,
      tasksResult
    ] = await Promise.all([
      // Semantic: Deals needing follow-up
      semanticSearch("deals that haven't been contacted recently need follow up stale inactive", {
        sourceTypes: ['deal'],
        limit: 10,
        threshold: 0.65
      }),
      // Semantic: Notes with action items
      semanticSearch("action items commitments promises to send follow up next steps will send schedule reach out", {
        sourceTypes: ['note'],
        limit: 10,
        threshold: 0.65
      }),
      // Semantic: Critical path deals
      semanticSearch("bridge oracle market maker liquidity provider onramp fiat chainlink wormhole layerzero", {
        sourceTypes: ['deal'],
        limit: 10,
        threshold: 0.65
      }),
      // HYBRID: Direct query for notes with action keywords (full content)
      // Only include notes linked to deals (partner meetings, not internal)
      (async () => {
        const supabase = getSupabase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('notes')
          .select('id, content, suggested_company, meeting_date, created_at, deal_id, deals(company)')
          .not('deal_id', 'is', null) // Only notes linked to deals
          .not('content', 'is', null)
          .not('content', 'ilike', '%personal crm project%') // Exclude internal notes
          .or('content.ilike.%will send%,content.ilike.%need to%,content.ilike.%follow up%,content.ilike.%next step%,content.ilike.%action item%,content.ilike.%committed%,content.ilike.%schedule%,content.ilike.%i will%')
          .order('created_at', { ascending: false })
          .limit(15) // Increased limit since we filter more
        return data || []
      })(),
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

    timings['1_hybrid_search_ms'] = Date.now() - searchStart

    // Combine and dedupe semantic results
    const semanticResults = dedupeResults([
      ...staleDealsResults,
      ...actionItemsResults,
      ...criticalPathResults
    ])

    timings['1a_stale_deals'] = staleDealsResults.length
    timings['1b_action_items'] = actionItemsResults.length
    timings['1c_critical_path'] = criticalPathResults.length
    timings['1d_action_notes'] = actionNotesResult.length
    timings['1e_semantic_unique'] = semanticResults.length

    // Step 2: Build hybrid context (semantic + full content)
    const buildStart = Date.now()

    const focusedContext = {
      generated_at: new Date().toISOString(),
      stats: {
        total_deals: statsResult.total_deals,
        total_notes: statsResult.total_notes,
        total_tasks: tasksResult.total,
        overdue_tasks: tasksResult.overdue.length
      },
      // Semantic search results (deals and notes by relevance)
      semantic_matches: semanticResults.map(r => ({
        source_type: r.source_type,
        source_id: r.source_id,
        content: r.content,
        metadata: r.metadata,
        relevance: r.similarity.toFixed(3)
      })),
      // Full content notes with action keywords - for extracting quotes
      action_notes: actionNotesResult.map((n: { id: string; content: string; suggested_company: string | null; meeting_date: string | null; created_at: string; deal_id: string | null; deals: { company: string } | null }) => ({
        note_id: n.id,
        deal_id: n.deal_id,
        company: n.deals?.company || n.suggested_company || 'Unknown', // Prefer deal company
        meeting_date: n.meeting_date,
        created_at: n.created_at,
        full_content: n.content?.substring(0, 500) // Include more content for quote extraction
      })),
      overdue_tasks: tasksResult.overdue
    }

    const userMessage = `Here is the current pipeline situation:\n\n${JSON.stringify(focusedContext, null, 2)}\n\nGenerate actionable suggestions. For action_notes, extract specific quotes where someone committed to doing something.`

    timings['2_build_prompt_ms'] = Date.now() - buildStart
    timings['2a_prompt_chars'] = userMessage.length
    timings['2b_semantic_items'] = semanticResults.length
    timings['2c_action_notes'] = actionNotesResult.length

    // Step 3: Call Claude API
    const claudeStart = Date.now()
    const client = new Anthropic()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514', // Sonnet for quality, 30min cache for speed
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

    let suggestions: Suggestion[] = parseJsonResponse(textContent.text)
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
