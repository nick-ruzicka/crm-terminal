/**
 * Debug script to inspect notes and deals data
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')

    for (const line of lines) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        process.env[key.trim()] = value
      }
    }
  } catch (error) {
    console.error('Failed to load .env.local:', error)
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  // Sample notes
  console.log('=== SAMPLE NOTES (with suggested_company) ===')
  const { data: notes } = await supabase
    .from('notes')
    .select('id, suggested_company, content')
    .not('suggested_company', 'is', null)
    .limit(10)

  console.log(JSON.stringify(notes, null, 2))

  console.log('\n=== SAMPLE DEALS ===')
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, company, hubspot_id')
    .limit(10)

  console.log(JSON.stringify(deals, null, 2))

  // Check notes with null suggested_company
  const { count } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .is('suggested_company', null)

  console.log(`\n=== Notes with NULL suggested_company: ${count} ===`)

  // Get unique suggested_company values
  const { data: allNotes } = await supabase
    .from('notes')
    .select('suggested_company')
    .not('suggested_company', 'is', null)

  const uniqueCompanies = new Set(allNotes?.map(n => n.suggested_company))
  console.log(`\n=== Unique suggested_company values (${uniqueCompanies.size}): ===`)
  console.log(Array.from(uniqueCompanies).slice(0, 20))

  // Get unique deal companies
  const { data: allDeals } = await supabase
    .from('deals')
    .select('company')
    .not('company', 'is', null)

  const uniqueDealCompanies = new Set(allDeals?.map(d => d.company))
  console.log(`\n=== Unique deal company values (${uniqueDealCompanies.size}): ===`)
  console.log(Array.from(uniqueDealCompanies).slice(0, 20))
}

debug().catch(console.error)
