import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('review_status', 'pending')
      .eq('is_potential_deal', true)
      .order('confidence', { ascending: false })

    if (error) {
      console.error('Error fetching pending reviews:', error)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    return NextResponse.json({ notes: notes || [] })
  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}
