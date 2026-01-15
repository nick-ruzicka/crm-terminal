import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Deal } from '@/types/database'

interface DashboardStats {
  total: number
  byStage: Record<string, number>
  recentDeals: Deal[]
}

async function getDashboardStats(): Promise<DashboardStats> {
  const { data: deals, error } = await supabase
    .from('deals')
    .select('*')

  if (error) {
    console.error('Error fetching deals:', error)
    return { total: 0, byStage: {}, recentDeals: [] }
  }

  const dealList: Deal[] = deals || []

  const byStage = dealList.reduce((acc, deal) => {
    const stage = deal.stage || 'Unknown'
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const recentDeals = dealList.slice(0, 5)

  return {
    total: dealList.length,
    byStage,
    recentDeals,
  }
}

export const revalidate = 0

export default async function Dashboard() {
  const stats = await getDashboardStats()

  const stageOrder = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed', 'Lost']
  const orderedStages = stageOrder.filter(stage => stats.byStage[stage] !== undefined)
  const otherStages = Object.keys(stats.byStage).filter(stage => !stageOrder.includes(stage))

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
        Pipeline Dashboard
      </h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Deals</h3>
          <div className="value">{stats.total}</div>
        </div>
        {[...orderedStages, ...otherStages].map(stage => (
          <div className="stat-card" key={stage}>
            <h3>{stage}</h3>
            <div className="value">{stats.byStage[stage]}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Recent Deals</h2>
        {stats.recentDeals.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Stage</th>
                  <th>Next Step</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDeals.map(deal => (
                  <tr key={deal.id} className="clickable-row">
                    <td>
                      <Link href={`/deals/${deal.id}`}>{deal.name}</Link>
                    </td>
                    <td>{deal.company || '—'}</td>
                    <td>
                      <span className={`stage-pill ${(deal.stage || '').toLowerCase()}`}>
                        {deal.stage || 'Unknown'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {deal.next_step || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No deals yet</div>
        )}
        <div style={{ marginTop: '16px' }}>
          <Link
            href="/deals"
            style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 500 }}
          >
            View all deals →
          </Link>
        </div>
      </div>
    </div>
  )
}
