import { NextRequest, NextResponse } from 'next/server'
import { getTaskDetails, getTaskSubtasks, deleteTask, updateTask } from '@/lib/asana'
import { logTaskDeletion } from '@/lib/activityLog'

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, notes, due_on } = body

    const updatedTask = await updateTask(id, { name, notes, due_on })

    if (!updatedTask) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json({ task: updatedTask })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get task name for logging before deleting
    const body = await request.json().catch(() => ({}))
    const taskName = body.taskName || 'Unknown task'

    const success = await deleteTask(id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    // Log the deletion
    await logTaskDeletion(taskName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
