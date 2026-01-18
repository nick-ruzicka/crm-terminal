import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { getProjectTasks, getProjectSections, completeTask as asanaCompleteTask, asanaFetch, AsanaTask } from '@/lib/asana'
import { buildSystemPrompt, CRMSummary } from '@/lib/system-prompt'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface NoteRow {
  id: string
  deal_id: string | null
  content: string | null
  meeting_date: string | null
}

interface DealRow {
  id: string
  name: string
  company: string
  stage: string
  deal_type?: string
  source?: string
  next_step?: string
  next_step_due?: string
}

// Tool definitions for Anthropic
const tools: Anthropic.Tool[] = [
  // DEAL TOOLS
  {
    name: 'delete_deal',
    description: 'Delete a deal by its ID. This is a destructive action.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'The UUID of the deal to delete' }
      },
      required: ['deal_id']
    }
  },
  {
    name: 'update_deal_stage',
    description: 'Move a deal to a different stage in the pipeline',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'The UUID of the deal' },
        new_stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'The new stage' }
      },
      required: ['deal_id', 'new_stage']
    }
  },
  {
    name: 'bulk_update_stage',
    description: 'Move all deals from one stage to another stage',
    input_schema: {
      type: 'object' as const,
      properties: {
        from_stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'Current stage' },
        to_stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'New stage' }
      },
      required: ['from_stage', 'to_stage']
    }
  },
  {
    name: 'create_deal',
    description: 'Create a new deal in the pipeline',
    input_schema: {
      type: 'object' as const,
      properties: {
        company: { type: 'string', description: 'Company name' },
        name: { type: 'string', description: 'Deal name (optional, defaults to company name)' },
        stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'Pipeline stage (default: lead)' },
        deal_type: { type: 'string', enum: ['partnership', 'integration', 'investment', 'advisory', 'other'], description: 'Type of deal' },
        source: { type: 'string', enum: ['inbound', 'outbound', 'referral', 'event', 'other'], description: 'Lead source' }
      },
      required: ['company']
    }
  },
  {
    name: 'delete_deals_by_stage',
    description: 'Delete all deals in a specific stage. This is a destructive action that requires confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'Stage to delete deals from' },
        confirmed: { type: 'boolean', description: 'Must be true to confirm deletion' }
      },
      required: ['stage']
    }
  },
  {
    name: 'find_deal_by_company',
    description: 'Find a deal by company name (partial match)',
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string', description: 'Company name to search for' }
      },
      required: ['company_name']
    }
  },

  // NOTE TOOLS
  {
    name: 'add_note_to_deal',
    description: 'Add a note to a specific deal by deal ID',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'The UUID of the deal' },
        content: { type: 'string', description: 'The note content' },
        meeting_date: { type: 'string', description: 'Optional meeting date in YYYY-MM-DD format' }
      },
      required: ['deal_id', 'content']
    }
  },
  {
    name: 'add_note_by_company',
    description: 'Add a note to a deal by searching for the company name',
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string', description: 'Company name to find' },
        content: { type: 'string', description: 'The note content' },
        meeting_date: { type: 'string', description: 'Optional meeting date in YYYY-MM-DD format' }
      },
      required: ['company_name', 'content']
    }
  },
  {
    name: 'search_notes',
    description: 'Search notes for specific content',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  },

  // TASK TOOLS
  {
    name: 'create_task',
    description: 'Create a new task in Asana',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Task name' },
        notes: { type: 'string', description: 'Task description/notes' },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        section_name: { type: 'string', description: 'Section name to add task to (optional)' }
      },
      required: ['name']
    }
  },
  {
    name: 'complete_task',
    description: 'Mark an Asana task as complete',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The Asana task GID' },
        task_name: { type: 'string', description: 'Or the task name to search for' }
      },
      required: []
    }
  },

  // QUERY TOOLS
  {
    name: 'get_deals_by_stage',
    description: 'Get all deals in a specific stage',
    input_schema: {
      type: 'object' as const,
      properties: {
        stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'Stage to query' }
      },
      required: ['stage']
    }
  },
  {
    name: 'get_stage_counts',
    description: 'Get count of deals in each stage',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },

  // BULK OPERATION TOOLS
  {
    name: 'bulk_query_deals',
    description: 'Query deals with filters to preview what will be affected by a bulk operation. Always use this first before bulk_delete_deals or bulk_update_deals to show the user what will be changed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'], description: 'Filter by stage' },
        deal_type: { type: 'string', enum: ['partnership', 'integration', 'investment', 'advisory', 'other'], description: 'Filter by deal type' },
        source: { type: 'string', enum: ['inbound', 'outbound', 'referral', 'event', 'other'], description: 'Filter by source' },
        company: { type: 'string', description: 'Filter by company name (partial match)' },
        name: { type: 'string', description: 'Filter by deal name (partial match)' },
        created_before: { type: 'string', description: 'Filter deals created before this date (YYYY-MM-DD)' },
        created_after: { type: 'string', description: 'Filter deals created after this date (YYYY-MM-DD)' }
      },
      required: []
    }
  },
  {
    name: 'bulk_delete_deals',
    description: 'Delete multiple deals by their IDs. Always use bulk_query_deals first to preview and confirm with the user before deleting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of deal UUIDs to delete'
        },
        confirmed: { type: 'boolean', description: 'Must be true to confirm deletion. Ask user to confirm first.' }
      },
      required: ['ids']
    }
  },
  {
    name: 'bulk_update_deals',
    description: 'Update multiple deals with the same values. Always use bulk_query_deals first to preview and confirm with the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of deal UUIDs to update'
        },
        updates: {
          type: 'object',
          description: 'Fields to update. Allowed: stage, status, deal_type, priority, source, notes',
          properties: {
            stage: { type: 'string', enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'] },
            deal_type: { type: 'string', enum: ['partnership', 'integration', 'investment', 'advisory', 'other'] },
            source: { type: 'string', enum: ['inbound', 'outbound', 'referral', 'event', 'other'] },
            priority: { type: 'string' },
            status: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        confirmed: { type: 'boolean', description: 'Must be true to confirm update. Ask user to confirm first.' }
      },
      required: ['ids', 'updates']
    }
  },
  {
    name: 'analyze_pipeline',
    description: 'Get a comprehensive analysis of the entire deal pipeline in one call. Returns counts by stage, categorization by type (bridges, onramps, MMs, defi, etc.), stale deals, and actionable suggestions. Use this instead of making multiple queries when Nick asks for pipeline overview, cleanup suggestions, or deal analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'analyze_tasks',
    description: 'Get comprehensive task analysis from Asana. Returns task counts by status, overdue tasks, tasks due this week, and tasks grouped by deal. Use this for questions about task workload, what\'s overdue, or upcoming deadlines.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'analyze_notes',
    description: 'Get comprehensive notes analysis. Returns counts by review status, orphaned notes (not linked to deals), recent meeting notes, and notes grouped by deal. Use this for questions about notes that need review or meeting coverage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'check_pipeline_health',
    description: 'Get overall pipeline health score and items needing attention. Returns health score (0-100), overdue tasks, pending reviews, stale deals, deals without recent notes, and closing deals with open tasks. USE THIS FIRST when Nick asks "what needs attention?", "what should I focus on?", or similar prioritization questions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'delete_deals_by_company_names',
    description: 'Delete multiple deals by their EXACT company names in ONE database call. Use this when Nick lists exact company names to delete.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of exact company names to delete (case-insensitive but exact match)'
        },
        confirmed: {
          type: 'boolean',
          description: 'Must be true to confirm deletion. First call without confirmed to preview, then with confirmed=true to delete.'
        }
      },
      required: ['companies']
    }
  },
  {
    name: 'search_and_delete_deals',
    description: 'FUZZY search and delete deals. Use this when Nick gives partial/abbreviated company names (e.g., "arkstream" matches "Arkstream Capital"). Preferred over delete_deals_by_company_names for most cases.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search_terms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of search terms - will match any company containing these terms'
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion. First call without confirm to preview matches, then with confirm=true to delete.'
        }
      },
      required: ['search_terms']
    }
  },
  {
    name: 'move_deals_by_company',
    description: 'EFFICIENT: Move multiple deals to a stage by company names in ONE call. Use this instead of multiple find_deal_by_company + update_deal_stage calls. Supports fuzzy matching.',
    input_schema: {
      type: 'object' as const,
      properties: {
        company_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of company names (fuzzy match) to move'
        },
        to_stage: {
          type: 'string',
          enum: ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'],
          description: 'Target stage to move deals to'
        },
        confirm: {
          type: 'boolean',
          description: 'Set to true to execute. First call without confirm to preview matches.'
        }
      },
      required: ['company_names', 'to_stage']
    }
  }
]

