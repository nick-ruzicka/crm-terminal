/**
 * Update Supabase notes with properly formatted content from Granola export
 *
 * Parses the Granola export markdown file and updates existing notes
 * in Supabase with the properly formatted versions.
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

interface ParsedNote {
  anchorId: string
  title: string
  date: string
  content: string
  granolaUrl: string | null
}

function parseGranolaExport(filePath: string): ParsedNote[] {
  const fileContent = readFileSync(filePath, 'utf-8')
  const notes: ParsedNote[] = []

  // Split by note anchors
  const noteRegex = /<a id="([^"]+)"><\/a>\s*\n\n### ([^\n]+)\s*\n\*\*Date:\*\* (\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=<a id="|$)/g

  let match
  while ((match = noteRegex.exec(fileContent)) !== null) {
    const [, anchorId, title, date, rawContent] = match

    // Extract Granola URL from content
    const granolaMatch = rawContent.match(/https:\/\/notes\.granola\.ai\/[td]\/([a-z0-9-]+)/i)
    const granolaUrl = granolaMatch ? granolaMatch[0] : null

    // Clean up content - remove the "Chat with meeting transcript:" line and trailing separators
    let content = rawContent
      .replace(/Chat with meeting transcript:\s*https:\/\/notes\.granola\.ai\/[^\s]+\s*/gi, '')
      .replace(/\n---\s*$/, '')
      .trim()

    // Add Granola link at top if present
    if (granolaUrl) {
      content = `📋 [**View original notes in Granola**](${granolaUrl})\n\n---\n\n${content}`
    }

    notes.push({
      anchorId,
      title: title.trim(),
      date,
      content,
      granolaUrl
    })
  }

  return notes
}

async function updateNotes() {
  console.log('🔄 Updating notes from Granola export...\n')

  // Parse the export file
  const exportPath = '/Users/nickruzickawork/Downloads/granola_meeting_notes_master.md'
  const parsedNotes = parseGranolaExport(exportPath)
  console.log(`📄 Parsed ${parsedNotes.length} notes from export\n`)

  // Get all notes from Supabase
  const { data: supabaseNotes, error } = await supabase
    .from('notes')
    .select('id, content, meeting_date')

  if (error || !supabaseNotes) {
    console.error('Failed to fetch notes from Supabase:', error)
    return
  }

  console.log(`📊 Found ${supabaseNotes.length} notes in Supabase\n`)

  // Create lookup maps for matching
  const parsedByUrl = new Map<string, ParsedNote>()
  const parsedByTitle = new Map<string, ParsedNote>()

  for (const note of parsedNotes) {
    if (note.granolaUrl) {
      // Extract just the ID part of the URL for matching
      const urlId = note.granolaUrl.split('/').pop()
      if (urlId) {
        parsedByUrl.set(urlId, note)
      }
    }
    // Also index by title (lowercase) for fallback matching
    parsedByTitle.set(note.title.toLowerCase(), note)
  }

  let matched = 0
  let updated = 0
  let errors = 0

  for (const supaNote of supabaseNotes) {
    // Try to match by Granola URL in content
    const urlMatch = (supaNote.content || '').match(/notes\.granola\.ai\/[td]\/([a-z0-9-]+)/i)

    let parsedNote: ParsedNote | undefined

    if (urlMatch) {
      const urlId = urlMatch[1]
      parsedNote = parsedByUrl.get(urlId)
    }

    if (!parsedNote) {
      // Try title matching as fallback
      const contentLower = (supaNote.content || '').toLowerCase()
      for (const [title, note] of parsedByTitle) {
        if (contentLower.includes(title.substring(0, 30))) {
          parsedNote = note
          break
        }
      }
    }

    if (parsedNote) {
      matched++

      // Update the note with formatted content
      const { error: updateError } = await supabase
        .from('notes')
        .update({ content: parsedNote.content })
        .eq('id', supaNote.id)

      if (updateError) {
        console.log(`❌ Failed to update note ${supaNote.id}: ${updateError.message}`)
        errors++
      } else {
        updated++
        if (updated <= 5) {
          console.log(`✅ Updated: "${parsedNote.title.substring(0, 50)}..."`)
        }
      }
    }
  }

  if (updated > 5) {
    console.log(`   ... and ${updated - 5} more`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))
  console.log(`📄 Parsed from export: ${parsedNotes.length}`)
  console.log(`💾 Notes in Supabase: ${supabaseNotes.length}`)
  console.log(`🔗 Matched: ${matched}`)
  console.log(`✅ Updated: ${updated}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`⚪ Unmatched: ${supabaseNotes.length - matched}`)
}

updateNotes().catch(console.error)
