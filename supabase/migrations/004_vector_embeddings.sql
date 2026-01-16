-- Enable the vector extension (requires Supabase to have pgvector enabled)
create extension if not exists vector;

-- Create embeddings table for storing vector representations
create table if not exists embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,           -- 'deal', 'note', 'task', 'chat_message'
  source_id uuid not null,              -- FK to the original record
  content text not null,                -- The text that was embedded
  embedding vector(1536),               -- OpenAI text-embedding-ada-002 dimension
  metadata jsonb default '{}',          -- Extra context (deal_name, stage, etc.)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast similarity search using IVFFlat
-- lists = 100 is good for up to ~100k vectors
create index if not exists embeddings_embedding_idx
  on embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Unique constraint to prevent duplicate embeddings for same source
create unique index if not exists embeddings_source_unique_idx
  on embeddings (source_type, source_id);

-- Index for filtering by source type
create index if not exists embeddings_source_type_idx
  on embeddings (source_type);

-- Enable RLS
alter table embeddings enable row level security;

-- Allow all operations for now (adjust based on your auth needs)
create policy "Allow all for embeddings" on embeddings
  for all using (true);

-- Function for semantic similarity search
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_types text[] default null
)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    e.id,
    e.source_type,
    e.source_id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  where (filter_types is null or e.source_type = any(filter_types))
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Grant execute permission on the function
grant execute on function match_embeddings to anon, authenticated;
