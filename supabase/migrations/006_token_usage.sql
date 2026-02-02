-- Token usage tracking table for monitoring API costs
CREATE TABLE IF NOT EXISTS token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_cost numeric(10, 6) NOT NULL,
  model text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  loops integer NOT NULL DEFAULT 1,
  duration_ms integer,
  tools_used text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);

-- Enable RLS
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust for your security requirements)
CREATE POLICY "Allow all operations on token_usage" ON token_usage
  FOR ALL USING (true) WITH CHECK (true);

-- View for daily usage summary
CREATE OR REPLACE VIEW token_usage_daily AS
SELECT
  date_trunc('day', created_at) as date,
  count(*) as queries,
  sum(input_tokens) as total_input,
  sum(output_tokens) as total_output,
  sum(total_tokens) as total_tokens,
  sum(estimated_cost) as total_cost,
  avg(total_tokens)::integer as avg_tokens_per_query,
  max(total_tokens) as max_tokens
FROM token_usage
GROUP BY date_trunc('day', created_at)
ORDER BY date DESC;
