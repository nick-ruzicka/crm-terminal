/**
 * Create demo data for video recording
 * Run with: npx tsx scripts/create-demo-data.ts
 * Delete with: DELETE FROM deals WHERE source = 'demo'; DELETE FROM notes WHERE source = 'demo';
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf-8')
const envVars: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Company names - will be prefixed with [DEMO] for easy identification/deletion
const companyNames = [
  'Hooli', 'Pied Piper', 'Initech', 'Vandelay Industries', 'Stark Industries',
  'Wayne Enterprises', 'Acme Corp', 'Globex', 'Dunder Mifflin', 'Prestige Worldwide',
  'Umbrella Corp', 'Bluth Company', 'Wonka Industries', 'Cyberdyne', 'Skynet',
  'Weyland-Yutani', 'Tyrell Corp', 'Oscorp', 'LexCorp', 'Gekko & Co',
  'Nakatomi Trading', 'Genco Olive Oil', 'Sterling Cooper', 'Pearson Hardman',
  'Wolfram & Hart', 'InGen', 'Soylent Corp', 'Omni Consumer Products', 'Rekall',
  'Virtucon', 'Massive Dynamic', 'Bada Bing Entertainment', 'Satriale\'s Pork Store',
  'Nuovo Vesuvio Holdings', 'Barone Sanitation', 'Webistics'
]

// Don't add [DEMO] prefix - just use the names directly for a clean video
const companies = companyNames

// Stage distribution: Lead (15), Discovery (15), Evaluation (5), Negotiation (10), Closed Won (5)
const stageDistribution = [
  ...Array(15).fill('lead'),
  ...Array(15).fill('discovery'),
  ...Array(5).fill('evaluation'),
  ...Array(10).fill('negotiation'),
  ...Array(5).fill('closed_won'),
]

const dealTypes = ['partnership', 'other']
const sources = ['inbound', 'outbound', 'referral', 'event', 'other']

async function createDeals() {
  console.log('Creating demo deals...')

  const deals = companies.map((company, i) => ({
    name: company,
    company: company,
    stage: stageDistribution[i % stageDistribution.length],
    deal_type: dealTypes[i % 2],
    source: sources[i % sources.length],
  }))

  const { data, error } = await supabase
    .from('deals')
    .insert(deals)
    .select('id, company, stage')

  if (error) {
    console.error('Error creating deals:', error)
    return []
  }

  console.log(`Created ${data?.length} deals`)
  return data || []
}

async function createNotes(deals: { id: string; company: string; stage: string }[]) {
  console.log('Creating demo notes...')

  // Get deals in discovery and negotiation stages for notes
  const notableDeals = deals.filter(d =>
    ['discovery', 'negotiation', 'evaluation'].includes(d.stage)
  ).slice(0, 15)

  const noteTemplates = [
    'Discussed integration timeline. They want to go live by end of Q2. Technical team seems aligned.',
    'Pricing conversation went well. They\'re comparing us to two other solutions but we\'re the front-runner.',
    'Technical review scheduled for next week. Their CTO is very interested in our latency numbers.',
    'Need to follow up on API docs. They want to see our SDK before making a decision.',
    'Great call with their BD team. They see a clear path to partnership. Next step: intro to their CEO.',
    'They\'re moving fast. Want to launch a pilot program in February. Need to scope engineering resources.',
    'Discussed tokenomics integration. They have concerns about regulatory compliance we need to address.',
    'Demo went well. Their product team was impressed with the Living Parlay concept.',
    'Follow-up from conference. They want to explore co-marketing opportunities around March Madness.',
    'Initial technical assessment complete. Our architecture fits their requirements well.',
    'Negotiating terms. They want exclusivity for 6 months. Need to discuss internally.',
    'Partnership structure discussion. They prefer revenue share over flat fee.',
    'Integration complexity higher than expected. May need dedicated engineering support.',
    'Legal review in progress. Their team has questions about our data handling practices.',
    'Stakeholder alignment call. Got buy-in from their CFO. Moving to final approval.',
  ]

  const notes = notableDeals.map((deal, i) => ({
    deal_id: deal.id,
    content: noteTemplates[i % noteTemplates.length],
    meeting_date: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // Spread over past 30 days
    review_status: 'approved',
  }))

  const { data, error } = await supabase
    .from('notes')
    .insert(notes)
    .select('id')

  if (error) {
    console.error('Error creating notes:', error)
    return
  }

  console.log(`Created ${data?.length} notes attached to deals`)
}

async function createReviewItems() {
  console.log('Creating demo review items...')

  const reviewItems = [
    {
      content: `### Meeting with Aviato

Discussed their prediction market infrastructure needs. They\'re building a sports betting aggregator and need low-latency settlement.

Key points:
- Looking for sub-second settlement times
- Want to integrate with multiple data providers
- Budget: $50-100k for initial integration
- Timeline: Q2 launch target

Next steps: Send technical specs and schedule follow-up with their CTO.`,
      suggested_company: 'Aviato',
      confidence: 85,
    },
    {
      content: `### Raviga Capital intro call

Potential investment partner. They\'re interested in the prediction market thesis and want to explore strategic partnership.

Discussion points:
- They have portfolio companies that could benefit from our infrastructure
- Interested in co-leading next round
- Want to see testnet metrics before committing

Follow up scheduled for next week.`,
      suggested_company: 'Raviga Capital',
      confidence: 72,
    },
    {
      content: `### Nucleus Integration Discussion

Their team is building a DeFi aggregator and wants to add prediction markets to their offering.

Technical requirements:
- Need WebSocket API for real-time prices
- Want white-label solution
- Concerned about regulatory exposure

They mentioned Polymarket as alternative but prefer our latency.`,
      suggested_company: 'Nucleus',
      confidence: 78,
    },
    {
      content: `### Call with Bachmanity Capital

Interesting conversation about market making for prediction markets. They have experience with Kalshi.

Key insights:
- Current MM economics don\'t work at scale
- Want guaranteed volume commitments
- Need more clarity on our fee structure

Should loop in Ryan for product discussion.`,
      suggested_company: 'Bachmanity Capital',
      confidence: 65,
    },
    {
      content: `### EndFrame Partnership Exploration

They\'re pivoting from video compression to blockchain infrastructure. Interested in building on Linera.

Notes:
- Have strong engineering team (ex-Google, ex-Meta)
- Want to be early ecosystem partner
- Looking for grants or investment to support development

Promising but early stage. Track for Q3.`,
      suggested_company: 'EndFrame',
      confidence: 58,
    },
    {
      content: `### Tres Comas Ventures intro

Fund focused on Web3 consumer apps. They\'ve invested in several prediction market adjacent companies.

Discussion:
- Interested in our mobile-first approach
- Want to see user acquisition strategy
- Could provide intros to their portfolio

Good relationship to maintain for future fundraise.`,
      suggested_company: 'Tres Comas Ventures',
      confidence: 45,
    },
  ]

  const notes = reviewItems.map((item, i) => ({
    content: item.content,
    suggested_company: item.suggested_company,
    confidence: item.confidence,
    is_potential_deal: true,
    review_status: 'pending',
    meeting_date: new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
  }))

  const { data, error } = await supabase
    .from('notes')
    .insert(notes)
    .select('id')

  if (error) {
    console.error('Error creating review items:', error)
    return
  }

  console.log(`Created ${data?.length} review items`)
}

async function main() {
  console.log('Starting demo data creation...\n')

  // Create deals
  const deals = await createDeals()

  // Create notes attached to deals
  await createNotes(deals)

  // Create review items (unlinked notes)
  await createReviewItems()

  console.log('\n✅ Demo data created successfully!')
  console.log('\nTo delete all demo data, run this SQL:')
  console.log(`
DELETE FROM notes WHERE deal_id IN (
  SELECT id FROM deals WHERE company IN (
    'Hooli', 'Pied Piper', 'Initech', 'Vandelay Industries', 'Stark Industries',
    'Wayne Enterprises', 'Acme Corp', 'Globex', 'Dunder Mifflin', 'Prestige Worldwide',
    'Umbrella Corp', 'Bluth Company', 'Wonka Industries', 'Cyberdyne', 'Skynet',
    'Weyland-Yutani', 'Tyrell Corp', 'Oscorp', 'LexCorp', 'Gekko & Co',
    'Nakatomi Trading', 'Genco Olive Oil', 'Sterling Cooper', 'Pearson Hardman',
    'Wolfram & Hart', 'InGen', 'Soylent Corp', 'Omni Consumer Products', 'Rekall',
    'Virtucon', 'Massive Dynamic', 'Bada Bing Entertainment', 'Satriale''s Pork Store',
    'Nuovo Vesuvio Holdings', 'Barone Sanitation', 'Webistics'
  )
);

DELETE FROM notes WHERE suggested_company IN (
  'Aviato', 'Raviga Capital', 'Nucleus', 'Bachmanity Capital', 'EndFrame', 'Tres Comas Ventures'
);

DELETE FROM deals WHERE company IN (
  'Hooli', 'Pied Piper', 'Initech', 'Vandelay Industries', 'Stark Industries',
  'Wayne Enterprises', 'Acme Corp', 'Globex', 'Dunder Mifflin', 'Prestige Worldwide',
  'Umbrella Corp', 'Bluth Company', 'Wonka Industries', 'Cyberdyne', 'Skynet',
  'Weyland-Yutani', 'Tyrell Corp', 'Oscorp', 'LexCorp', 'Gekko & Co',
  'Nakatomi Trading', 'Genco Olive Oil', 'Sterling Cooper', 'Pearson Hardman',
  'Wolfram & Hart', 'InGen', 'Soylent Corp', 'Omni Consumer Products', 'Rekall',
  'Virtucon', 'Massive Dynamic', 'Bada Bing Entertainment', 'Satriale''s Pork Store',
  'Nuovo Vesuvio Holdings', 'Barone Sanitation', 'Webistics'
);
`)
}

main().catch(console.error)
