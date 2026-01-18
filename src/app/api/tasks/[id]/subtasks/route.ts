import { NextRequest, NextResponse } from 'next/server'
import { getTaskSubtasks } from '@/lib/asana'
import { logSubtaskCreation } from '@/lib/activityLog'

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentTaskId } = await params
    const { name, parentTaskName, due_on } = await request.json()

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Subtask name is required' }, { status: 400 })
    }

    const token = process.env.ASANA_ACCESS_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'Asana not configured' }, { status: 500 })
    }

    // Build subtask data
    const subtaskData: Record<string, string> = {
      name: name.trim(),
    }
    if (due_on) {
      subtaskData.due_on = due_on
    }

    // Create subtask in Asana
    const res = await fetch(`${ASANA_BASE_URL}/tasks/${parentTaskId}/subtasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        data: subtaskData,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Asana create subtask error:', error)
      return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
    }

    const json = await res.json()
    const subtask = json.data

    // Log the subtask creation
    if (parentTaskName) {
      await logSubtaskCreation(name.trim(), parentTaskName)
    }

    return NextResponse.json({ subtask })
  } catch (error) {
    console.error('Create subtask error:', error)
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }
}
