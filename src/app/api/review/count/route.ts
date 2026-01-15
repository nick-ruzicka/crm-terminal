import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabase()

    // Fetch matching notes and count manually (Supabase JS client has issues with count + multiple filters)
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id')
      .eq('review_status', 'pending')
      .eq('is_potential_deal', true)

    if (error) {
      console.error('Error fetching review count:', error)
      return NextResponse.json(
        { count: 0 },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    return NextResponse.json(
      { count: notes?.length || 0 },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('Review count API error:', error)
    return NextResponse.json(
      { count: 0 },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }
}
