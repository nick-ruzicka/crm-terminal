/**
 * Activity logging for tracking deletions, bulk actions, and other events using Supabase
 */

import { getSupabase } from '@/lib/supabase'

export type ActivityType =
  | 'deal_deleted'
  | 'deal_restored'
  | 'bulk_delete'
  | 'bulk_stage_change'
  | 'deal_created'
  | 'deal_updated'
  | 'task_completed'
  | 'task_deleted'
  | 'task_created'

export interface ActivityLogEntry {
  id: string
  type: ActivityType
  title: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface BulkDeleteMetadata {
  deal_ids: string[]
  count: number
  companies: string[]
  search_query?: string
  triggered_by: 'chat' | 'ui'
}

export interface BulkStageChangeMetadata {
  deal_ids: string[]
  count: number
  companies: string[]
  from_stages: string[]
  to_stage: string
  triggered_by: 'chat' | 'ui'
}

export async function logActivity(entry: Omit<ActivityLogEntry, 'id' | 'created_at'>): Promise<void> {
  try {
    const supabase = getSupabase()

    const { error } = await supabase
      .from('activity_log')
      .insert({
        type: entry.type,
        title: entry.title,
        metadata: entry.metadata || {},
      })

    if (error) {
      console.warn(`[ACTIVITY LOG] Insert failed: ${error.message}`)
      return
    }

    console.log(`[ACTIVITY LOG] Logged: ${entry.type} - ${entry.title}`)
  } catch (err) {
    console.warn('[ACTIVITY LOG] Failed to log activity:', err)
  }
}

export async function logDealDeletion(company: string, metadata?: Record<string, unknown>): Promise<void> {
  const isRestored = metadata?.restored === true
  await logActivity({
    type: isRestored ? 'deal_restored' : 'deal_deleted',
    title: company,
    metadata,
  })
}

export async function logBulkDeletion(
  dealIds: string[],
  companies: string[],
  options?: { searchQuery?: string; triggeredBy?: 'chat' | 'ui' }
): Promise<void> {
  const metadata: BulkDeleteMetadata = {
    deal_ids: dealIds,
    count: dealIds.length,
    companies: companies.slice(0, 50), // Limit stored company names
    search_query: options?.searchQuery,
    triggered_by: options?.triggeredBy || 'ui',
  }

  await logActivity({
    type: 'bulk_delete',
    title: `Deleted ${dealIds.length} deal${dealIds.length === 1 ? '' : 's'}`,
    metadata,
  })
}

export async function logBulkStageChange(
  dealIds: string[],
  companies: string[],
  fromStages: string[],
  toStage: string,
  triggeredBy: 'chat' | 'ui' = 'ui'
): Promise<void> {
  const metadata: BulkStageChangeMetadata = {
    deal_ids: dealIds,
    count: dealIds.length,
    companies: companies.slice(0, 50),
    from_stages: [...new Set(fromStages)], // Unique stages
    to_stage: toStage,
    triggered_by: triggeredBy,
  }

  await logActivity({
    type: 'bulk_stage_change',
    title: `Moved ${dealIds.length} deal${dealIds.length === 1 ? '' : 's'} to ${toStage}`,
    metadata,
  })
}

export async function getRecentActivityLogs(limit = 20): Promise<ActivityLogEntry[]> {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn(`[ACTIVITY LOG] Query failed: ${error.message}`)
      return []
    }

    return (data || []) as ActivityLogEntry[]
  } catch (err) {
    console.warn('[ACTIVITY LOG] Failed to fetch activity logs:', err)
    return []
  }
}

// Task activity logging
export async function logTaskCompletion(taskName: string, completed: boolean): Promise<void> {
  await logActivity({
    type: 'task_completed',
    title: `${completed ? 'Completed' : 'Uncompleted'}: ${taskName}`,
    metadata: { task_name: taskName, completed },
  })
}

export async function logTaskDeletion(taskName: string): Promise<void> {
  await logActivity({
    type: 'task_deleted',
    title: `Deleted: ${taskName}`,
    metadata: { task_name: taskName },
  })
}

export async function logTaskCreation(taskName: string, dueDate?: string): Promise<void> {
  await logActivity({
    type: 'task_created',
    title: `Created: ${taskName}`,
    metadata: { task_name: taskName, due_date: dueDate },
  })
}

export async function logSubtaskCreation(subtaskName: string, parentTaskName: string): Promise<void> {
  await logActivity({
    type: 'task_created',
    title: `Added subtask: ${subtaskName} to ${parentTaskName}`,
    metadata: { subtask_name: subtaskName, parent_task_name: parentTaskName },
  })
}
