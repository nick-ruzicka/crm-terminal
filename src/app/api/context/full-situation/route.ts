import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProjectTasks } from '@/lib/asana'

export const dynamic = 'force-dynamic'

// Action patterns to detect commitments in notes
const ACTION_PATTERNS = [
  /\bi['']ll\b/i,
  /\bi will\b/i,
  /\bwe should\b/i,
  /\bneed to\b/i,
  /\bfollow up\b/i,
  /\bnext step[s]?\b/i,
  /\baction item[s]?\b/i,
  /\btodo\b/i,
  /\bwill send\b/i,
  /\bwill schedule\b/i,
  /\bwill reach out\b/i,
  /\blet me\b/i,
  /\bgoing to\b/i,
]

// Critical path categories
const CRITICAL_PATH_KEYWORDS = [
  'bridge', 'wormhole', 'layerzero', 'axelar', 'hyperlane', 'polymer',
  'onramp', 'on-ramp', 'fiat', 'moonpay', 'transak', 'ramp', 'sardine',
  'market maker', 'mm', 'wintermute', 'jump', 'gsr', 'cumberland',
  'oracle', 'chainlink', 'pyth', 'api3',
  'prediction', 'polymarket', 'kalshi',
]

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  const date = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function hasActionKeywords(content: string): boolean {
  if (!content) return false
  return ACTION_PATTERNS.some(pattern => pattern.test(content))
}

function extractActionItems(content: string): string[] {
  if (!content) return []

  const sentences = content.split(/[.!?\n]+/)
  const actionItems: string[] = []

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (trimmed.length < 10) continue

    for (const pattern of ACTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        actionItems.push(trimmed)
        break
      }
    }
  }

  return actionItems.slice(0, 3) // Max 3 action items per note
}

function isCriticalPath(company: string | null, name: string | null): boolean {
  const searchText = `${company || ''} ${name || ''}`.toLowerCase()
  return CRITICAL_PATH_KEYWORDS.some(keyword => searchText.includes(keyword))
}

interface DealRow {
  id: string
  name: string
  company: string | null
  stage: string | null
  deal_type: string | null
  source: string | null
  updated_at: string | null
  created_at: string
}

interface NoteRow {
  id: string
  deal_id: string | null
  content: string | null
  meeting_date: string | null
  created_at: string
  suggested_company: string | null
  is_potential_deal: boolean | null
  review_status: string | null
}

