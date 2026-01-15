import { NextRequest, NextResponse } from 'next/server'

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskGid } = await params
    const { section_gid } = await request.json()

    const token = process.env.ASANA_ACCESS_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'Asana not configured' }, { status: 500 })
    }

    // Add task to new section using Asana API
    const res = await fetch(`${ASANA_BASE_URL}/sections/${section_gid}/addTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          task: taskGid,
        },
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Asana section update error:', error)
      return NextResponse.json({ error: 'Failed to move task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task section API error:', error)
    return NextResponse.json({ error: 'Failed to move task' }, { status: 500 })
  }
}
