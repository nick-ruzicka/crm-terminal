import { NextRequest, NextResponse } from 'next/server'
import { getTaskSubtasks } from '@/lib/asana'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const subtasks = await getTaskSubtasks(id)
    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error('Get subtasks error:', error)
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 })
  }
}
