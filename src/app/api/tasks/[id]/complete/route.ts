import { NextRequest, NextResponse } from 'next/server'
import { completeTask } from '@/lib/asana'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { completed } = await request.json()

    const success = await completeTask(id, completed)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
  } catch (error) {
    console.error('Complete task error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
