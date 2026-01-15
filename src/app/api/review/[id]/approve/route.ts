import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Note, Deal } from '@/types/database'

// Use untyped client for flexible operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, company, deal_type } = body

    // Get the note first
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single()

    if (noteError || !noteData) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const note = noteData as Note

    // Create the deal
    const { data: dealData, error: dealError } = await supabase
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
    const { error: updateError } = await supabase
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
