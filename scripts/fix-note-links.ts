/**
 * Fix incorrectly linked notes
 *
 * The original script linked notes to deals if the company name appeared
 * ANYWHERE in the content. This caused notes to be linked to wrong deals
 * when they mentioned multiple companies.
 *
 * This script:
 * 1. Finds notes where the linked deal's company doesn't appear in the first 150 chars
 * 2. Unlinks them (sets deal_id to null)
 * 3. Optionally re-links them based on what company appears first
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  }
}
loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function fix() {
  console.log('🔧 Fixing incorrectly linked notes...\n')

  // Get all deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, company')

  if (!deals) {
    console.error('Failed to fetch deals')
    return
  }

  // Create lookup maps
  const dealById = new Map(deals.map(d => [d.id, d]))
  const dealsByCompany = new Map<string, typeof deals[0]>()
  for (const deal of deals) {
    if (deal.company) {
      dealsByCompany.set(deal.company.toLowerCase(), deal)
    }
    if (deal.name && deal.name !== deal.company) {
      dealsByCompany.set(deal.name.toLowerCase(), deal)
    }
  }

  // Get all notes with deal_id
  const { data: notes } = await supabase
    .from('notes')
    .select('id, deal_id, content')
    .not('deal_id', 'is', null)

  if (!notes) {
    console.error('Failed to fetch notes')
    return
  }

  console.log(`Checking ${notes.length} linked notes...\n`)

  let unlinked = 0
  let relinked = 0
  let correct = 0

  for (const note of notes) {
    const deal = dealById.get(note.deal_id)
    if (!deal) continue

    const contentLower = (note.content || '').toLowerCase()
    const first150 = contentLower.substring(0, 150)

    // Check if the current deal's company appears in first 150 chars
    const companyLower = (deal.company || deal.name || '').toLowerCase()
    const companyInStart = first150.includes(companyLower)

    if (companyInStart) {
      correct++
      continue
    }

    console.log(`❌ Note ${note.id} incorrectly linked to "${deal.company}"`)
    console.log(`   First 100 chars: ${note.content?.substring(0, 100)}...`)

    // Find the correct deal based on what company appears first in the content
    let bestDeal: typeof deals[0] | null = null
    let bestPosition = Infinity

    for (const [companyName, companyDeal] of dealsByCompany.entries()) {
      if (companyName.length < 3) continue // Skip very short names

      const position = first150.indexOf(companyName)
      if (position !== -1 && position < bestPosition) {
        bestPosition = position
        bestDeal = companyDeal
      }
    }

    if (bestDeal && bestDeal.id !== deal.id) {
      // Re-link to correct deal
      const { error } = await supabase
        .from('notes')
        .update({ deal_id: bestDeal.id })
        .eq('id', note.id)

      if (error) {
        console.log(`   Failed to relink: ${error.message}`)
      } else {
        console.log(`   ✅ Relinked to "${bestDeal.company}"`)
        relinked++
      }
    } else {
      // Unlink (set deal_id to null)
      const { error } = await supabase
        .from('notes')
        .update({ deal_id: null })
        .eq('id', note.id)

      if (error) {
        console.log(`   Failed to unlink: ${error.message}`)
      } else {
        console.log(`   ⚪ Unlinked (no matching deal found in first 150 chars)`)
        unlinked++
      }
    }
    console.log('')
  }

  console.log('='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Correctly linked: ${correct}`)
  console.log(`🔄 Relinked to correct deal: ${relinked}`)
  console.log(`⚪ Unlinked: ${unlinked}`)
}

fix().catch(console.error)
