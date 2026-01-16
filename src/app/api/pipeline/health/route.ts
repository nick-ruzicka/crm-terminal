import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getProjectTasks } from '@/lib/asana'

export const dynamic = 'force-dynamic'

interface AttentionItem {
  type: 'deal_stale' | 'task_overdue' | 'review_pending' | 'deal_no_notes' | 'closing_with_tasks'
  deal?: string
  task?: string
  note?: string
  days?: number
  confidence?: number
  action: string
  priority: 'high' | 'medium' | 'low'
}

interface PipelineHealth {
  summary: {
    deals_active: number
    deals_total: number
    tasks_overdue: number
    tasks_total: number
    reviews_pending: number
    followups_needed: number
  }
  needsAttention: AttentionItem[]
  dealsWithoutRecentNotes: Array<{
    id: string
    company: string
    stage: string
    days_since_note: number
  }>
  closingDealsWithOpenTasks: Array<{
    deal: string
    deal_id: string
    stage: string
    open_tasks: number
  }>
  healthScore: number
}

function daysSince(dateStr: string): number {
  const date = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST() {
  try {
    const supabase = getSupabase()

    // Fetch all data in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dealsRes, notesRes, tasksResult] = await Promise.all([
      (supabase as any).from('deals').select('id, name, company, stage, updated_at'),
      (supabase as any).from('notes').select('id, deal_id, review_status, is_potential_deal, suggested_company, confidence, created_at'),
      getProjectTasks(),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals: any[] = dealsRes.data || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notes: any[] = notesRes.data || []
    const tasks = tasksResult || []

    // Build deal lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealMap = new Map(deals.map((d: any) => [d.id, d]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealByCompany = new Map(deals.map((d: any) => [d.company?.toLowerCase(), d]))

    // Active deals (not closed)
    const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

    // Overdue tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdueTasks = tasks.filter(t => {
      if (t.completed || !t.due_on) return false
      const due = new Date(t.due_on)
      due.setHours(0, 0, 0, 0)
      return due < today
    })

    // Pending reviews
    const pendingReviews = notes.filter(n => n.is_potential_deal && n.review_status === 'pending')

    // Notes by deal
    const notesByDeal = new Map<string, Date>()
    for (const note of notes) {
      if (note.deal_id) {
        const existing = notesByDeal.get(note.deal_id)
        const noteDate = new Date(note.created_at)
        if (!existing || noteDate > existing) {
          notesByDeal.set(note.deal_id, noteDate)
        }
      }
    }

    // Deals without recent notes (14+ days)
    const dealsWithoutRecentNotes: PipelineHealth['dealsWithoutRecentNotes'] = []
    for (const deal of activeDeals) {
      const lastNote = notesByDeal.get(deal.id)
      const daysSinceNote = lastNote ? daysSince(lastNote.toISOString()) : 999
      if (daysSinceNote >= 14) {
        dealsWithoutRecentNotes.push({
          id: deal.id,
          company: deal.company || deal.name,
          stage: deal.stage,
          days_since_note: daysSinceNote === 999 ? -1 : daysSinceNote, // -1 means no notes ever
        })
      }
    }
    dealsWithoutRecentNotes.sort((a, b) => b.days_since_note - a.days_since_note)

    // Closing deals with open tasks
    const closingStages = ['negotiation', 'closed_won']
    const closingDealsWithOpenTasks: PipelineHealth['closingDealsWithOpenTasks'] = []

    // Count tasks by deal (by matching company name in task name)
    const tasksByDeal = new Map<string, number>()
    for (const task of tasks) {
      if (task.completed) continue
      const taskNameLower = task.name.toLowerCase()
      for (const [companyLower, deal] of Array.from(dealByCompany.entries())) {
        if (companyLower && taskNameLower.includes(companyLower)) {
          tasksByDeal.set(deal.id, (tasksByDeal.get(deal.id) || 0) + 1)
          break
        }
      }
    }

    for (const deal of deals) {
      if (closingStages.includes(deal.stage)) {
        const openTasks = tasksByDeal.get(deal.id) || 0
        if (openTasks > 0) {
          closingDealsWithOpenTasks.push({
            deal: deal.company || deal.name,
            deal_id: deal.id,
            stage: deal.stage,
            open_tasks: openTasks,
          })
        }
      }
    }

    // Build needs attention list
    const needsAttention: AttentionItem[] = []

    // Stale deals (14+ days no update, in active stages)
    for (const deal of activeDeals) {
      const daysSinceUpdate = daysSince(deal.updated_at)
      if (daysSinceUpdate >= 14) {
        needsAttention.push({
          type: 'deal_stale',
          deal: deal.company || deal.name,
          days: daysSinceUpdate,
          action: 'Schedule follow-up',
          priority: daysSinceUpdate >= 30 ? 'high' : 'medium',
        })
      }
    }

    // Overdue tasks
    for (const task of overdueTasks.slice(0, 10)) {
      const due = new Date(task.due_on!)
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

      // Try to find linked deal
      let linkedDeal: string | undefined
      const taskNameLower = task.name.toLowerCase()
      for (const [companyLower, deal] of Array.from(dealByCompany.entries())) {
        if (companyLower && taskNameLower.includes(companyLower)) {
          linkedDeal = deal.company || deal.name
          break
        }
      }

      needsAttention.push({
        type: 'task_overdue',
        task: task.name,
        deal: linkedDeal,
        days: daysOverdue,
        action: 'Complete or reschedule',
        priority: daysOverdue >= 7 ? 'high' : 'medium',
      })
    }

    // Pending reviews
    for (const note of pendingReviews.slice(0, 5)) {
      needsAttention.push({
        type: 'review_pending',
        note: note.suggested_company || 'Meeting note',
        confidence: note.confidence,
        action: 'Review and link to deal',
        priority: (note.confidence || 0) >= 80 ? 'high' : 'medium',
      })
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    needsAttention.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    // Calculate health score (0-100)
    let healthScore = 100

    // Deductions
    healthScore -= Math.min(overdueTasks.length * 5, 25) // Max 25 points for overdue tasks
    healthScore -= Math.min(pendingReviews.length * 3, 15) // Max 15 points for pending reviews
    healthScore -= Math.min(dealsWithoutRecentNotes.length * 2, 20) // Max 20 points for stale deals
    healthScore -= Math.min(closingDealsWithOpenTasks.length * 5, 20) // Max 20 points for closing deals with tasks

    // Bonus for active deals
    if (activeDeals.length > 50) healthScore += 5
    if (activeDeals.length > 100) healthScore += 5

    healthScore = Math.max(0, Math.min(100, healthScore))

    const result: PipelineHealth = {
      summary: {
        deals_active: activeDeals.length,
        deals_total: deals.length,
        tasks_overdue: overdueTasks.length,
        tasks_total: tasks.filter(t => !t.completed).length,
        reviews_pending: pendingReviews.length,
        followups_needed: dealsWithoutRecentNotes.length,
      },
      needsAttention: needsAttention.slice(0, 15),
      dealsWithoutRecentNotes: dealsWithoutRecentNotes.slice(0, 10),
      closingDealsWithOpenTasks,
      healthScore,
    }

    console.log(`[PIPELINE HEALTH] Score: ${healthScore}, ${needsAttention.length} items need attention`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[PIPELINE HEALTH] Error:', error)
    return NextResponse.json({ error: 'Failed to analyze pipeline health' }, { status: 500 })
  }
}