export async function POST() {
  const timings: Record<string, number> = {}
  const totalStart = Date.now()

  try {
    const supabase = getSupabase()
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Fetch all data in parallel with individual timing
    const fetchStart = Date.now()

    const dealsPromise = (async () => {
      const start = Date.now()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (supabase as any).from('deals').select('id, name, company, stage, deal_type, source, updated_at, created_at')
      timings['db_deals_ms'] = Date.now() - start
      return res
    })()

    const notesPromise = (async () => {
      const start = Date.now()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (supabase as any).from('notes').select('id, deal_id, content, meeting_date, created_at, suggested_company, is_potential_deal, review_status')
      timings['db_notes_ms'] = Date.now() - start
      return res
    })()

    const tasksPromise = (async () => {
      const start = Date.now()
      const res = await getProjectTasks()
      timings['asana_tasks_ms'] = Date.now() - start
      return res
    })()

    const [dealsRes, notesRes, tasksResult] = await Promise.all([dealsPromise, notesPromise, tasksPromise])
    timings['total_fetch_parallel_ms'] = Date.now() - fetchStart

    const deals: DealRow[] = dealsRes.data || []
    const notes: NoteRow[] = notesRes.data || []
    const tasks = tasksResult || []

    timings['row_count_deals'] = deals.length
    timings['row_count_notes'] = notes.length
    timings['row_count_tasks'] = tasks.length

    // Build lookup maps
    const dealMap = new Map(deals.map(d => [d.id, d]))
    const dealByCompany = new Map(deals.map(d => [d.company?.toLowerCase(), d]))

    // Calculate notes per deal and last note date
    const notesByDeal = new Map<string, { count: number; lastDate: Date | null }>()
    for (const note of notes) {
      if (note.deal_id) {
        const existing = notesByDeal.get(note.deal_id) || { count: 0, lastDate: null }
        existing.count++
        const noteDate = new Date(note.created_at)
        if (!existing.lastDate || noteDate > existing.lastDate) {
          existing.lastDate = noteDate
        }
        notesByDeal.set(note.deal_id, existing)
      }
    }

    // === FOCUSED DEALS: Only ones that need attention ===
    const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

    const processedDeals = activeDeals.map(deal => {
      const noteInfo = notesByDeal.get(deal.id)
      const lastNoteDate = noteInfo?.lastDate
      const daysSinceNote = lastNoteDate ? daysSince(lastNoteDate.toISOString()) : -1
      const daysSinceUpdate = daysSince(deal.updated_at)

      return {
        id: deal.id,
        company: deal.company || deal.name,
        stage: deal.stage,
        deal_type: deal.deal_type,
        days_since_note: daysSinceNote,
        days_since_update: daysSinceUpdate,
        note_count: noteInfo?.count || 0,
        is_critical_path: isCriticalPath(deal.company, deal.name),
      }
    })

    // FILTER 1: Critical path deals without recent notes (max 10)
    const criticalPathStale = processedDeals
      .filter(d => d.is_critical_path && (d.days_since_note >= 7 || d.days_since_note === -1))
      .sort((a, b) => b.days_since_note - a.days_since_note)
      .slice(0, 10)

    // FILTER 2: Deals in negotiation stage (max 10)
    const negotiationDeals = processedDeals
      .filter(d => d.stage === 'negotiation')
      .slice(0, 10)

    // FILTER 3: Stale deals - no update in 14+ days (max 10)
    const staleDeals = processedDeals
      .filter(d => !d.is_critical_path && (d.days_since_note >= 14 || (d.days_since_note === -1 && d.days_since_update >= 14)))
      .sort((a, b) => b.days_since_note - a.days_since_note)
      .slice(0, 10)

    // === FOCUSED NOTES: Only ones with action items or unlinked ===

    // FILTER 4: Recent notes WITH action keywords (max 10)
    const recentNotesWithActions = notes
      .filter(n => new Date(n.created_at) >= sevenDaysAgo && hasActionKeywords(n.content || ''))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(n => ({
        id: n.id,
        deal_id: n.deal_id,
        deal_name: n.deal_id ? dealMap.get(n.deal_id)?.company || 'Unknown' : null,
        suggested_company: n.suggested_company,
        meeting_date: n.meeting_date,
        created_at: n.created_at,
        action_items: extractActionItems(n.content || ''),
        content_preview: n.content?.substring(0, 200) || '',
      }))

    // FILTER 5: Unlinked notes from last 14 days (max 10)
    const unlinkedNotes = notes
      .filter(n => !n.deal_id && new Date(n.created_at) >= fourteenDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(n => ({
        id: n.id,
        suggested_company: n.suggested_company,
        content_preview: n.content?.substring(0, 150) || '',
        created_at: n.created_at,
        is_potential_deal: n.is_potential_deal,
      }))

    // === FOCUSED TASKS: Overdue + due soon ===
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const incompleteTasks = tasks.filter(t => !t.completed)

    // FILTER 6: Overdue tasks (all of them - critical)
    const overdueTasks = incompleteTasks
      .filter(t => {
        if (!t.due_on) return false
        const due = new Date(t.due_on)
        due.setHours(0, 0, 0, 0)
        return due < today
      })
      .map(t => {
        const due = new Date(t.due_on!)
        due.setHours(0, 0, 0, 0)
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

        // Try to link to deal
        let linkedDeal: string | null = null
        const taskNameLower = t.name.toLowerCase()
        for (const [companyLower, deal] of Array.from(dealByCompany.entries())) {
          if (companyLower && taskNameLower.includes(companyLower)) {
            linkedDeal = deal.company || deal.name
            break
          }
        }

        return {
          id: t.gid,
          name: t.name,
          due_on: t.due_on,
          days_overdue: daysOverdue,
          linked_deal: linkedDeal,
        }
      })
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 10)

    // FILTER 7: Due this week (max 10)
    const dueThisWeek = incompleteTasks
      .filter(t => {
        if (!t.due_on) return false
        const due = new Date(t.due_on)
        due.setHours(0, 0, 0, 0)
        return due >= today && due <= weekFromNow
      })
      .map(t => {
        let linkedDeal: string | null = null
        const taskNameLower = t.name.toLowerCase()
        for (const [companyLower, deal] of Array.from(dealByCompany.entries())) {
          if (companyLower && taskNameLower.includes(companyLower)) {
            linkedDeal = deal.company || deal.name
            break
          }
        }

        return {
          id: t.gid,
          name: t.name,
          due_on: t.due_on,
          linked_deal: linkedDeal,
        }
      })
      .sort((a, b) => new Date(a.due_on!).getTime() - new Date(b.due_on!).getTime())
      .slice(0, 10)

    // === FOCUSED CONTEXT - Only what matters ===
    const focusedContext = {
      generated_at: new Date().toISOString(),
      summary: {
        total_deals: deals.length,
        active_deals: activeDeals.length,
        total_notes: notes.length,
        incomplete_tasks: incompleteTasks.length,
      },
      needs_attention: {
        critical_path_stale: criticalPathStale,
        negotiation_deals: negotiationDeals,
        other_stale: staleDeals,
      },
      recent_notes_with_actions: recentNotesWithActions,
      unlinked_notes: unlinkedNotes,
      tasks: {
        overdue: overdueTasks,
        due_this_week: dueThisWeek,
      },
    }

    // Count items being sent
    const itemCount =
      criticalPathStale.length +
      negotiationDeals.length +
      staleDeals.length +
      recentNotesWithActions.length +
      unlinkedNotes.length +
      overdueTasks.length +
      dueThisWeek.length

    timings['items_sent'] = itemCount
    timings['total_ms'] = Date.now() - totalStart
    timings['processing_ms'] = timings['total_ms'] - timings['total_fetch_parallel_ms']

    console.log('\n=== FULL SITUATION API TIMING ===')
    console.log(JSON.stringify(timings, null, 2))
    console.log(`Items sent to Claude: ${itemCount} (was 650+)`)
    console.log('=================================\n')

    return NextResponse.json({ ...focusedContext, timings })
  } catch (error) {
    console.error('[FULL SITUATION] Error:', error)
    return NextResponse.json({ error: 'Failed to assemble context' }, { status: 500 })
  }
}
