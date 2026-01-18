import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRecentActivityLogs } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface ActivityItem {
  id: string
  type: 'deal_updated' | 'deal_created' | 'deal_deleted' | 'deal_restored' | 'bulk_delete' | 'bulk_stage_change' | 'note_added' | 'task_completed' | 'task_created' | 'task_deleted'
  title: string
  subtitle: string
  timestamp: string
  updated_at: string
  metadata?: {
    count?: number
    companies?: string[]
    to_stage?: string
    from_stages?: string[]
    search_query?: string
    triggered_by?: string
  }
}

export async function GET() {
  try {
    const supabase = getSupabase()
    const activities: ActivityItem[] = []

    // Fetch recent deals (created or updated)
    const { data: deals } = await supabase
      .from('deals')
      .select('id, company, name, stage, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (deals) {
      deals.forEach(deal => {
        const isNew = deal.created_at === deal.updated_at
        activities.push({
          id: `deal-${deal.id}`,
          type: isNew ? 'deal_created' : 'deal_updated',
          title: deal.company || deal.name || 'Unnamed Deal',
          subtitle: deal.stage || 'Lead',
          timestamp: deal.updated_at,
          updated_at: deal.updated_at,
        })
      })
    }

    // Fetch recent notes (join with deals to get company name)
    const { data: notes } = await supabase
      .from('notes')
      .select('id, content, suggested_company, meeting_date, created_at, deal_id, deals(company)')
      .order('created_at', { ascending: false })
      .limit(10)

    if (notes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notes.forEach((note: any) => {
        // Get title from deal company, suggested_company, or first 30 chars of content
        // deals can be an object or array depending on Supabase query
        const dealCompany = Array.isArray(note.deals) ? note.deals[0]?.company : note.deals?.company
        const noteTitle = dealCompany || note.suggested_company ||
          (note.content ? note.content.slice(0, 30) + (note.content.length > 30 ? '...' : '') : 'Untitled Note')
        activities.push({
          id: `note-${note.id}`,
          type: 'note_added',
          title: noteTitle,
          subtitle: 'Note',
          timestamp: note.created_at,
          updated_at: note.created_at,
        })
      })
    }

    // Fetch recent tasks from Asana (completed or created recently)
    // We'll use the tasks API to get this data
    try {
      const tasksRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tasks`
      )
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const tasks = tasksData.tasks || []

        // Get recent tasks (sorted by modified_at if available)
        tasks.slice(0, 10).forEach((task: { gid: string; name: string; completed: boolean; completed_at?: string; modified_at?: string; created_at?: string }) => {
          const timestamp = task.completed_at || task.modified_at || task.created_at
          if (timestamp) {
            activities.push({
              id: `task-${task.gid}`,
              type: task.completed ? 'task_completed' : 'task_created',
              title: task.name || 'Unnamed Task',
              subtitle: task.completed ? 'Completed' : 'Task',
              timestamp: timestamp,
              updated_at: timestamp,
            })
          }
        })
      }
    } catch (e) {
      console.error('Failed to fetch tasks for activity:', e)
    }

    // Fetch recent activity logs (deletions, bulk actions, etc.)
    try {
      const activityLogs = await getRecentActivityLogs(15)
      console.log('[ACTIVITY] Activity logs fetched:', activityLogs.length)
      activityLogs.forEach(log => {
        const metadata = log.metadata as Record<string, unknown> | undefined

        if (log.type === 'deal_deleted') {
          activities.push({
            id: log.id,
            type: 'deal_deleted',
            title: log.title,
            subtitle: 'Deleted',
            timestamp: log.created_at,
            updated_at: log.created_at,
          })
        } else if (log.type === 'deal_restored') {
          activities.push({
            id: log.id,
            type: 'deal_restored',
            title: log.title,
            subtitle: 'Restored',
            timestamp: log.created_at,
            updated_at: log.created_at,
          })
        } else if (log.type === 'bulk_delete') {
          activities.push({
            id: log.id,
            type: 'bulk_delete',
            title: log.title,
            subtitle: 'Bulk Delete',
            timestamp: log.created_at,
            updated_at: log.created_at,
            metadata: {
              count: metadata?.count as number,
              companies: metadata?.companies as string[],
              search_query: metadata?.search_query as string,
              triggered_by: metadata?.triggered_by as string,
            },
          })
        } else if (log.type === 'bulk_stage_change') {
          activities.push({
            id: log.id,
            type: 'bulk_stage_change',
            title: log.title,
            subtitle: 'Bulk Update',
            timestamp: log.created_at,
            updated_at: log.created_at,
            metadata: {
              count: metadata?.count as number,
              companies: metadata?.companies as string[],
              to_stage: metadata?.to_stage as string,
              from_stages: metadata?.from_stages as string[],
              triggered_by: metadata?.triggered_by as string,
            },
          })
        } else if (log.type === 'task_completed') {
          activities.push({
            id: log.id,
            type: 'task_completed',
            title: log.title,
            subtitle: (metadata?.completed as boolean) ? 'Completed' : 'Reopened',
            timestamp: log.created_at,
            updated_at: log.created_at,
          })
        } else if (log.type === 'task_deleted') {
          activities.push({
            id: log.id,
            type: 'task_deleted',
            title: log.title,
            subtitle: 'Deleted',
            timestamp: log.created_at,
            updated_at: log.created_at,
          })
        } else if (log.type === 'task_created') {
          activities.push({
            id: log.id,
            type: 'task_created',
            title: log.title,
            subtitle: 'Created',
            timestamp: log.created_at,
            updated_at: log.created_at,
          })
        }
      })
    } catch (e) {
      console.error('Failed to fetch activity logs:', e)
    }

    // Sort all activities by updated_at descending
    // Normalize timestamps: if no timezone, assume UTC (append Z)
    const normalizeTimestamp = (ts: string) => {
      if (!ts) return 0
      // If timestamp doesn't have timezone info, treat as UTC
      const normalized = ts.includes('+') || ts.includes('Z') ? ts : ts + 'Z'
      return new Date(normalized).getTime()
    }

    activities.sort((a, b) => {
      const dateA = normalizeTimestamp(a.updated_at)
      const dateB = normalizeTimestamp(b.updated_at)
      return dateB - dateA
    })

    // Return top 5
    return NextResponse.json({
      activities: activities.slice(0, 5),
    })
  } catch (error) {
    console.error('[ACTIVITY] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}
