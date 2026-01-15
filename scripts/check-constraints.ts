import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  } catch (error) {
    console.error('Failed to load .env.local:', error)
  }
}

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
  // Get unique stages
  const { data: stages } = await supabase
    .from('deals')
    .select('stage')
  const uniqueStages = [...new Set(stages?.map(d => d.stage).filter(Boolean))]
  console.log('Valid stages:', uniqueStages)

  // Get unique deal_types
  const { data: dealTypes } = await supabase
    .from('deals')
    .select('deal_type')
  const uniqueDealTypes = [...new Set(dealTypes?.map(d => d.deal_type).filter(Boolean))]
  console.log('Valid deal_types:', uniqueDealTypes)

  // Get unique sources
  const { data: sources } = await supabase
    .from('deals')
    .select('source')
  const uniqueSources = [...new Set(sources?.map(d => d.source).filter(Boolean))]
  console.log('Valid sources:', uniqueSources)
}

check()
