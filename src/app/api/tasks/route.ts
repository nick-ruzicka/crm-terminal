import { NextResponse } from 'next/server'
import { getTasksGroupedBySection } from '@/lib/asana'

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
