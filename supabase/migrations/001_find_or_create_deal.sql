-- ============================================
-- DEAL DEDUPLICATION FUNCTION
-- Prevents duplicate deals by company name
-- ============================================

-- Drop existing function if it exists
drop function if exists find_or_create_deal(text, text, text, text);

-- Create the deduplication function
create or replace function find_or_create_deal(
  p_company text,
  p_deal_type text default 'partnership',
  p_source text default 'granola',
  p_stage text default 'discovery'
) returns uuid as $$
declare
  existing_deal_id uuid;
  new_deal_id uuid;
begin
  -- Check if deal with this company already exists (case-insensitive)
  select id into existing_deal_id
  from deals
  where lower(trim(company)) = lower(trim(p_company))
  limit 1;

  -- If exists, return existing deal ID
  if existing_deal_id is not null then
    return existing_deal_id;
  end if;

  -- Otherwise create new deal
  insert into deals (name, company, deal_type, source, stage)
  values (p_company, p_company, p_deal_type, p_source, p_stage)
  returning id into new_deal_id;

  return new_deal_id;
end;
$$ language plpgsql security definer;

-- Grant execute permission to anon and authenticated roles
grant execute on function find_or_create_deal(text, text, text, text) to anon;
grant execute on function find_or_create_deal(text, text, text, text) to authenticated;

-- ============================================
-- USAGE EXAMPLES
-- ============================================

-- Via Supabase REST API (Zapier webhook):
-- POST https://[project].supabase.co/rest/v1/rpc/find_or_create_deal
-- Headers:
--   apikey: [anon_key]
--   Authorization: Bearer [anon_key]
--   Content-Type: application/json
-- Body:
--   {"p_company": "Da Vinci Trading"}
--
-- Returns: UUID (existing or newly created deal ID)

-- Example with all parameters:
-- {"p_company": "Acme Corp", "p_deal_type": "integration", "p_source": "referral", "p_stage": "lead"}
