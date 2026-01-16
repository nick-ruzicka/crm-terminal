import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface ActivityItem {
  id: string
  type: 'deal_updated' | 'deal_created' | 'note_added' | 'task_completed' | 'task_created'
  title: string
  subtitle: string
  timestamp: string
  updated_at: string
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

    // Fetch recent notes
    const { data: notes } = await supabase
      .from('notes')
      .select('id, title, meeting_date, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (notes) {
      notes.forEach(note => {
        activities.push({
          id: `note-${note.id}`,
          type: 'note_added',
          title: note.title || 'Untitled Note',
          subtitle: 'Note',
          timestamp: note.updated_at || note.created_at,
          updated_at: note.updated_at || note.created_at,
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

    // Sort all activities by updated_at descending
    activities.sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime()
      const dateB = new Date(b.updated_at).getTime()
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
