import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { semanticSearch, SemanticSearchResult } from '@/lib/embeddings'
import { getSupabase } from '@/lib/supabase'
import { getMyProjectTasks } from '@/lib/asana'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface SuggestionRow {
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
}

interface GeneratedSuggestion {
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'action_item' | 'follow_up' | 'stage_change' | 'task_create' | 'review_needed'
  title: string
  description: string
  source: {
    type: 'deal' | 'note' | 'task'
    id: string
    name: string
  }
  source_quote?: string
  suggested_action: string
  deal_id?: string
  note_id?: string
  task_name?: string
}

const CHIEF_OF_STAFF_PROMPT = `You are a Chief of Staff assistant. Analyze the pipeline and generate actionable suggestions.

You will receive:
1. semantic_matches: Deals and notes found by relevance search
2. action_notes: Recent notes with FULL CONTENT containing action keywords - look for commitments!
3. overdue_tasks: Tasks past their due date
4. existing_suggestions: Suggestions already in the system - DO NOT duplicate these

PRIORITIZE action_notes - these contain real commitments like:
- "I will send..." / "I'll follow up..."
- "We need to..." / "Next step is..."
- "Action item: ..." / "TODO: ..."

Extract a BRIEF summary as source_quote when you find a commitment (max 100 chars, NO double quotes - use single quotes if needed).

IMPORTANT:
- Check existing_suggestions and DO NOT create duplicates for the same source
- Focus on NEW actionable items not already tracked
- For items shown 5+ times without action, suggest escalation

REQUIRED: Each suggestion MUST have ALL these fields:
{
  "priority": "critical" | "high" | "medium" | "low",
  "type": "action_item" | "follow_up" | "stage_change" | "task_create" | "review_needed",
  "title": "Short action headline (5-10 words)",
  "description": "Why this matters and what to do",
  "source": {
    "type": "deal" | "note" | "task",
    "id": "the source_id/note_id from context",
    "name": "Company name"
  },
  "source_quote": "Exact quote from note if applicable",
  "suggested_action": "What the user should do",
  "deal_id": "deal_id if available",
  "note_id": "note_id if from action_notes",
  "task_name": "Suggested task name"
}

Generate 5-8 NEW suggestions. Output ONLY a JSON array, no markdown.`

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

// Parse JSON with multiple strategies
function parseJsonResponse(text: string): GeneratedSuggestion[] {
  try {
    return JSON.parse(text)
  } catch {
    // Continue
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Continue
    }
  }

  try {
    const json = jsonMatch?.[0] || text
    const repaired = jsonrepair(json)
    console.log('[BG-SUGGESTIONS] Used jsonrepair to fix malformed JSON')
    return JSON.parse(repaired)
  } catch (e) {
    console.error('[BG-SUGGESTIONS] JSON parse failed:', text.slice(0, 500))
    throw new Error('Failed to parse suggestions JSON')
  }
}

