import OpenAI from 'openai'
import { getSupabase } from './supabase'

// Types
export type SourceType = 'deal' | 'note' | 'task' | 'chat_message'

export interface EmbeddingMetadata {
  deal_name?: string
  company?: string
  stage?: string
  note_date?: string
  task_name?: string
  [key: string]: unknown
}

export interface SemanticSearchResult {
  id: string
  source_type: SourceType
  source_id: string
  content: string
  metadata: EmbeddingMetadata
  similarity: number
}

// Initialize OpenAI client (lazy initialization)
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for embeddings')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Generate an embedding vector for the given text using OpenAI's ada-002 model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI()

  // Truncate text to stay within token limits (ada-002 has 8191 token limit)
  // Rough estimate: 1 token ≈ 4 chars, so 8000 tokens ≈ 32000 chars
  const truncatedText = text.slice(0, 30000)

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: truncatedText,
  })

  return response.data[0].embedding
}

/**
 * Generate embedding and store in database
 * Uses upsert to update if already exists
 */
export async function embedAndStore(
  sourceType: SourceType,
  sourceId: string,
  content: string,
  metadata: EmbeddingMetadata = {}
): Promise<number[]> {
  const supabase = getSupabase()

  // Generate the embedding
  const embedding = await generateEmbedding(content)

  // Store in database with upsert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('embeddings')
    .upsert({
      source_type: sourceType,
      source_id: sourceId,
      content,
      embedding: embedding as unknown as string, // Supabase expects string for vector
      metadata,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'source_type,source_id',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Failed to store embedding:', error)
    throw error
  }

  return embedding
}

/**
 * Semantic search across embeddings
 */
export async function semanticSearch(
  query: string,
  options: {
    sourceTypes?: SourceType[]
    limit?: number
    threshold?: number
  } = {}
): Promise<SemanticSearchResult[]> {
  const { sourceTypes, limit = 10, threshold = 0.7 } = options
  const supabase = getSupabase()

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Call the RPC function for vector similarity search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_types: sourceTypes || null
  })

  if (error) {
    console.error('Semantic search failed:', error)
    throw error
  }

  return (data || []) as SemanticSearchResult[]
}

/**
 * Delete embedding for a source
 */
export async function deleteEmbedding(
  sourceType: SourceType,
  sourceId: string
): Promise<void> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('embeddings')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  if (error) {
    console.error('Failed to delete embedding:', error)
    throw error
  }
}

/**
 * Check if an embedding exists for a source
 */
export async function hasEmbedding(
  sourceType: SourceType,
  sourceId: string
): Promise<boolean> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('embeddings')
    .select('id')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Failed to check embedding:', error)
    throw error
  }

  return !!data
}

/**
 * Build content string for a deal
 */
export function buildDealContent(deal: {
  name: string
  company?: string | null
  stage?: string | null
  deal_type?: string | null
  source?: string | null
}): string {
  const parts = [
    deal.company || deal.name,
    deal.stage && `Stage: ${deal.stage}`,
    deal.deal_type && `Type: ${deal.deal_type}`,
    deal.source && `Source: ${deal.source}`,
  ].filter(Boolean)

  return parts.join('. ')
}

/**
 * Build content string for a note
 */
export function buildNoteContent(note: {
  content?: string | null
  suggested_company?: string | null
  meeting_date?: string | null
}): string {
  const parts = [
    note.suggested_company && `Company: ${note.suggested_company}`,
    note.meeting_date && `Meeting: ${note.meeting_date}`,
    note.content,
  ].filter(Boolean)

  return parts.join('. ')
}

/**
 * Get embedding stats
 */
export async function getEmbeddingStats(): Promise<{
  total: number
  byType: Record<string, number>
}> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('embeddings')
    .select('source_type')

  if (error) {
    console.error('Failed to get embedding stats:', error)
    throw error
  }

  const byType: Record<string, number> = {}
  for (const row of data || []) {
    byType[row.source_type] = (byType[row.source_type] || 0) + 1
  }

  return {
    total: data?.length || 0,
    byType
  }
}