// Tool execution functions
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  // Minimal logging - timing is tracked at higher level
  try {
    switch (name) {
      case 'delete_deal': {
        const { deal_id } = input as { deal_id: string }
        // Use the single-deal delete API for soft delete and logging
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/${deal_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        })
        const result = await response.json()
        if (!response.ok || result.error) {
          console.error(`[CHAT TOOL] delete_deal failed:`, result)
          return `Error deleting deal: ${result.error || 'Unknown error'}`
        }
        return `Successfully deleted deal "${result.company || deal_id}"`
      }

      case 'update_deal_stage': {
        const { deal_id, new_stage } = input as { deal_id: string; new_stage: string }
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [deal_id], updates: { stage: new_stage }, triggeredBy: 'chat' }),
        })
        const result = await response.json()
        if (result.error) return `Error updating deal: ${result.error}`
        const companyName = result.companies?.[0] || 'Unknown'
        return `Successfully moved "${companyName}" to ${new_stage}`
      }

      case 'bulk_update_stage': {
        const { from_stage, to_stage } = input as { from_stage: string; to_stage: string }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dealsInStage, error: queryError } = await (supabase as any)
          .from('deals')
          .select('id')
          .eq('stage', from_stage)
          .is('deleted_at', null)
        if (queryError) return `Error querying deals: ${queryError.message}`
        const ids = (dealsInStage || []).map((d: { id: string }) => d.id)
        if (ids.length === 0) return `No deals found in ${from_stage} stage`

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, updates: { stage: to_stage }, triggeredBy: 'chat' }),
        })
        const result = await response.json()
        if (result.error) return `Error updating deals: ${result.error}`
        return `Successfully moved ${result.updated} deals from ${from_stage} to ${to_stage}`
      }

      case 'create_deal': {
        const { company, name, stage, deal_type, source } = input as {
          company: string; name?: string; stage?: string; deal_type?: string; source?: string
        }
        const insertData = {
          company,
          name: name || company,
          stage: stage || 'lead',
          deal_type: deal_type || 'partnership',
          source: source || 'other'
        }
        const { data, error } = await supabase
          .from('deals')
          .insert(insertData as never)
          .select()
          .single()
        if (error) return `Error creating deal: ${error.message}`
        const createdDeal = data as { id: string } | null
        return `Successfully created deal "${company}" (ID: ${createdDeal?.id}) in ${stage || 'lead'} stage`
      }

      case 'delete_deals_by_stage': {
        const { stage, confirmed } = input as { stage: string; confirmed?: boolean }
        // Get non-deleted deals in this stage
        const { data: dealsInStage } = await supabase
          .from('deals')
          .select('id')
          .eq('stage', stage)
          .is('deleted_at', null)
        const ids = (dealsInStage || []).map((d: { id: string }) => d.id)

        if (!confirmed) {
          return `CONFIRMATION REQUIRED: This will delete ${ids.length} deals in the "${stage}" stage. Please confirm by saying "yes, delete all ${stage} deals" or "confirm deletion".`
        }

        if (ids.length === 0) return `No deals found in ${stage} stage`

        // Use bulk-delete API for soft delete and logging
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, triggeredBy: 'chat' }),
        })
        const result = await response.json()
        if (result.error) return `Error deleting deals: ${result.error}`
        return `Successfully deleted ${result.deleted} deals from ${stage} stage`
      }

      case 'find_deal_by_company': {
        const { company_name } = input as { company_name: string }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('deals')
          .select('id, company, name, stage')
          .ilike('company', `%${company_name}%`)
          .is('deleted_at', null)
          .limit(5)
        if (error) return `Error searching deals: ${error.message}`
        const deals = data as { id: string; company: string; name: string; stage: string }[] | null
        if (!deals?.length) return `No deals found matching "${company_name}"`
        return `Found ${deals.length} deal(s):\n${deals.map(d => `- ${d.company} (ID: ${d.id}, Stage: ${d.stage})`).join('\n')}`
      }

      case 'add_note_to_deal': {
        const { deal_id, content, meeting_date } = input as { deal_id: string; content: string; meeting_date?: string }
        const noteData = {
          deal_id,
          content,
          meeting_date: meeting_date || new Date().toISOString().split('T')[0]
        }
        const { error } = await supabase
          .from('notes')
          .insert(noteData as never)
        if (error) return `Error adding note: ${error.message}`
        return `Successfully added note to deal`
      }

      case 'add_note_by_company': {
        const { company_name, content, meeting_date } = input as { company_name: string; content: string; meeting_date?: string }
        // Find the deal first (only non-deleted deals)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dealsData } = await (supabase as any)
          .from('deals')
          .select('id, company')
          .ilike('company', `%${company_name}%`)
          .is('deleted_at', null)
          .limit(1)
        const matchedDeals = dealsData as { id: string; company: string }[] | null
        if (!matchedDeals?.length) return `No deal found matching "${company_name}"`
        const deal = matchedDeals[0]
        const noteData = {
          deal_id: deal.id,
          content,
          meeting_date: meeting_date || new Date().toISOString().split('T')[0]
        }
        const { error } = await supabase
          .from('notes')
          .insert(noteData as never)
        if (error) return `Error adding note: ${error.message}`
        return `Successfully added note to "${deal.company}"`
      }

      case 'search_notes': {
        const { query } = input as { query: string }
        const { data, error } = await supabase
          .from('notes')
          .select('id, deal_id, content, meeting_date')
          .ilike('content', `%${query}%`)
          .limit(10)
        if (error) return `Error searching notes: ${error.message}`
        const notes = data as NoteRow[] | null
        if (!notes?.length) return `No notes found containing "${query}"`

        // Get deal names for context
        const dealIds = Array.from(new Set(notes.filter(n => n.deal_id).map(n => n.deal_id as string)))
        const { data: dealsData } = await supabase.from('deals').select('id, company').in('id', dealIds)
        const deals = dealsData as { id: string; company: string }[] | null
        const dealMap = new Map(deals?.map(d => [d.id, d.company]) || [])

        return `Found ${notes.length} note(s) containing "${query}":\n${notes.map(n => {
          const company = n.deal_id ? dealMap.get(n.deal_id) || 'Unknown' : 'Unlinked'
          return `- [${company}] ${n.content?.substring(0, 100)}...`
        }).join('\n')}`
      }

      case 'create_task': {
        const { name, notes, due_date, section_name } = input as {
          name: string; notes?: string; due_date?: string; section_name?: string
        }
        const projectId = process.env.ASANA_PROJECT_ID
        if (!projectId) return 'Asana project not configured'

        // Find section if specified
        let sectionGid: string | undefined
        if (section_name) {
          const sections = await getProjectSections()
          const section = sections.find(s => s.name.toLowerCase().includes(section_name.toLowerCase()))
          sectionGid = section?.gid
        }

        const taskData: Record<string, unknown> = {
          name,
          projects: [projectId]
        }
        if (notes) taskData.notes = notes
        if (due_date) taskData.due_on = due_date

        const task = await asanaFetch<AsanaTask>('/tasks', {
          method: 'POST',
          body: JSON.stringify({ data: taskData })
        })

        if (!task) return 'Failed to create task in Asana'

        // Add to section if specified
        if (sectionGid && task.gid) {
          await asanaFetch(`/sections/${sectionGid}/addTask`, {
            method: 'POST',
            body: JSON.stringify({ data: { task: task.gid } })
          })
        }

        return `Successfully created task "${name}"${due_date ? ` due ${due_date}` : ''}${section_name ? ` in section "${section_name}"` : ''}`
      }

      case 'complete_task': {
        const { task_id, task_name } = input as { task_id?: string; task_name?: string }
        let taskGid = task_id

        if (!taskGid && task_name) {
          // Find task by name
          const tasks = await getProjectTasks()
          const task = tasks.find(t => t.name.toLowerCase().includes(task_name.toLowerCase()))
          if (!task) return `No task found matching "${task_name}"`
          taskGid = task.gid
        }

        if (!taskGid) return 'Please provide either task_id or task_name'

        const success = await asanaCompleteTask(taskGid, true)
        if (!success) return 'Failed to complete task'
        return `Successfully marked task as complete`
      }

      case 'get_deals_by_stage': {
        const { stage } = input as { stage: string }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('deals')
          .select('id, company, name')
          .eq('stage', stage)
          .is('deleted_at', null)
          .order('company')
        if (error) return `Error: ${error.message}`
        const deals = data as { id: string; company: string; name: string }[] | null
        if (!deals?.length) return `No deals in ${stage} stage`
        return `${deals.length} deals in ${stage}:\n${deals.map(d => `- ${d.company}`).join('\n')}`
      }

      case 'get_stage_counts': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from('deals').select('stage').is('deleted_at', null)
        if (error) return `Error: ${error.message}`
        const deals = data as { stage: string }[] | null
        const counts: Record<string, number> = {}
        deals?.forEach(d => {
          counts[d.stage] = (counts[d.stage] || 0) + 1
        })
        return `Deal counts by stage:\n${Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([stage, count]) => `- ${stage}: ${count}`)
          .join('\n')}`
      }

      case 'bulk_query_deals': {
        const filters = input as {
          stage?: string
          deal_type?: string
          source?: string
          company?: string
          name?: string
          created_before?: string
          created_after?: string
        }

        // Call the bulk-query API endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters }),
        })

        const result = await response.json()
        if (result.error) return `Error querying deals: ${result.error}`

        const { deals, count, truncated } = result
        if (count === 0) return 'No deals found matching those filters.'

        const dealList = deals.slice(0, 20).map((d: DealRow) =>
          `- ${d.company} (${d.stage})${d.deal_type ? ` [${d.deal_type}]` : ''}`
        ).join('\n')

        return `Found ${count} deal(s) matching filters${truncated ? ' (limited to 500)' : ''}:\n${dealList}${count > 20 ? `\n... and ${count - 20} more` : ''}\n\nDeal IDs: ${result.ids.join(', ')}`
      }

      case 'bulk_delete_deals': {
        const { ids, confirmed } = input as { ids: string[]; confirmed?: boolean }

        if (!confirmed) {
          return `CONFIRMATION REQUIRED: This will permanently delete ${ids.length} deal(s). This action cannot be undone. Please ask the user to confirm by saying something like "yes, delete them" or "confirm deletion".`
        }

        // Call the bulk-delete API endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })

        const result = await response.json()
        if (result.error) return `Error deleting deals: ${result.error}`

        return `Successfully deleted ${result.deleted} deal(s).`
      }

      case 'bulk_update_deals': {
        const { ids, updates, confirmed } = input as {
          ids: string[]
          updates: Record<string, unknown>
          confirmed?: boolean
        }

        if (!confirmed) {
          const updateFields = Object.entries(updates)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
          return `CONFIRMATION REQUIRED: This will update ${ids.length} deal(s) with: ${updateFields}. Please ask the user to confirm.`
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, updates, triggeredBy: 'chat' }),
        })
        const result = await response.json()
        if (result.error) return `Error updating deals: ${result.error}`

        return `Successfully updated ${result.updated} deal(s). Fields changed: ${result.fields.join(', ')}`
      }

      case 'analyze_pipeline': {
        // Call the bulk-analyze API endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        const result = await response.json()
        if (result.error) return `Error analyzing pipeline: ${result.error}`

        // Format the response for Claude
        let analysis = `## Pipeline Analysis (${result.total} deals)\n\n`

        analysis += `### By Stage\n`
        for (const [stage, count] of Object.entries(result.byStage)) {
          analysis += `- ${stage}: ${count}\n`
        }

        analysis += `\n### By Category\n`
        for (const [category, count] of Object.entries(result.byCategory)) {
          if ((count as number) > 0) {
            analysis += `- ${category}: ${count}\n`
          }
        }

        analysis += `\n### Critical Path Deals\n`
        analysis += `- Bridges: ${result.criticalPath.bridges}\n`
        analysis += `- On-ramps: ${result.criticalPath.onramps}\n`
        analysis += `- Market Makers: ${result.criticalPath.market_makers}\n`
        analysis += `- Prediction Markets: ${result.criticalPath.prediction_markets}\n`
        analysis += `- Oracles: ${result.criticalPath.oracles}\n`

        analysis += `\n### Health\n`
        analysis += `- Stale (90+ days): ${result.stale}\n`
        analysis += `- Needs attention (30-90 days): ${result.needsAttention}\n`

        if (result.suggestions.length > 0) {
          analysis += `\n### Suggestions\n`
          for (const suggestion of result.suggestions) {
            analysis += `- **${suggestion.action}** (${suggestion.count} deals): ${suggestion.reason}\n`
          }
        }

        return analysis
      }

      case 'analyze_tasks': {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tasks/bulk-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        const result = await response.json()
        if (result.error) return `Error analyzing tasks: ${result.error}`

        let analysis = `## Task Analysis (${result.total} total tasks)\n\n`

        analysis += `### By Status\n`
        analysis += `- Todo: ${result.byStatus.todo}\n`
        analysis += `- In Progress: ${result.byStatus.in_progress}\n`
        analysis += `- Done: ${result.byStatus.done}\n`

        if (result.overdue.length > 0) {
          analysis += `\n### Overdue Tasks (${result.overdue.length})\n`
          for (const task of result.overdue.slice(0, 10)) {
            analysis += `- **${task.title}**${task.deal_name ? ` (${task.deal_name})` : ''} - ${task.days_overdue} days overdue\n`
          }
        }

        if (result.dueThisWeek.length > 0) {
          analysis += `\n### Due This Week (${result.dueThisWeek.length})\n`
          for (const task of result.dueThisWeek.slice(0, 10)) {
            analysis += `- ${task.title}${task.deal_name ? ` (${task.deal_name})` : ''} - due ${task.due_date}\n`
          }
        }

        analysis += `\n### Summary\n`
        analysis += `- Unlinked tasks (no deal): ${result.unlinked}\n`
        analysis += `- Tasks linked to deals: ${Object.keys(result.byDeal).length} deals\n`

        return analysis
      }

      case 'analyze_notes': {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notes/bulk-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        const result = await response.json()
        if (result.error) return `Error analyzing notes: ${result.error}`

        let analysis = `## Notes Analysis (${result.total} total notes)\n\n`

        analysis += `### By Review Status\n`
        analysis += `- Pending: ${result.byReviewStatus.pending}\n`
        analysis += `- Confirmed: ${result.byReviewStatus.confirmed}\n`
        analysis += `- Approved: ${result.byReviewStatus.approved}\n`
        analysis += `- Dismissed: ${result.byReviewStatus.dismissed}\n`

        analysis += `\n### Summary\n`
        analysis += `- Pending Review (potential deals): ${result.pendingReview}\n`
        analysis += `- Orphaned (not linked to deals): ${result.orphaned}\n`

        if (result.recentMeetings.length > 0) {
          analysis += `\n### Recent Meetings (last 7 days)\n`
          for (const meeting of result.recentMeetings.slice(0, 10)) {
            analysis += `- ${meeting.suggested_company || 'Meeting note'} (${meeting.created_at.split('T')[0]})\n`
          }
        }

        return analysis
      }

      case 'check_pipeline_health': {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/pipeline/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        const result = await response.json()
        if (result.error) return `Error checking pipeline health: ${result.error}`

        let analysis = `## Pipeline Health Score: ${result.healthScore}/100\n\n`

        analysis += `### Summary\n`
        analysis += `- Active deals: ${result.summary.deals_active} of ${result.summary.deals_total}\n`
        analysis += `- Overdue tasks: ${result.summary.tasks_overdue}\n`
        analysis += `- Pending reviews: ${result.summary.reviews_pending}\n`
        analysis += `- Follow-ups needed: ${result.summary.followups_needed}\n`

        if (result.needsAttention.length > 0) {
          analysis += `\n### Needs Attention (Priority Order)\n`
          for (const item of result.needsAttention) {
            const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢'
            if (item.type === 'deal_stale') {
              analysis += `${priority} **${item.deal}** - stale for ${item.days} days → ${item.action}\n`
            } else if (item.type === 'task_overdue') {
              analysis += `${priority} **${item.task}**${item.deal ? ` (${item.deal})` : ''} - ${item.days} days overdue → ${item.action}\n`
            } else if (item.type === 'review_pending') {
              analysis += `${priority} Review: ${item.note} (${item.confidence}% confidence) → ${item.action}\n`
            }
          }
        }

        if (result.closingDealsWithOpenTasks.length > 0) {
          analysis += `\n### Closing Deals with Open Tasks\n`
          for (const deal of result.closingDealsWithOpenTasks) {
            analysis += `- **${deal.deal}** (${deal.stage}) - ${deal.open_tasks} open task(s)\n`
          }
        }

        if (result.dealsWithoutRecentNotes.length > 0) {
          analysis += `\n### Deals Without Recent Notes (14+ days)\n`
          for (const deal of result.dealsWithoutRecentNotes.slice(0, 5)) {
            const days = deal.days_since_note === -1 ? 'never' : `${deal.days_since_note} days ago`
            analysis += `- **${deal.company}** (${deal.stage}) - last note: ${days}\n`
          }
        }

        return analysis
      }

      case 'delete_deals_by_company_names': {
        const { companies, confirmed } = input as { companies: string[]; confirmed?: boolean }

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/delete-by-companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companies, confirmed }),
        })

        const result = await response.json()
        if (result.error) return `Error: ${result.error}`

        if (result.preview) {
          return `Found ${result.count} deal(s) to delete:\n${result.companies.map((c: string) => `- ${c}`).join('\n')}\n\nPlease confirm deletion.`
        }

        return `Successfully deleted ${result.deleted} deal(s):\n${result.companies.map((c: string) => `- ${c}`).join('\n')}`
      }

      case 'search_and_delete_deals': {
        const { search_terms, confirm } = input as { search_terms: string[]; confirm?: boolean }

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/search-and-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ search_terms, confirm }),
        })

        const result = await response.json()
        if (result.error) return `Error: ${result.error}`

        if (result.preview) {
          // Format by search term for clarity
          let output = `Found ${result.count} deal(s) matching your search:\n\n`
          for (const [term, companies] of Object.entries(result.byTerm || {})) {
            output += `**"${term}"** → ${(companies as string[]).join(', ')}\n`
          }
          output += `\nConfirm to delete these ${result.count} deals.`
          return output
        }

        return `Successfully deleted ${result.deleted} deal(s):\n${result.companies.map((c: string) => `- ${c}`).join('\n')}`
      }

      case 'move_deals_by_company': {
        const { company_names, to_stage, confirm } = input as { company_names: string[]; to_stage: string; confirm?: boolean }

        // Find all matching deals with fuzzy match on each company name
        const matches: { id: string; company: string; stage: string }[] = []
        for (const name of company_names) {
          const { data, error } = await (supabase as any)
            .from('deals')
            .select('id, company, stage')
            .ilike('company', `%${name}%`)
            .is('deleted_at', null)
          if (error) {
            console.error(`[MOVE] Error finding deals for "${name}":`, error)
          }
          if (data) matches.push(...data)
        }

        // Dedupe by ID
        const uniqueDeals = Array.from(new Map(matches.map(d => [d.id, d])).values())

        if (uniqueDeals.length === 0) {
          return `No deals found matching: ${company_names.join(', ')}`
        }

        if (!confirm) {
          return `Found ${uniqueDeals.length} deal(s) to move to ${to_stage}:\n${uniqueDeals.map(d => `- ${d.company} (currently: ${d.stage})`).join('\n')}\n\nCall again with confirm=true to execute.`
        }

        // Execute the move via bulk-update API
        const ids = uniqueDeals.map(d => d.id)
        console.log(`[MOVE] Moving ${ids.length} deals to ${to_stage}:`, ids)

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/deals/bulk-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, updates: { stage: to_stage }, triggeredBy: 'chat' }),
        })

        console.log(`[MOVE] bulk-update response status: ${response.status}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[MOVE] bulk-update failed:`, errorText)
          return `Error: API returned ${response.status}: ${errorText}`
        }

        const result = await response.json()
        console.log(`[MOVE] bulk-update result:`, result)

        if (result.error) return `Error: ${result.error}`
        if (!result.success) return `Error: Update failed - ${result.message || 'unknown reason'}`

        return `Moved ${result.updated} deal(s) to ${to_stage}:\n${(result.companies || []).map((c: string) => `- ${c}`).join('\n')}`
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (error) {
    return `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

async function getCRMSummary(): Promise<CRMSummary> {
  // Get summary stats instead of full data to stay under token limits
  const [dealsRes, notesRes, asanaTasks] = await Promise.all([
    supabase.from('deals').select('id, company, stage'),
    supabase.from('notes').select('id'),
    getProjectTasks(),
  ])

  const deals = dealsRes.data as { id: string; company: string; stage: string }[] || []
  const notes = notesRes.data || []
  const tasks = asanaTasks || []

  // Calculate stage counts
  const stageCounts: Record<string, number> = {}
  deals.forEach(d => {
    stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1
  })

  // Get recent/active deals (limit to 20 for context)
  const sampleDeals = deals.slice(0, 20).map(d => d.company)

  return {
    totalDeals: deals.length,
    totalNotes: notes.length,
    totalTasks: tasks.length,
    stageCounts,
    sampleDeals,
    incompleteTasks: tasks.filter(t => !t.completed).slice(0, 10).map(t => ({
      gid: t.gid,
      name: t.name,
      due_on: t.due_on || null,
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const summary = await getCRMSummary()
    const systemPrompt = buildSystemPrompt(summary)

    // Create a streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const processedMessages = [...messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))]

          let continueLoop = true

          let loopCount = 0
          const MAX_TOOL_LOOPS = 10  // Safety limit to prevent infinite loops
          const chatStartTime = Date.now()

          while (continueLoop && loopCount < MAX_TOOL_LOOPS) {
            loopCount++
            const loopStartTime = Date.now()
            console.log(`[CHAT] Loop ${loopCount}/${MAX_TOOL_LOOPS}, messages: ${processedMessages.length}`)

            // Use streaming API
            const stream = anthropic.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              system: systemPrompt,
              tools,
              tool_choice: { type: 'auto' },  // Auto: model decides when to use tools
              messages: processedMessages,
            })

            // Collect the full response while streaming text
            const collectedContent: Anthropic.ContentBlock[] = []
            let currentToolUse: { id: string; name: string; input: string } | null = null

            for await (const event of stream) {
              if (event.type === 'content_block_start') {
                if (event.content_block.type === 'text') {
                  // Text block starting
                } else if (event.content_block.type === 'tool_use') {
                  // Tool use starting - show indicator
                  currentToolUse = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: '',
                  }
                  controller.enqueue(encoder.encode(`\n[Using ${event.content_block.name}...]\n`))
                }
              } else if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                  // Stream text immediately
                  controller.enqueue(encoder.encode(event.delta.text))
                } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
                  // Accumulate tool input
                  currentToolUse.input += event.delta.partial_json
                }
              } else if (event.type === 'content_block_stop') {
                if (currentToolUse) {
                  // Tool use block complete - add to collected content
                  try {
                    collectedContent.push({
                      type: 'tool_use',
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      input: JSON.parse(currentToolUse.input || '{}'),
                    })
                  } catch {
                    collectedContent.push({
                      type: 'tool_use',
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      input: {},
                    })
                  }
                  currentToolUse = null
                }
              }
            }

            // Get final message to check stop reason
            const finalMessage = await stream.finalMessage()
            const apiTime = Date.now() - loopStartTime
            console.log(`[CHAT] Response stop_reason: ${finalMessage.stop_reason} (API took ${apiTime}ms)`)

            // Add any text blocks to collected content
            for (const block of finalMessage.content) {
              if (block.type === 'text') {
                collectedContent.push(block)
              }
            }

            if (finalMessage.stop_reason === 'tool_use') {
              // Execute tools
              const toolUseBlocks = collectedContent.filter(
                (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
              )
              console.log(`[CHAT] Found ${toolUseBlocks.length} tool calls:`, toolUseBlocks.map(t => t.name))

              const toolResults: Anthropic.ToolResultBlockParam[] = []
              const toolStartTime = Date.now()
              for (const toolUse of toolUseBlocks) {
                const toolExecStart = Date.now()
                const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
                console.log(`[CHAT] Tool ${toolUse.name} took ${Date.now() - toolExecStart}ms`)
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: result,
                })
              }

              // Add assistant message with tool calls
              processedMessages.push({
                role: 'assistant' as const,
                content: finalMessage.content,
              })

              // Add tool results
              processedMessages.push({
                role: 'user' as const,
                content: toolResults,
              })

              console.log(`[CHAT] Tools total: ${Date.now() - toolStartTime}ms`)
              // Continue loop to stream the next response
            } else {
              // No more tool calls, we're done
              continueLoop = false
              console.log(`[CHAT] Complete in ${loopCount} loops, total time: ${Date.now() - chatStartTime}ms`)
            }
          }

          if (loopCount >= MAX_TOOL_LOOPS) {
            console.warn(`[CHAT] Hit max tool loop limit (${MAX_TOOL_LOOPS})`)
            controller.enqueue(encoder.encode('\n\n[Stopped: too many tool calls]'))
          }

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)

          // Extract meaningful error message
          let errorMessage = 'Failed to process request.'
          if (error instanceof Error) {
            // Check for common API errors
            if (error.message.includes('credit balance')) {
              errorMessage = 'API credit balance is too low. Please check your Anthropic account.'
            } else if (error.message.includes('rate_limit') || error.message.includes('rate limit')) {
              errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'
            } else if (error.message.includes('authentication') || error.message.includes('API key')) {
              errorMessage = 'API authentication failed. Check your API key.'
            } else if (error.message.includes('timeout')) {
              errorMessage = 'Request timed out. Please try again.'
            } else {
              // Include the actual error for debugging
              errorMessage = `Error: ${error.message}`
            }
          }

          controller.enqueue(encoder.encode(`\n\n⚠️ ${errorMessage}`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)

    // Check for rate limit errors
    if (error instanceof Error && error.message.includes('rate_limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.' },
        { status: 429 }
      )
    }

    // Check for API key issues
    if (error instanceof Error && error.message.includes('authentication')) {
      return NextResponse.json(
        { error: 'API authentication failed. Check your API key.' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
