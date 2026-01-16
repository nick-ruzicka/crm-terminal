-- Suggestions table for Chief of Staff background generation
create table suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null,
  type text not null,
  source_type text,
  source_id uuid,
  source_name text,
  source_quote text,
  suggested_action jsonb,
  shown_count int default 0,
  last_shown_at timestamptz,
  dismissed_at timestamptz,
  completed_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_suggestions_active on suggestions (dismissed_at, completed_at);

alter table suggestions enable row level security;
create policy "Allow all for suggestions" on suggestions for all using (true);
