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

async function check() {
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, company')
    .ilike('company', '%Babylon%')
    .limit(1)

  if (!deals?.length) {
    console.log('No Babylon deal found')
    return
  }

  const deal = deals[0]
  console.log('Babylon deal:', deal.id, deal.company)

  const { data: notes } = await supabase
    .from('notes')
    .select('id, content')
    .eq('deal_id', deal.id)

  console.log('Notes linked:', notes?.length)

  for (const note of notes || []) {
    const contentLower = (note.content || '').toLowerCase()
    const first150 = note.content?.substring(0, 150) || ''
    const babylonInStart = contentLower.substring(0, 100).includes('babylon')

    console.log('')
    console.log('Note:', note.id)
    console.log('  Start:', first150.replace(/\n/g, ' '))
    console.log('  Babylon in first 100 chars:', babylonInStart)
    console.log('  Contains GSR:', contentLower.includes('gsr'))
  }
}
check()
