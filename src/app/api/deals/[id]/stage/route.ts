import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { stage } = await request.json()

    const { error } = await supabase
      .from('deals')
      .update({ stage })
      .eq('id', id)

    if (error) {
      console.error('Error updating deal stage:', error)
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Deal stage API error:', error)
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}
