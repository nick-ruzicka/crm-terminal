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
  }
]

// Tool execution functions
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'delete_deal': {
        const { deal_id } = input as { deal_id: string }
        const { error } = await supabase.from('deals').delete().eq('id', deal_id)
        if (error) return `Error deleting deal: ${error.message}`
        return `Successfully deleted deal ${deal_id}`
      }

      case 'update_deal_stage': {
        const { deal_id, new_stage } = input as { deal_id: string; new_stage: string }
        const { data, error } = await supabase
          .from('deals')
          .update({ stage: new_stage } as never)
          .eq('id', deal_id)
          .select('company')
          .single()
        if (error) return `Error updating deal: ${error.message}`
        const dealData = data as { company: string } | null
        return `Successfully moved "${dealData?.company}" to ${new_stage}`
      }

      case 'bulk_update_stage': {
        const { from_stage, to_stage } = input as { from_stage: string; to_stage: string }
        const { data, error } = await supabase
          .from('deals')
          .update({ stage: to_stage } as never)
          .eq('stage', from_stage)
          .select('id')
        if (error) return `Error updating deals: ${error.message}`
        const deals = data as { id: string }[] | null
        return `Successfully moved ${deals?.length || 0} deals from ${from_stage} to ${to_stage}`
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
        if (!confirmed) {
          // Count deals first
          const { data: deals } = await supabase.from('deals').select('id').eq('stage', stage)
          const count = deals?.length || 0
          return `CONFIRMATION REQUIRED: This will delete ${count} deals in the "${stage}" stage. This action cannot be undone. Please confirm by saying "yes, delete all ${stage} deals" or "confirm deletion".`
        }
        const { data, error } = await supabase.from('deals').delete().eq('stage', stage).select('id')
        if (error) return `Error deleting deals: ${error.message}`
        return `Successfully deleted ${data?.length || 0} deals from ${stage} stage`
      }

      case 'find_deal_by_company': {
        const { company_name } = input as { company_name: string }
        const { data, error } = await supabase
          .from('deals')
          .select('id, company, name, stage')
          .ilike('company', `%${company_name}%`)
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
        // Find the deal first
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id, company')
          .ilike('company', `%${company_name}%`)
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
        const { data, error } = await supabase
          .from('deals')
          .select('id, company, name')
          .eq('stage', stage)
          .order('company')
        if (error) return `Error: ${error.message}`
        const deals = data as { id: string; company: string; name: string }[] | null
        if (!deals?.length) return `No deals in ${stage} stage`
        return `${deals.length} deals in ${stage}:\n${deals.map(d => `- ${d.company}`).join('\n')}`
      }

      case 'get_stage_counts': {
        const { data, error } = await supabase.from('deals').select('stage')
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

    // Initial API call with tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    // Process tool calls in a loop
    const processedMessages = [...messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))]

    while (response.stop_reason === 'tool_use') {
      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      // Execute tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        })
      }

      // Add assistant message with tool calls
      processedMessages.push({
        role: 'assistant' as const,
        content: response.content,
      })

      // Add tool results
      processedMessages.push({
        role: 'user' as const,
        content: toolResults,
      })

      // Continue conversation
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: processedMessages,
      })
    }

    // Extract final text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    const assistantMessage = textBlock?.text || 'Action completed.'

    return NextResponse.json({ message: assistantMessage })
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
