/**
 * Script to re-fetch notes from Granola to get proper markdown formatting
 *
 * Many notes were imported from HubSpot with newlines stripped.
 * This script finds notes with Granola URLs and fetches the original
 * formatted content.
 *
 * Run with: npx tsx scripts/refetch-granola-notes.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables
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

// Simple HTML to markdown converter for Granola pages
async function fetchGranolaContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`  Failed to fetch ${url}: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Granola uses Next.js with server-side rendering
    // The content should be in a script tag or in the HTML
    // Try to extract from meta tags or structured data

    // Look for og:description or other meta content
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/)
    if (ogDescMatch) {
      // This might have the content but likely truncated
    }

    // The content is likely loaded via JavaScript
    // We need to use a different approach
    return null
  } catch (error) {
    console.error(`  Error fetching ${url}:`, error)
    return null
  }
}

// Use Jina AI reader to extract content (free API)
async function fetchWithJina(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
      }
    })

    if (!response.ok) {
      console.error(`  Jina failed for ${url}: ${response.status}`)
      return null
    }

    const content = await response.text()

    // Clean up the Jina response
    // Remove the "Title:" and "URL:" headers that Jina adds
    let cleaned = content
      .replace(/^Title:.*\n/m, '')
      .replace(/^URL Source:.*\n/m, '')
      .replace(/^Markdown Content:\n/m, '')
      .trim()

    // Remove any "Chat with meeting transcript" link at the end since
    // we're replacing the content
    cleaned = cleaned.replace(/\n*---\n*\*?Chat with.*$/i, '')

    return cleaned
  } catch (error) {
    console.error(`  Error with Jina for ${url}:`, error)
    return null
  }
}

async function main() {
  console.log('🔄 Re-fetching notes from Granola...\n')

  // Get all notes with Granola URLs
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, content')
    .not('content', 'is', null)

  if (error) {
    console.error('Failed to fetch notes:', error)
    process.exit(1)
  }

  // Find notes with Granola links
  const notesWithGranola: { id: string; content: string; granolaUrl: string }[] = []

  for (const note of notes || []) {
    const match = note.content?.match(/https:\/\/notes\.granola\.ai\/p\/[a-z0-9-]+/i)
    if (match) {
      notesWithGranola.push({
        id: note.id,
        content: note.content,
        granolaUrl: match[0]
      })
    }
  }

  console.log(`Found ${notesWithGranola.length} notes with Granola links\n`)

  if (notesWithGranola.length === 0) {
    console.log('No notes to update.')
    return
  }

  let updated = 0
  let failed = 0

  // Process each note
  for (let i = 0; i < notesWithGranola.length; i++) {
    const note = notesWithGranola[i]
    console.log(`[${i + 1}/${notesWithGranola.length}] Fetching ${note.granolaUrl}`)

    // Check if content already has proper formatting
    if (note.content.includes('\n') && (note.content.includes('###') || note.content.includes('\n- '))) {
      console.log('  Already formatted, skipping')
      continue
    }

    // Fetch using Jina AI reader
    const newContent = await fetchWithJina(note.granolaUrl)

    if (newContent && newContent.length > 100) {
      // Append the original Granola link
      const finalContent = `${newContent}\n\n---\n\n🔗 [View original in Granola](${note.granolaUrl})`

      // Update in database
      const { error: updateError } = await supabase
        .from('notes')
        .update({ content: finalContent })
        .eq('id', note.id)

      if (updateError) {
        console.error(`  Failed to update: ${updateError.message}`)
        failed++
      } else {
        console.log(`  ✓ Updated (${newContent.length} chars)`)
        updated++
      }
    } else {
      console.log('  ✗ Could not fetch content')
      failed++
    }

    // Rate limit - wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))
  console.log(`✓ Updated: ${updated}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`- Skipped (already formatted): ${notesWithGranola.length - updated - failed}`)
}

main().catch(console.error)
