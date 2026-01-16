import { NextResponse } from 'next/server'
import {
  embedAndStore,
  buildDealContent,
  buildNoteContent,
  SourceType,
  EmbeddingMetadata
} from '@/lib/embeddings'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface GenerateRequest {
  source_type: SourceType
  source_id: string
  content?: string // Optional - will fetch from DB if not provided
}

interface DealData {
  name: string
  company: string | null
  stage: string | null
  deal_type: string | null
  source: string | null
}

interface NoteData {
  content: string | null
  suggested_company: string | null
  meeting_date: string | null
  deal_id: string | null
}

interface MessageData {
  content: string
  role: string
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json()
    const { source_type, source_id, content: providedContent } = body

    if (!source_type || !source_id) {
      return NextResponse.json(
        { error: 'source_type and source_id are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()
    let content: string
    let metadata: EmbeddingMetadata = {}

    // Fetch content from database if not provided
    if (providedContent) {
      content = providedContent
    } else {
      switch (source_type) {
        case 'deal': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: deal, error } = await (supabase as any)
            .from('deals')
            .select('name, company, stage, deal_type, source')
            .eq('id', source_id)
            .single() as { data: DealData | null; error: unknown }

          if (error || !deal) {
            return NextResponse.json(
              { error: 'Deal not found' },
              { status: 404 }
            )
          }

          content = buildDealContent(deal)
          metadata = {
            deal_name: deal.name,
            company: deal.company || undefined,
            stage: deal.stage || undefined,
          }
          break
        }

        case 'note': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: note, error } = await (supabase as any)
            .from('notes')
            .select('content, suggested_company, meeting_date, deal_id')
            .eq('id', source_id)
            .single() as { data: NoteData | null; error: unknown }

          if (error || !note) {
            return NextResponse.json(
              { error: 'Note not found' },
              { status: 404 }
            )
          }

          content = buildNoteContent(note)
          metadata = {
            company: note.suggested_company || undefined,
            note_date: note.meeting_date || undefined,
          }
          break
        }

        case 'task': {
          // For tasks, we'd need to fetch from Asana or a tasks table
          return NextResponse.json(
            { error: 'Task embedding requires content to be provided' },
            { status: 400 }
          )
        }

        case 'chat_message': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: message, error } = await (supabase as any)
            .from('chat_messages')
            .select('content, role')
            .eq('id', source_id)
            .single() as { data: MessageData | null; error: unknown }

          if (error || !message) {
            return NextResponse.json(
              { error: 'Chat message not found' },
              { status: 404 }
            )
          }

          content = message.content
          metadata = { role: message.role }
          break
        }

        default:
          return NextResponse.json(
            { error: `Unknown source_type: ${source_type}` },
            { status: 400 }
          )
      }
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content to embed' },
        { status: 400 }
      )
    }

    // Generate and store the embedding
    const embedding = await embedAndStore(source_type, source_id, content, metadata)

    return NextResponse.json({
      success: true,
      source_type,
      source_id,
      content_length: content.length,
      embedding_dimensions: embedding.length,
    })
  } catch (error) {
    console.error('[EMBEDDINGS] Generate error:', error)

    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate embedding' },
      { status: 500 }
    )
  }
}
