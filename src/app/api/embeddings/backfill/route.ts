import { NextResponse } from 'next/server'
import {
  embedAndStore,
  buildDealContent,
  buildNoteContent,
  hasEmbedding,
  getEmbeddingStats,
  SourceType,
} from '@/lib/embeddings'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for backfill

interface BackfillRequest {
  source_types?: SourceType[]
  limit?: number
  offset?: number
  skip_existing?: boolean
}

interface BackfillResult {
  source_type: SourceType
  processed: number
  skipped: number
  errors: number
  error_details?: string[]
}

interface DealData {
  id: string
  name: string
  company: string | null
  stage: string | null
  deal_type: string | null
  source: string | null
}

interface NoteData {
  id: string
  content: string | null
  suggested_company: string | null
  meeting_date: string | null
  deal_id: string | null
}

interface MessageData {
  id: string
  content: string
  role: string
}

export async function POST(request: Request) {
  try {
    const body: BackfillRequest = await request.json().catch(() => ({}))
    const {
      source_types = ['deal', 'note'],
      limit = 100,
      offset = 0,
      skip_existing = true
    } = body

    const supabase = getSupabase()
    const results: BackfillResult[] = []
    const startTime = Date.now()

    // Get current stats before backfill
    const statsBefore = await getEmbeddingStats()

    for (const sourceType of source_types) {
      const result: BackfillResult = {
        source_type: sourceType,
        processed: 0,
        skipped: 0,
        errors: 0,
        error_details: []
      }

      try {
        switch (sourceType) {
          case 'deal': {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: deals, error } = await (supabase as any)
              .from('deals')
              .select('id, name, company, stage, deal_type, source')
              .order('created_at', { ascending: true })
              .range(offset, offset + limit - 1) as { data: DealData[] | null; error: unknown }

            if (error) throw error

            for (const deal of deals || []) {
              try {
                // Skip if already embedded
                if (skip_existing && await hasEmbedding('deal', deal.id)) {
                  result.skipped++
                  continue
                }

                const content = buildDealContent(deal)
                if (!content || content.trim().length < 5) {
                  result.skipped++
                  continue
                }

                await embedAndStore('deal', deal.id, content, {
                  deal_name: deal.name,
                  company: deal.company || undefined,
                  stage: deal.stage || undefined,
                })

                result.processed++

                // Rate limiting - OpenAI has limits
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (err) {
                result.errors++
                result.error_details?.push(`Deal ${deal.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
              }
            }
            break
          }

          case 'note': {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: notes, error } = await (supabase as any)
              .from('notes')
              .select('id, content, suggested_company, meeting_date, deal_id')
              .not('content', 'is', null)
              .order('created_at', { ascending: true })
              .range(offset, offset + limit - 1) as { data: NoteData[] | null; error: unknown }

            if (error) throw error

            for (const note of notes || []) {
              try {
                // Skip if already embedded
                if (skip_existing && await hasEmbedding('note', note.id)) {
                  result.skipped++
                  continue
                }

                const content = buildNoteContent(note)
                if (!content || content.trim().length < 10) {
                  result.skipped++
                  continue
                }

                await embedAndStore('note', note.id, content, {
                  company: note.suggested_company || undefined,
                  note_date: note.meeting_date || undefined,
                })

                result.processed++

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (err) {
                result.errors++
                result.error_details?.push(`Note ${note.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
              }
            }
            break
          }

          case 'chat_message': {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: messages, error } = await (supabase as any)
              .from('chat_messages')
              .select('id, content, role')
              .eq('role', 'assistant') // Only embed assistant messages
              .not('content', 'is', null)
              .order('created_at', { ascending: true })
              .range(offset, offset + limit - 1) as { data: MessageData[] | null; error: unknown }

            if (error) throw error

            for (const message of messages || []) {
              try {
                if (skip_existing && await hasEmbedding('chat_message', message.id)) {
                  result.skipped++
                  continue
                }

                if (!message.content || message.content.trim().length < 10) {
                  result.skipped++
                  continue
                }

                await embedAndStore('chat_message', message.id, message.content, {
                  role: message.role,
                })

                result.processed++
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (err) {
                result.errors++
                result.error_details?.push(`Message ${message.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
              }
            }
            break
          }

          default:
            result.error_details?.push(`Unknown source type: ${sourceType}`)
        }
      } catch (err) {
        result.errors++
        result.error_details?.push(`Failed to fetch ${sourceType}s: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Only include error details if there are errors
      if (result.errors === 0) {
        delete result.error_details
      }

      results.push(result)
    }

    // Get stats after backfill
    const statsAfter = await getEmbeddingStats()
    const duration = Date.now() - startTime

    console.log(`[EMBEDDINGS] Backfill complete in ${duration}ms:`, results)

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results,
      stats: {
        before: statsBefore,
        after: statsAfter,
        added: statsAfter.total - statsBefore.total
      }
    })
  } catch (error) {
    console.error('[EMBEDDINGS] Backfill error:', error)

    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to backfill embeddings' },
      { status: 500 }
    )
  }
}

// GET - Return current embedding stats
export async function GET() {
  try {
    const stats = await getEmbeddingStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[EMBEDDINGS] Stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    )
  }
}
