import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import type { Note, Deal } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, company, deal_type } = body
    const supabase = getSupabase()

    // Get the note first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: noteData, error: noteError } = await (supabase as any)
      .from('notes')
      .select('*')
      .eq('id', id)
      .single()

    if (noteError || !noteData) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const note = noteData as Note

    // Create the deal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dealData, error: dealError } = await (supabase as any)
      .from('deals')
      .insert({
        name: name || note.suggested_company || 'New Deal',
        company: company || note.suggested_company,
        stage: 'Lead',
        deal_type: deal_type || note.suggested_deal_type,
        source: 'Meeting Note',
      })
      .select()
      .single()

    if (dealError) {
      console.error('Error creating deal:', dealError)
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
    }

    const deal = dealData as Deal

    // Update the note with deal_id and review_status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('notes')
      .update({
        review_status: 'approved',
        deal_id: deal.id,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating note:', updateError)
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deal })
  } catch (error) {
    console.error('Approve API error:', error)
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
  }
}
