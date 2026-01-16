import { NextResponse } from 'next/server'
import { getProjectTasks } from '@/lib/asana'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface TaskAnalysis {
  total: number
  byStatus: {
    todo: number
    in_progress: number
    done: number
  }
  overdue: Array<{
    id: string
    title: string
    deal_name: string | null
    days_overdue: number
  }>
  dueThisWeek: Array<{
    id: string
    title: string
    deal_name: string | null
    due_date: string
  }>
  unlinked: number
  byDeal: Record<string, { deal_name: string; task_count: number }>
}

function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

function isDueThisWeek(dueDate: string): boolean {
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)
  return due >= today && due <= weekFromNow
}

export async function POST() {
  try {
    // Get tasks from Asana
    const tasks = await getProjectTasks()

    // Get deals for linking task names to deals
    const supabase = getSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deals } = await (supabase as any)
      .from('deals')
      .select('id, name, company')

    const dealMap = new Map<string | undefined, { id: string; name: string }>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (deals || []).map((d: any) => [d.company?.toLowerCase(), { id: d.id, name: d.company || d.name }])
    )

    // Analyze tasks
    const analysis: TaskAnalysis = {
      total: tasks.length,
      byStatus: {
        todo: 0,
        in_progress: 0,
        done: 0,
      },
      overdue: [],
      dueThisWeek: [],
      unlinked: 0,
      byDeal: {},
    }

    for (const task of tasks) {
      // Count by status
      if (task.completed) {
        analysis.byStatus.done++
      } else {
        // Determine if in progress based on section name
        const sectionName = task.memberships?.[0]?.section?.name?.toLowerCase() || ''
        if (sectionName.includes('progress') || sectionName.includes('doing')) {
          analysis.byStatus.in_progress++
        } else {
          analysis.byStatus.todo++
        }
      }

      // Try to link task to deal by searching task name for company names
      let linkedDeal: { id: string; name: string } | null = null
      const taskNameLower = task.name.toLowerCase()
      for (const [companyLower, deal] of Array.from(dealMap.entries())) {
        if (companyLower && taskNameLower.includes(companyLower)) {
          linkedDeal = deal
          break
        }
      }

      if (!linkedDeal) {
        analysis.unlinked++
      } else {
        // Track by deal
        if (!analysis.byDeal[linkedDeal.id]) {
          analysis.byDeal[linkedDeal.id] = { deal_name: linkedDeal.name, task_count: 0 }
        }
        analysis.byDeal[linkedDeal.id].task_count++
      }

      // Check overdue
      if (!task.completed && task.due_on) {
        const daysOverdue = getDaysOverdue(task.due_on)
        if (daysOverdue > 0) {
          analysis.overdue.push({
            id: task.gid,
            title: task.name,
            deal_name: linkedDeal?.name || null,
            days_overdue: daysOverdue,
          })
        } else if (isDueThisWeek(task.due_on)) {
          analysis.dueThisWeek.push({
            id: task.gid,
            title: task.name,
            deal_name: linkedDeal?.name || null,
            due_date: task.due_on,
          })
        }
      }
    }

    // Sort overdue by days (most overdue first)
    analysis.overdue.sort((a, b) => b.days_overdue - a.days_overdue)

    // Sort due this week by date
    analysis.dueThisWeek.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

    console.log(`[TASKS ANALYZE] ${analysis.total} tasks, ${analysis.overdue.length} overdue, ${analysis.dueThisWeek.length} due this week`)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('[TASKS ANALYZE] Error:', error)
    return NextResponse.json({ error: 'Failed to analyze tasks' }, { status: 500 })
  }
}
