import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'pending')
      .eq('is_potential_deal', true)

    if (error) {
      console.error('Error fetching review count:', error)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('Review count API error:', error)
    return NextResponse.json({ count: 0 })
  }
}
