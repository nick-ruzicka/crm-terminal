/**
 * Debug script to inspect notes content
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
  // Get all columns from notes
  console.log('=== SAMPLE NOTES (all columns) ===')
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .limit(5)

  console.log(JSON.stringify(notes, null, 2))

  // Check content for company mentions
  console.log('\n=== Notes content preview ===')
  const { data: contentNotes } = await supabase
    .from('notes')
    .select('id, content')
    .not('content', 'is', null)
    .limit(3)

  for (const note of contentNotes || []) {
    console.log(`\nNote ${note.id}:`)
    console.log(note.content?.substring(0, 500) + '...')
  }
}

debug().catch(console.error)