export async function POST(request: Request) {
  const startTime = Date.now()
  const supabase = getSupabase()

  try {
    // Verify cron secret for production
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[BG-SUGGESTIONS] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[BG-SUGGESTIONS] Starting background generation...')

    // Step 1: Get existing active suggestions to avoid duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSuggestions } = await (supabase as any)
      .from('suggestions')
      .select('id, title, source_type, source_id, source_name, shown_count, escalated_at')
      .is('dismissed_at', null)
      .is('completed_at', null)

    const existingSourceIds = new Set(
      (existingSuggestions || []).map((s: SuggestionRow) => `${s.source_type}:${s.source_id}`)
    )

    // Check for items needing escalation (shown 5+ times)
    const needsEscalation = (existingSuggestions || []).filter(
      (s: SuggestionRow) => s.shown_count >= 5 && !s.escalated_at
    )

    if (needsEscalation.length > 0) {
      console.log(`[BG-SUGGESTIONS] ${needsEscalation.length} items need escalation`)
      // Mark them as escalated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('suggestions')
        .update({ escalated_at: new Date().toISOString(), priority: 'critical' })
        .in('id', needsEscalation.map((s: SuggestionRow) => s.id))
    }

    // Step 2: Run parallel searches
    const [
      staleDealsResults,
      actionItemsResults,
      criticalPathResults,
      actionNotesResult,
      statsResult,
      tasksResult
    ] = await Promise.all([
      semanticSearch("deals that haven't been contacted recently need follow up stale inactive", {
        sourceTypes: ['deal'],
        limit: 10,
        threshold: 0.65
      }),
      semanticSearch("action items commitments promises to send follow up next steps will send schedule reach out", {
        sourceTypes: ['note'],
        limit: 10,
        threshold: 0.65
      }),
      semanticSearch("bridge oracle market maker liquidity provider onramp fiat chainlink wormhole layerzero", {
        sourceTypes: ['deal'],
        limit: 10,
        threshold: 0.65
      }),
      (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('notes')
          .select('id, content, suggested_company, meeting_date, created_at, deal_id, deals(company)')
          .not('deal_id', 'is', null)
          .not('content', 'is', null)
          .not('content', 'ilike', '%personal crm project%')
          .or('content.ilike.%will send%,content.ilike.%need to%,content.ilike.%follow up%,content.ilike.%next step%,content.ilike.%action item%,content.ilike.%committed%,content.ilike.%schedule%,content.ilike.%i will%')
          .order('created_at', { ascending: false })
          .limit(15)
        return data || []
      })(),
      (async () => {
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
      (async () => {
        const tasks = await getMyProjectTasks()
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

    const semanticResults = dedupeResults([
      ...staleDealsResults,
      ...actionItemsResults,
      ...criticalPathResults
    ])

    // Step 3: Build context for Claude
    const focusedContext = {
      generated_at: new Date().toISOString(),
      stats: {
        total_deals: statsResult.total_deals,
        total_notes: statsResult.total_notes,
        total_tasks: tasksResult.total,
        overdue_tasks: tasksResult.overdue.length
      },
      existing_suggestions: (existingSuggestions || []).map((s: SuggestionRow) => ({
        title: s.title,
        source_type: s.source_type,
        source_id: s.source_id,
        source_name: s.source_name,
        shown_count: s.shown_count
      })),
      semantic_matches: semanticResults.map(r => ({
        source_type: r.source_type,
        source_id: r.source_id,
        content: r.content,
        metadata: r.metadata,
        relevance: r.similarity.toFixed(3)
      })),
      action_notes: actionNotesResult.map((n: { id: string; content: string; suggested_company: string | null; meeting_date: string | null; created_at: string; deal_id: string | null; deals: { company: string } | null }) => ({
        note_id: n.id,
        deal_id: n.deal_id,
        company: n.deals?.company || n.suggested_company || 'Unknown',
        meeting_date: n.meeting_date,
        created_at: n.created_at,
        full_content: n.content?.substring(0, 500)
      })),
      overdue_tasks: tasksResult.overdue
    }

    const userMessage = `Here is the current pipeline situation:\n\n${JSON.stringify(focusedContext, null, 2)}\n\nGenerate NEW actionable suggestions that are not already tracked. Focus on items from action_notes.`

    // Step 4: Call Claude
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: CHIEF_OF_STAFF_PROMPT,
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const suggestions = parseJsonResponse(textContent.text)

    // Step 5: Filter out duplicates and insert new suggestions
    const newSuggestions = suggestions.filter(s => {
      const key = `${s.source.type}:${s.source.id}`
      return !existingSourceIds.has(key)
    })

    if (newSuggestions.length > 0) {
      const rows = newSuggestions.map(s => ({
        title: s.title,
        description: s.description,
        priority: s.priority,
        type: s.type,
        source_type: s.source.type,
        source_id: s.source.id,
        source_name: s.source.name,
        source_quote: s.source_quote || null,
        suggested_action: {
          action: s.suggested_action,
          deal_id: s.deal_id,
          note_id: s.note_id,
          task_name: s.task_name
        }
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('suggestions')
        .insert(rows)

      if (error) {
        console.error('[BG-SUGGESTIONS] Insert error:', error)
        throw error
      }

      console.log(`[BG-SUGGESTIONS] Inserted ${newSuggestions.length} new suggestions`)
    } else {
      console.log('[BG-SUGGESTIONS] No new suggestions to insert')
    }

    const duration = Date.now() - startTime
    console.log(`[BG-SUGGESTIONS] Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      new_suggestions: newSuggestions.length,
      existing_suggestions: existingSuggestions?.length || 0,
      escalated: needsEscalation.length,
      duration_ms: duration
    })

  } catch (error) {
    console.error('[BG-SUGGESTIONS] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}

// GET returns stats only
export async function GET() {
  const supabase = getSupabase()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('suggestions')
      .select('id, priority, created_at, dismissed_at, completed_at, shown_count')

    if (error) throw error

    const active = (data || []).filter((s: { dismissed_at: string | null; completed_at: string | null }) =>
      !s.dismissed_at && !s.completed_at
    )
    const dismissed = (data || []).filter((s: { dismissed_at: string | null }) => s.dismissed_at)
    const completed = (data || []).filter((s: { completed_at: string | null }) => s.completed_at)

    return NextResponse.json({
      total: data?.length || 0,
      active: active.length,
      dismissed: dismissed.length,
      completed: completed.length,
      by_priority: {
        critical: active.filter((s: { priority: string }) => s.priority === 'critical').length,
        high: active.filter((s: { priority: string }) => s.priority === 'high').length,
        medium: active.filter((s: { priority: string }) => s.priority === 'medium').length,
        low: active.filter((s: { priority: string }) => s.priority === 'low').length,
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    )
  }
}
