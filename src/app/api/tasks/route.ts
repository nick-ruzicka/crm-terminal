import { NextRequest, NextResponse } from 'next/server'
import { getTasksGroupedBySection, createTask } from '@/lib/asana'
import { logTaskCreation } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const groupedTasks = await getTasksGroupedBySection()
    return NextResponse.json({ data: groupedTasks })
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, notes, due_on, section_gid } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Task name is required' }, { status: 400 })
    }

    const task = await createTask({
      name: name.trim(),
      notes,
      due_on,
      section_gid,
    })

    if (!task) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    // Log the task creation
    await logTaskCreation(task.name, due_on)

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Failed to create task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
