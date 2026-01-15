import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('POST /api/deals - Request body:', JSON.stringify(body, null, 2))

    // Build insert data, only including non-empty values
    const insertData: Record<string, unknown> = {
      name: body.name || body.company,
      company: body.company || null,
      stage: body.stage || 'lead',
    }

    // Only add optional fields if they have values
    if (body.deal_type) insertData.deal_type = body.deal_type
    if (body.source) insertData.source = body.source
    if (body.next_step) insertData.next_step = body.next_step
    if (body.next_step_due) insertData.next_step_due = body.next_step_due

    console.log('POST /api/deals - Insert data:', JSON.stringify(insertData, null, 2))

    const { data: deal, error } = await supabase
      .from('deals')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('POST /api/deals - Supabase error:', JSON.stringify(error, null, 2))
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      return NextResponse.json({
        error: 'Failed to create deal',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log('POST /api/deals - Success, created deal:', deal?.id)
    return NextResponse.json({ deal })
  } catch (error) {
    console.error('POST /api/deals - Catch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
