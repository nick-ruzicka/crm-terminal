import { NextResponse } from 'next/server'
import { semanticSearch, SourceType } from '@/lib/embeddings'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface SearchRequest {
  query: string
  source_types?: SourceType[]
  limit?: number
  threshold?: number
}

export async function POST(request: Request) {
  try {
    const body: SearchRequest = await request.json()
    const { query, source_types, limit = 10, threshold = 0.7 } = body

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    const results = await semanticSearch(query, {
      sourceTypes: source_types,
      limit,
      threshold,
    })

    const duration = Date.now() - startTime

    console.log(`[EMBEDDINGS] Search for "${query.slice(0, 50)}..." returned ${results.length} results in ${duration}ms`)

    return NextResponse.json({
      query,
      results,
      count: results.length,
      duration_ms: duration,
    })
  } catch (error) {
    console.error('[EMBEDDINGS] Search error:', error)

    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Check if it's a pgvector not enabled error
    if (error instanceof Error && error.message.includes('vector')) {
      return NextResponse.json(
        { error: 'Vector extension not enabled. Run the migration first.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
