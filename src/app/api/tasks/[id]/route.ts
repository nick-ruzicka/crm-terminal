import { NextRequest, NextResponse } from 'next/server'
import { getTaskDetails, getTaskSubtasks } from '@/lib/asana'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [task, subtasks] = await Promise.all([
      getTaskDetails(id),
      getTaskSubtasks(id),
    ])

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task: { ...task, subtasks } })
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}
