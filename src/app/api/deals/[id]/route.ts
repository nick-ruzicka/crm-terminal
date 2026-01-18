import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logDealDeletion } from '@/lib/activityLog'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal, error } = await (supabase as any)
      .from('deals')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !deal) {
      console.error('Error fetching deal:', error)
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Try to fetch contacts associated with this deal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contacts: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contactsData } = await (supabase as any)
      .from('contacts')
      .select('*')
      .eq('deal_id', id)
    if (contactsData) {
      contacts = contactsData
    }

    // Try to fetch notes associated with this deal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let notes: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: notesData } = await (supabase as any)
      .from('notes')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })
    if (notesData) {
      notes = notesData
    }

    return NextResponse.json({ deal, contacts, notes })
  } catch (error) {
    console.error('Error in GET /api/deals/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal, error } = await (supabase as any)
      .from('deals')
      .update({
        name: body.name,
        company: body.company,
        stage: body.stage,
        deal_type: body.deal_type,
        source: body.source,
        next_step: body.next_step,
        next_step_due: body.next_step_due,
        priority: body.priority,
        focus_area: body.focus_area,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating deal:', error)
      return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error in PUT /api/deals/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch deal name before soft deleting for activity log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal } = await (supabase as any)
      .from('deals')
      .select('company, name')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const dealName = deal?.company || deal?.name || 'Unknown'

    // Soft delete: set deleted_at timestamp instead of hard delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('deals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error soft deleting deal:', error)
      return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
    }

    // Log deletion to activity log
    await logDealDeletion(dealName, { deal_id: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/deals/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Handle restore action
    if (body.restore === true) {
      // Fetch deal info (including deleted ones)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deal } = await (supabase as any)
        .from('deals')
        .select('company, name, deleted_at')
        .eq('id', id)
        .single()

      if (!deal) {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
      }

      if (!deal.deleted_at) {
        return NextResponse.json({ error: 'Deal is not deleted' }, { status: 400 })
      }

      const dealName = deal?.company || deal?.name || 'Unknown'

      // Restore: set deleted_at to null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('deals')
        .update({ deleted_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('Error restoring deal:', error)
        return NextResponse.json({ error: 'Failed to restore deal' }, { status: 500 })
      }

      // Log restoration to activity log
      await logDealDeletion(dealName, { deal_id: id, restored: true })

      return NextResponse.json({ success: true, restored: true })
    }

    return NextResponse.json({ error: 'Invalid PATCH request' }, { status: 400 })
  } catch (error) {
    console.error('Error in PATCH /api/deals/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
