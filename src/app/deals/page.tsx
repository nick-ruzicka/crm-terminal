import { supabase } from '@/lib/supabase'
import { DealsView } from '@/components/DealsView'
import type { Deal } from '@/types/database'

async function getDeals(): Promise<Deal[]> {
  const { data: deals, error } = await supabase
    .from('deals')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching deals:', error)
    return []
  }

  return deals || []
}

async function getStages(deals: Deal[]): Promise<string[]> {
  const stages = new Set<string>()
  deals.forEach(d => {
    if (d.stage) stages.add(d.stage)
  })

  const stageOrder = ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost']
  return Array.from(stages).sort((a, b) => {
    const aIndex = stageOrder.indexOf(a)
    const bIndex = stageOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

export const revalidate = 0

export default async function DealsPage() {
  const deals = await getDeals()
  const stages = await getStages(deals)

  return <DealsView deals={deals} stages={stages} />
}
