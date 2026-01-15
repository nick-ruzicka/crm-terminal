import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function getCRMData() {
  const [dealsRes, contactsRes, notesRes] = await Promise.all([
    supabase.from('deals').select('*'),
    supabase.from('contacts').select('*'),
    supabase.from('notes').select('*'),
  ])

  return {
    deals: dealsRes.data || [],
    contacts: contactsRes.data || [],
    notes: notesRes.data || [],
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const crmData = await getCRMData()

    const systemPrompt = `You are a helpful CRM assistant with access to the user's deal pipeline data. Answer questions about their deals, contacts, and notes. Be concise and helpful.

Here is the current CRM data:

DEALS (${crmData.deals.length} total):
${JSON.stringify(crmData.deals, null, 2)}

CONTACTS (${crmData.contacts.length} total):
${JSON.stringify(crmData.contacts, null, 2)}

NOTES (${crmData.notes.length} total):
${JSON.stringify(crmData.notes, null, 2)}

When answering:
- Reference specific deals, contacts, or notes by name when relevant
- Provide counts and summaries when asked about pipeline status
- If asked about a specific deal, include all relevant details including contacts and notes
- Format responses clearly, using bullet points for lists
- Be concise but thorough`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const contentBlock = response.content[0]
    const assistantMessage = contentBlock.type === 'text' ? contentBlock.text : ''

    return NextResponse.json({ message: assistantMessage })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
