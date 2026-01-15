/**
 * Script to link HubSpot notes to deals
 *
 * Notes have suggested_company field (from Claude classification)
 * Deals have company field
 *
 * This script matches notes to deals and updates notes.deal_id
 *
 * Run with: npx tsx scripts/link-notes-to-deals.ts
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

// Normalize company name for matching
function normalizeCompanyName(name: string | null): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
}

// Calculate similarity between two strings (simple approach)
function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (!s1 || !s2) return 0

  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1

  // Check if shorter is contained in longer
  if (longer.includes(shorter)) {
    return shorter.length / longer.length
  }

  return 0
}

async function linkNotesToDeals() {
  console.log('🔗 Starting notes-to-deals linking process...\n')

  // 1. Fetch all deals
  console.log('📊 Fetching all deals...')
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, name, company, hubspot_id')

  if (dealsError) {
    console.error('Failed to fetch deals:', dealsError)
    process.exit(1)
  }

  console.log(`   Found ${deals.length} deals\n`)

  // Create arrays of company names for content matching
  // Sort by length descending to match longer names first (e.g., "Glass Markets" before "Glass")
  const companyNames = deals
    .flatMap(deal => {
      const names: { name: string; deal: typeof deals[0] }[] = []
      if (deal.company) names.push({ name: deal.company, deal })
      if (deal.name && deal.name !== deal.company) names.push({ name: deal.name, deal })
      return names
    })
    .filter(item => item.name.length >= 3) // Skip very short names
    .sort((a, b) => b.name.length - a.name.length)

  console.log(`   Created lookup with ${companyNames.length} company name variants\n`)

  // 2. Fetch all notes without deal_id
  console.log('📝 Fetching unlinked notes...')
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, suggested_company, content')
    .is('deal_id', null)

  if (notesError) {
    console.error('Failed to fetch notes:', notesError)
    process.exit(1)
  }

  console.log(`   Found ${notes.length} unlinked notes\n`)

  if (notes.length === 0) {
    console.log('✅ No unlinked notes to process')
    return
  }

  // 3. Match notes to deals by searching content for company names
  console.log('🔍 Matching notes to deals by content analysis...\n')

  let linkedCount = 0
  let noMatchCount = 0
  const updates: { id: string; deal_id: string; matchedCompany: string }[] = []
  const matchedDeals = new Map<string, number>()

  for (const note of notes) {
    const content = note.content || ''
    const contentLower = content.toLowerCase()

    // Find the first (longest) company name that appears in the content
    let matchedDeal: typeof deals[0] | null = null
    let matchedName = ''

    for (const { name, deal } of companyNames) {
      // Check if the company name appears in the content
      // Use word boundaries to avoid partial matches
      const nameLower = name.toLowerCase()

      // Simple check: does the content contain this company name?
      if (contentLower.includes(nameLower)) {
        // Verify it's a meaningful mention (not just a random word)
        // Skip if it's a very common word
        const commonWords = ['the', 'and', 'for', 'with', 'from', 'into', 'over']
        if (commonWords.includes(nameLower)) continue

        matchedDeal = deal
        matchedName = name
        break
      }
    }

    if (matchedDeal) {
      updates.push({
        id: note.id,
        deal_id: matchedDeal.id,
        matchedCompany: matchedName
      })
      linkedCount++
      matchedDeals.set(matchedName, (matchedDeals.get(matchedName) || 0) + 1)
    } else {
      noMatchCount++
    }
  }

  // 4. Perform batch update
  if (updates.length > 0) {
    console.log(`📤 Updating ${updates.length} notes with deal_id...\n`)

    // Update in batches of 50
    const batchSize = 50
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)

      for (const update of batch) {
        const { error } = await supabase
          .from('notes')
          .update({ deal_id: update.deal_id })
          .eq('id', update.id)

        if (error) {
          console.error(`Failed to update note ${update.id}:`, error)
        }
      }

      console.log(`   Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length} notes`)
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Notes linked to deals: ${linkedCount}`)
  console.log(`❌ Notes without match: ${noMatchCount}`)

  if (matchedDeals.size > 0) {
    console.log('\n📈 Notes linked by company:')
    const sortedMatches = Array.from(matchedDeals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
    for (const [company, count] of sortedMatches) {
      console.log(`   ${company}: ${count} note${count > 1 ? 's' : ''}`)
    }
    if (matchedDeals.size > 20) {
      console.log(`   ... and ${matchedDeals.size - 20} more companies`)
    }
  }

  console.log('\n✨ Done!')
}

linkNotesToDeals().catch(console.error)
